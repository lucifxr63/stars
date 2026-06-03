/**
 * migrate_inapi_to_vault.mjs
 * Migra inapi_records del proyecto principal al knowledge-vault separado.
 *
 * Prerrequisitos:
 *   1. Crear nuevo proyecto Supabase ("validateai-knowledge-vault")
 *   2. Ejecutar validateai-knowledge-vault/schema.sql en el nuevo proyecto
 *   3. Tener ambas DB passwords a mano
 *
 * Uso:
 *   node scripts/migrate_inapi_to_vault.mjs <SOURCE_PASS> <VAULT_PASS> <VAULT_REF>
 *
 *   SOURCE_PASS  — password del proyecto principal (fcdhcntyvsydnvjwopfe)
 *                  Supabase Dashboard → Settings → Database → Database password
 *   VAULT_PASS   — password del nuevo proyecto knowledge-vault
 *   VAULT_REF    — project ref del knowledge-vault (ej: abcdefghijklmnop)
 *
 * Ejemplo:
 *   node scripts/migrate_inapi_to_vault.mjs MiPass123 VaultPass456 abcdefghijklmnop
 *
 * Tiempo estimado: ~8–15 min para 503K filas (depende de la red)
 */

import pg from 'pg';

const { Client } = pg;

const [,, SOURCE_PASS, VAULT_PASS, VAULT_REF] = process.argv;

if (!SOURCE_PASS || !VAULT_PASS || !VAULT_REF) {
  console.error('Uso: node scripts/migrate_inapi_to_vault.mjs <SOURCE_PASS> <VAULT_PASS> <VAULT_REF>');
  process.exit(1);
}

const BATCH_SIZE = 5_000;
const SOURCE_HOST = 'db.fcdhcntyvsydnvjwopfe.supabase.co';
const VAULT_HOST  = `db.${VAULT_REF}.supabase.co`;

const COLUMNS = [
  'id', 'application_number', 'registration_number', 'application_type',
  'application_seq', 'application_serie', 'niza_classes', 'vienna_classes',
  'regions', 'ipc_codes', 'applicants', 'representatives', 'inventors',
  'location_applicants', 'state_applicants', 'location_representatives',
  'state_representatives', 'country', 'filing_date', 'publication_date',
  'registration_date', 'expiration_date', 'pct_application_date', 'pct_publication_date',
  'brand_name', 'title', 'translation', 'label_description', 'protection_description',
  'priorities', 'sign_type', 'type_name', 'subtype_name', 'status', 'image_url',
  'last_updated_date', 'ingested_at', 'brand_name_embedding',
];

const COL_LIST = COLUMNS.join(', ');
const PLACEHOLDERS = (n) => COLUMNS.map((_, i) => `$${i + 1 + n * COLUMNS.length}`).join(', ');

function makeConnConfig(host, password) {
  return {
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
    statement_timeout: 600_000,
  };
}

async function main() {
  const source = new Client(makeConnConfig(SOURCE_HOST, SOURCE_PASS));
  const vault  = new Client(makeConnConfig(VAULT_HOST, VAULT_PASS));

  console.log('🔌 Conectando a ambas bases de datos...');
  await source.connect();
  await vault.connect();
  console.log('✅ Conexiones establecidas.\n');

  // Contar filas a migrar
  const { rows: [{ count }] } = await source.query('SELECT COUNT(*) FROM inapi_records');
  const total = parseInt(count, 10);
  console.log(`📦 ${total.toLocaleString()} filas a migrar en batches de ${BATCH_SIZE.toLocaleString()}\n`);

  // Verificar que el vault esté vacío para evitar duplicados
  const { rows: [{ count: vaultCount }] } = await vault.query('SELECT COUNT(*) FROM inapi_records');
  if (parseInt(vaultCount, 10) > 0) {
    console.warn(`⚠️  El vault ya tiene ${vaultCount} filas. ¿Continuar de todas formas? (ctrl+c para cancelar)`);
    await new Promise(r => setTimeout(r, 5_000));
  }

  let migrated = 0;
  let offset = 0;

  while (offset < total) {
    const { rows } = await source.query(
      `SELECT ${COL_LIST} FROM inapi_records ORDER BY ingested_at, id LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (rows.length === 0) break;

    // Construir INSERT con múltiples VALUES para máxima velocidad
    const rowsPerInsert = 100;
    for (let i = 0; i < rows.length; i += rowsPerInsert) {
      const chunk = rows.slice(i, i + rowsPerInsert);
      const values = [];
      const params = [];

      chunk.forEach((row, rowIdx) => {
        const rowValues = COLUMNS.map(col => {
          const val = row[col];
          // Convertir arrays a formato PostgreSQL
          if (Array.isArray(val)) return val;
          return val ?? null;
        });
        values.push(`(${COLUMNS.map((_, colIdx) => `$${rowIdx * COLUMNS.length + colIdx + 1}`).join(', ')})`);
        params.push(...rowValues);
      });

      await vault.query(
        `INSERT INTO inapi_records (${COL_LIST}) VALUES ${values.join(', ')} ON CONFLICT (id) DO NOTHING`,
        params
      );
    }

    migrated += rows.length;
    offset += BATCH_SIZE;
    const pct = ((migrated / total) * 100).toFixed(1);
    process.stdout.write(`\r  ${migrated.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`);
  }

  console.log('\n\n✅ Migración completada.');

  // Verificación final
  const { rows: [{ count: finalCount }] } = await vault.query('SELECT COUNT(*) FROM inapi_records');
  console.log(`📊 Vault: ${parseInt(finalCount, 10).toLocaleString()} filas`);
  console.log(`📊 Source: ${total.toLocaleString()} filas`);

  if (parseInt(finalCount, 10) >= total) {
    console.log('\n🎉 Conteos coinciden. Siguiente paso:');
    console.log('   1. Setear KNOWLEDGE_VAULT_URL y KNOWLEDGE_VAULT_SERVICE_ROLE_KEY en Supabase Secrets');
    console.log('   2. Deploy: npx supabase functions deploy inapi-fetch --project-ref fcdhcntyvsydnvjwopfe');
    console.log('   3. Verificar que inapi-fetch responda correctamente en producción');
    console.log('   4. Ejecutar: npx supabase db push --linked (migración DROP TABLE)');
  } else {
    console.warn('\n⚠️  Los conteos no coinciden — NO ejecutes el DROP TABLE todavía.');
    console.warn(`   Faltan ${total - parseInt(finalCount, 10)} filas. Re-ejecutar el script.`);
  }

  await source.end();
  await vault.end();
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
