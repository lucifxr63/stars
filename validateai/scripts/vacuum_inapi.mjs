/**
 * vacuum_inapi.mjs
 * Runs VACUUM FULL + HNSW index creation on inapi_records directly via pg,
 * bypassing the Supabase dashboard 60s statement timeout.
 *
 * Usage:
 *   node scripts/vacuum_inapi.mjs <DB_PASSWORD>
 *
 * The DB_PASSWORD is in Supabase Dashboard → Settings → Database → "Database password"
 * (or click "Reset database password" to generate one if you never set it)
 */

import pg from 'pg';

const { Client } = pg;

const DB_PASSWORD = process.argv[2];
if (!DB_PASSWORD) {
  console.error('Usage: node scripts/vacuum_inapi.mjs <DB_PASSWORD>');
  console.error('Find it at: Supabase Dashboard → Settings → Database → Database password');
  process.exit(1);
}

const client = new Client({
  host: 'db.fcdhcntyvsydnvjwopfe.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 0,       // unlimited — intentional for maintenance
  query_timeout: 0,
  connectionTimeoutMillis: 10000,
});

async function run() {
  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected.\n');

  // Step 1: VACUUM FULL (skip if already done)
  const skipVacuum = process.argv[3] === '--skip-vacuum';
  if (skipVacuum) {
    console.log('Step 1/2: VACUUM FULL — skipped (--skip-vacuum flag)');
  } else {
    console.log('Step 1/2: VACUUM FULL ANALYZE inapi_records');
    console.log('  This rewrites the table and recovers ~1.3 GB. Takes 10–25 min...');
    const t1 = Date.now();
    await client.query("SET statement_timeout = 0");
    await client.query('VACUUM FULL ANALYZE inapi_records');
    const elapsed1 = ((Date.now() - t1) / 1000).toFixed(0);
    console.log(`  Done in ${elapsed1}s.\n`);
  }

  // Step 2: IVFFlat vector index (much lighter than HNSW, works on 1 GB RAM)
  // lists=100 is optimal for 117K vectors (sqrt(117000) ≈ 342, but 100 is fine for recall)
  console.log('Step 2/2: CREATE INDEX inapi_brand_ivfflat_idx');
  console.log('  Building IVFFlat index on 117K vectors. Takes ~2-3 min on MICRO...');
  const t2 = Date.now();
  await client.query("SET statement_timeout = 0");
  await client.query("SET lock_timeout = 0");
  await client.query("SET maintenance_work_mem = '128MB'");
  await client.query(`
    CREATE INDEX IF NOT EXISTS inapi_brand_ivfflat_idx
      ON inapi_records
      USING ivfflat (brand_name_embedding vector_cosine_ops)
      WITH (lists = 100)
      WHERE brand_name_embedding IS NOT NULL
  `);
  const elapsed2 = ((Date.now() - t2) / 1000).toFixed(0);
  console.log(`  Done in ${elapsed2}s.\n`);

  // Verify final state
  const { rows } = await client.query(`
    SELECT
      pg_size_pretty(pg_total_relation_size('inapi_records')) AS total,
      pg_size_pretty(pg_relation_size('inapi_records')) AS data,
      pg_size_pretty(pg_indexes_size('inapi_records')) AS indexes,
      (SELECT count(*) FROM inapi_records) AS rows
  `);
  console.log('Final state:');
  console.table(rows);

  await client.end();
  console.log('\nAll done.');
}

run().catch(async (err) => {
  console.error('Error:', err.message);
  await client.end().catch(() => {});
  process.exit(1);
});
