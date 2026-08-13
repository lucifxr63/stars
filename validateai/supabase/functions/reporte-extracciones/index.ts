// Parte periódico del estado de las extracciones.
//
// POR QUÉ MIDE PRODUCCIÓN Y NO ESTADO DE JOBS
// -------------------------------------------
// El fallo que este sistema repite no es que un job falle: es que TERMINE BIEN
// y no traiga nada. Pasó con `empleo_sync`, con `sync-compra-agil` devolviendo
// 0 encontradas, y con el detector de rachas del worker que contaba en memoria
// sobre un runtime serverless. Un tablero de "corridas exitosas" habría estado
// verde en los tres casos.
//
// Por eso la unidad de este reporte es **filas nuevas en las últimas 24 h**,
// leídas de las tablas de destino. Si una fuente entra en cero, se ve acá aunque
// su job diga `success`.
//
// El segundo error que cubre es el inverso, y también nos pasó esta semana: un
// diagnóstico viejo tomado por presente. `enrich-ordenes` figuró como roto
// durante una semana después de haberse recuperado, y sobre eso se decidió no
// exponer las órdenes por MCP. Un parte diario con la fecha al lado hace que un
// número viejo se note.
//
// Deno.serve, sin auth: se invoca por pg_cron con la service role key.

import { sendOpsAlert, type OpsField } from '../_shared/opsAlert.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const crearCliente = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

/** Miles con punto, que es como se leen los números en Chile. */
const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('es-CL')

/**
 * Una fuente cuyo caudal se vigila.
 *
 * `minimoDiario` es el umbral por debajo del cual el silencio deja de ser
 * plausible. No es un SLA: es "si baja de acá, mirá". Se pone por fuente porque
 * PJUD carga por lotes y Mercado Público a diario, así que un cero significa
 * cosas distintas en cada una.
 */
interface Fuente {
  nombre: string
  tabla: string
  /**
   * Umbral diario. **`0` significa que a esta fuente no se le mide el caudal**,
   * no que se le exija cero: si no hay un número sobre el que actuar, tampoco
   * hay razón para calcularlo.
   */
  minimoDiario: number
}

const FUENTES: Fuente[] = [
  { nombre: 'Mercado Público', tabla: 'licitaciones_mercado_publico', minimoDiario: 500 },
  { nombre: 'Ofertas (competencia)', tabla: 'mp_ofertas', minimoDiario: 100 },
  // PJUD llega por cargas por lote, no a diario, así que un "entró poco hoy" no
  // dice nada: alertaría todos los días y entrenaría a saltear el canal.
  //
  // Y además saldría caro: no hay índice en `created_at` y son 1,7 M de filas en
  // 1,5 GB, así que el filtro escanea la tabla entera y se pasa del tiempo
  // límite. Indexarla para sostener una métrica sobre la que nadie actúa sería
  // pagar escritura y disco por un número decorativo.
  { nombre: 'Corte Suprema', tabla: 'pjud_suprema_detalle', minimoDiario: 0 },
]

/**
 * Cuenta filas. `desde` acota a las creadas después de ese instante.
 *
 * El TOTAL va con `count: 'estimated'` y el delta con `'exact'`, y la diferencia
 * importa: un `count(*)` exacto sobre `pjud_suprema_detalle` —1,7 M de filas,
 * 1,5 GB— se pasa del tiempo límite y tumbaba la fila entera del reporte. En un
 * parte de estado, saber que hay ~1,7 M sirve igual que saber que hay 1.706.941;
 * lo que sí tiene que ser exacto es cuánto entró hoy, que es la cifra sobre la
 * que se decide si algo se rompió — y ésa es chica y va por índice.
 *
 * PostgREST devuelve el estimado del planificador y cae a exacto en tablas
 * pequeñas, así que las fuentes chicas no pierden precisión.
 */
async function contar(sb: any, tabla: string, desde?: string): Promise<number> {
  let q = sb.from(tabla).select('*', { count: desde ? 'exact' : 'estimated', head: true })
  if (desde) q = q.gte('created_at', desde)
  const { count, error } = await q
  if (error) throw new Error(`${tabla}: ${error.message || error.code || 'sin detalle'}`)
  return count ?? 0
}

Deno.serve(async () => {
  const inicio = Date.now()
  const sb = crearCliente()
  const hace24h = new Date(Date.now() - 24 * 3600_000).toISOString()

  const campos: OpsField[] = []
  const problemas: string[] = []

  // ── 1. Caudal por fuente ───────────────────────────────────────────────────
  for (const f of FUENTES) {
    // El TOTAL es contexto y el DELTA es la señal: se piden por separado a
    // propósito. Contar entero `pjud_suprema_detalle` —1,7 M de filas, 1,5 GB—
    // se pasa del tiempo límite, y cuando iban juntos ese fallo se llevaba
    // puesta también la cifra de 24 h, que sí se podía calcular. El parte
    // terminaba diciendo "no se pudo consultar" de una fuente que estaba
    // perfectamente viva.
    let total: number | null = null
    try {
      total = await contar(sb, f.tabla)
    } catch { /* se informa sin total; no es motivo de alerta */ }

    if (f.minimoDiario === 0) {
      campos.push({
        name: `⚪ ${f.nombre}`,
        value: `${total === null ? 'total no disponible' : `${n(total)} totales`} · carga por lotes`,
        inline: true,
      })
      continue
    }

    try {
      const nuevas = await contar(sb, f.tabla, hace24h)
      const seco = nuevas < f.minimoDiario
      if (seco) problemas.push(`${f.nombre}: ${n(nuevas)} filas en 24 h (esperado ≥ ${n(f.minimoDiario)})`)
      campos.push({
        name: `${seco ? '🔴' : '🟢'} ${f.nombre}`,
        value: `${total === null ? 'total no disponible' : `${n(total)} totales`} · **+${n(nuevas)}** en 24 h`,
        inline: true,
      })
    } catch (err) {
      // No poder leer el DELTA sí es el dato: significa que no sabemos si esa
      // fuente está entrando.
      problemas.push(`${f.nombre}: no se pudo medir el ingreso de 24 h — ${String(err)}`)
      campos.push({ name: `🔴 ${f.nombre}`, value: 'no se pudo medir', inline: true })
    }
  }

  // ── 2. Órdenes de compra: el atraso y si drena o crece ─────────────────────
  //
  // No alcanza con cuántas faltan: lo que decide si hay que actuar es el signo
  // de la diferencia entre lo que entra y lo que se enriquece. Un atraso grande
  // que drena se arregla solo; uno chico que crece, no.
  try {
    const [conContenido, pendientes, creadas24h, enriquecidas24h] = await Promise.all([
      sb.from('mp_ordenes_compra').select('*', { count: 'exact', head: true }).eq('enriquecida', true),
      sb.from('mp_ordenes_compra').select('*', { count: 'exact', head: true }).eq('enriquecida', false),
      sb.from('mp_ordenes_compra').select('*', { count: 'exact', head: true }).gte('created_at', hace24h),
      sb.from('mp_ordenes_compra').select('*', { count: 'exact', head: true })
        .eq('enriquecida', true).gte('created_at', hace24h),
    ])
    const pend = pendientes.count ?? 0
    const entran = creadas24h.count ?? 0
    const listas = enriquecidas24h.count ?? 0
    // De las que llegaron hoy, cuántas ya quedaron completas.
    const alDia = entran > 0 ? Math.round((listas / entran) * 100) : 100
    const drena = alDia >= 50
    if (!drena && pend > 0) {
      problemas.push(`Órdenes: sólo ${alDia} % de las nuevas quedó enriquecida y hay ${n(pend)} pendientes`)
    }
    campos.push({
      name: `${drena ? '🟢' : '🟡'} Órdenes de compra`,
      value: `${n(conContenido.count)} con contenido · ${n(pend)} pendientes\n` +
        `+${n(entran)} en 24 h, ${alDia} % ya completas`,
      inline: true,
    })
  } catch (err) {
    problemas.push(`Órdenes de compra: no se pudo consultar — ${String(err)}`)
  }

  // ── 3. Jobs de la ingesta que no están sanos ───────────────────────────────
  //
  // Se lee el diagnóstico que el propio mp-sync calcula (mide si PRODUJERON, no
  // si terminaron). Se listan sólo los que no están ok: un parte que enumera
  // once jobs sanos entrena a saltearlo.
  try {
    const { data: jobs, error } = await sb
      .from('mp_job_health_resumen')
      .select('job_name, diagnostico')
      .neq('diagnostico', 'ok')
    if (error) throw new Error(error.message)
    const rotos = jobs ?? []
    if (rotos.length === 0) {
      campos.push({ name: '🟢 Jobs de ingesta', value: 'todos ok', inline: true })
    } else {
      // «SIN PRODUCIR HACE MAS DE 7 DIAS» es lo normal para los backfills y las
      // cargas históricas, que corren una vez. Se separan para que no compitan
      // por atención con un job diario caído, que sí es urgente.
      const dormidos = rotos.filter((j: any) => String(j.diagnostico).startsWith('SIN PRODUCIR'))
      const caidos = rotos.filter((j: any) => !String(j.diagnostico).startsWith('SIN PRODUCIR'))
      if (caidos.length > 0) {
        problemas.push(...caidos.map((j: any) => `Job ${j.job_name}: ${j.diagnostico}`))
      }
      campos.push({
        name: `${caidos.length ? '🔴' : '🟡'} Jobs de ingesta`,
        value: (caidos.length ? caidos.map((j: any) => `**${j.job_name}** — ${j.diagnostico}`).join('\n') + '\n' : '') +
          (dormidos.length ? `_${dormidos.length} sin producir hace >7 d (backfills y cargas históricas, esperable)_` : ''),
        inline: false,
      })
    }
  } catch (err) {
    problemas.push(`Salud de jobs: no se pudo consultar — ${String(err)}`)
  }

  // ── 4. Crons que disparan por HTTP y son rechazados ────────────────────────
  //
  // pg_cron llama a las Edge Functions con net.http_post. Un 401 ahí no rompe
  // nada visible: el cron figura ejecutado, la función nunca corre y nadie se
  // entera. Al escribir este reporte había 72 respuestas 401 en 6 horas — un
  // cron pegando cada 5 minutos contra una función que lo rechaza.
  try {
    const { data: http, error } = await sb
      .from('cron_http_salud')
      .select('status_code, respuestas')
    if (error) throw new Error(error.message)
    const fallidas = (http ?? []).filter((r: any) => r.status_code !== null && r.status_code >= 400)
    const sinRespuesta = (http ?? []).filter((r: any) => r.status_code === null)
    if (fallidas.length > 0) {
      const detalle = fallidas.map((r: any) => `${r.respuestas}× HTTP ${r.status_code}`).join(', ')
      problemas.push(`Crons rechazados en 24 h: ${detalle} — el cron figura ejecutado y la función nunca corre`)
      campos.push({ name: '🔴 Crons por HTTP', value: detalle, inline: true })
    } else {
      campos.push({
        name: '🟢 Crons por HTTP',
        value: 'sin rechazos en 24 h' +
          (sinRespuesta.length ? ` · ${sinRespuesta[0].respuestas} sin respuesta registrada` : ''),
        inline: true,
      })
    }
  } catch (err) {
    problemas.push(`Salud de crons: no se pudo consultar — ${String(err)}`)
  }

  const hayProblemas = problemas.length > 0
  await sendOpsAlert({
    level: hayProblemas ? 'warn' : 'info',
    channel: 'extracciones',
    title: hayProblemas ? 'Extracciones — hay algo que mirar' : 'Extracciones — al día',
    detail: hayProblemas
      ? problemas.map((p) => `• ${p}`).join('\n')
      : 'Todas las fuentes produjeron por encima de su mínimo en las últimas 24 h.',
    fields: campos,
    footer: `reporte-extracciones · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${Date.now() - inicio} ms`,
  })

  // Se devuelve la LISTA, no sólo el conteo. Con `{problemas: 2}` hubo que
  // reconstruir a mano cuáles eran, y uno resultó ser un fallo del propio
  // reporte —consultaba una relación que PostgREST no sirve— disfrazado de
  // problema de la ingesta. Un diagnóstico que no dice qué falló obliga a
  // repetir el diagnóstico.
  return new Response(
    JSON.stringify({ ok: true, problemas, ms: Date.now() - inicio }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
