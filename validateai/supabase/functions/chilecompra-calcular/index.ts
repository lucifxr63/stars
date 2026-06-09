/**
 * Edge Function: chilecompra-calcular
 * Calcula las métricas M1-M10 de inteligencia ChileCompra para un RUT dado.
 * Persiste en public.chilecompra_metricas con cache semanal.
 *
 * GET  ?rut=12345678-9             — calcula (o devuelve cache si <7 días)
 * GET  ?rut=12345678-9&force=true  — fuerza recalculo
 * POST { rut: "12345678-9" }       — equivalente al GET con RUT
 *
 * Requiere env: MERCADOPUBLICO_TICKET
 *
 * Cron sugerido para watchlist: 0 7 * * 1 (lunes 07:00 UTC)
 * Para disparar manualmente:
 *   curl -X GET "${SUPABASE_URL}/functions/v1/chilecompra-calcular?rut=76543210-K" \
 *     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── Clasificador de sectores ──────────────────────────────────────────────────
const SECTOR_MAP: [string, string[]][] = [
  ['Salud',           ['hospital', 'salud', 'fonasa', 'cenabast', 'servicio de salud', 'cesfam']],
  ['Educación',       ['educacion', 'junaeb', 'colegio', 'universidad', 'liceo', 'mineduc', 'escuela']],
  ['Municipal',       ['municipalidad', 'municipio', 'ilustre']],
  ['Defensa',         ['ejercito', 'armada', 'fuerza aerea', 'fach', 'defensa']],
  ['Vivienda',        ['minvu', 'serviu', 'vivienda', 'habitacional']],
  ['Infraestructura', ['mop', 'vialidad', 'obras publicas', 'metro', 'ferrocarril']],
  ['Justicia',        ['poder judicial', 'ministerio de justicia', 'gendarmeria', 'carabineros', 'pdi']],
  ['Interior',        ['ministerio del interior', 'intendencia', 'gobernacion', 'subdere']],
  ['Economía',        ['sercotec', 'corfo', 'economia', 'pyme', 'emprendimiento']],
  ['Medioambiente',   ['medioambiente', 'conaf', 'sernapesca', 'sag']],
]

function sectorizar(nombre: string): string {
  const n = (nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  for (const [sector, kws] of SECTOR_MAP) {
    if (kws.some(kw => n.includes(kw))) return sector
  }
  return 'Otro'
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface OC {
  CodigoOC?: string
  Fecha?: string
  FechaModificacion?: string
  Monto?: number
  Estado?: string
  Organismo?: { Nombre?: string; Codigo?: string }
  Tipo?: string
  Descripcion?: string
}

interface Licitacion {
  CodigoLicitacion?: string
  Tipo?: string
  Estado?: string
  FechaCreacion?: string
  FechaCierre?: string
  Adjudicacion?: { RutProveedor?: string; Monto?: number }
  Ofertas?: Array<{ RutProveedor?: string }>
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function toDate(s?: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function ddmmyyyy(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

async function fetchMP(path: string, ticket: string): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${MP_BASE}${path}${sep}ticket=${encodeURIComponent(ticket)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`MP API ${res.status} → ${path.split('?')[0]}`)
  return res.json() as Promise<Record<string, unknown>>
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const ticket = Deno.env.get('MERCADOPUBLICO_TICKET')
  if (!ticket) return json({ error: 'MERCADOPUBLICO_TICKET no configurado' }, 503)

  // ── Leer RUT ─────────────────────────────────────────────────────────────────
  const urlObj = new URL(req.url)
  let rut: string | null = urlObj.searchParams.get('rut')

  if (req.method === 'POST') {
    try {
      const body = await req.json() as { rut?: string }
      if (body.rut) rut = body.rut
    } catch { /* ignore */ }
  }

  if (!rut) return json({ error: 'Parámetro rut requerido' }, 400)

  const rutNorm = rut.replace(/[^0-9Kk]/g, '').toUpperCase()
  if (rutNorm.length < 7) return json({ error: 'RUT inválido (muy corto)' }, 400)

  const force = urlObj.searchParams.get('force') === 'true'

  // ── Cache: si hay métricas de <7 días, devolverlas ───────────────────────────
  if (!force) {
    const { data: cached } = await supabase
      .from('chilecompra_metricas')
      .select('*')
      .eq('rut', rutNorm)
      .order('calculado_al', { ascending: false })
      .limit(1)

    if (cached && cached.length > 0) {
      const ageDays = (Date.now() - new Date(cached[0].calculado_al as string).getTime()) / 86_400_000
      if (ageDays < 7) {
        return json({ ...cached[0], _cached: true, _age_days: Math.round(ageDays) })
      }
    }
  }

  // ── Fetch data de Mercado Público ─────────────────────────────────────────────
  const now = new Date()
  const since24m = new Date(now)
  since24m.setMonth(since24m.getMonth() - 24)

  const desde = ddmmyyyy(since24m)
  const hasta = ddmmyyyy(now)

  let allOC: OC[] = []
  let allLicit: Licitacion[] = []

  try {
    const [ocResp, licitResp] = await Promise.all([
      fetchMP(`/ordenesdecompra.json?idrutempresa=${rutNorm}&fechadesde=${encodeURIComponent(desde)}&fechahasta=${encodeURIComponent(hasta)}`, ticket),
      fetchMP(`/licitaciones.json?idrutempresa=${rutNorm}&fechadesde=${encodeURIComponent(desde)}&fechahasta=${encodeURIComponent(hasta)}`, ticket),
    ])

    // La API puede usar distintos nombres de campo según la versión
    allOC = ((ocResp.listadoOC ?? ocResp.ListadoOC ?? ocResp.data ?? []) as OC[])
    allLicit = ((licitResp.Listado ?? licitResp.listado ?? licitResp.data ?? []) as Licitacion[])

    console.log(`[chilecompra-calcular] ${rutNorm}: ${allOC.length} OC, ${allLicit.length} licitaciones`)
  } catch (err) {
    console.error('[chilecompra-calcular] Error MP API:', err)
    return json({ error: 'Error consultando Mercado Público', detail: String(err) }, 502)
  }

  // ── Ventanas temporales ───────────────────────────────────────────────────────
  const ago365   = daysAgo(365)
  const ago730   = daysAgo(730)
  const ago60    = daysAgo(60)

  const ACTIVE   = new Set(['Aceptada', 'Recepcionada', 'Pagada'])
  const PENDING  = new Set(['Aceptada', 'Recepcionada'])

  // ── M1: Ingreso fiscal 12m ────────────────────────────────────────────────────
  const oc12m = allOC.filter(oc => {
    const d = toDate(oc.Fecha)
    return d && d >= ago365 && ACTIVE.has(oc.Estado ?? '')
  })
  const ingreso12m = oc12m.reduce((s, oc) => s + (oc.Monto ?? 0), 0)

  // ── M2: Ingreso meses 13-24 y tendencia ───────────────────────────────────────
  const oc13_24m = allOC.filter(oc => {
    const d = toDate(oc.Fecha)
    return d && d >= ago730 && d < ago365 && ACTIVE.has(oc.Estado ?? '')
  })
  const ingreso13_24m = oc13_24m.reduce((s, oc) => s + (oc.Monto ?? 0), 0)
  const tendenciaPct  = ingreso13_24m > 0
    ? Number(((ingreso12m - ingreso13_24m) / ingreso13_24m * 100).toFixed(2))
    : null

  // ── M3: Deuda estado >60 días ─────────────────────────────────────────────────
  const ocDeuda = allOC.filter(oc => {
    const mod = toDate(oc.FechaModificacion ?? oc.Fecha)
    return mod && mod < ago60 && PENDING.has(oc.Estado ?? '')
  })
  const deudaEstado    = ocDeuda.reduce((s, oc) => s + (oc.Monto ?? 0), 0)
  const ocPendientesN  = ocDeuda.length

  // ── M4: Trato directo ─────────────────────────────────────────────────────────
  const isTD    = (oc: OC) => (oc.Tipo ?? '').toLowerCase().includes('trato directo')
  const ocTD    = allOC.filter(isTD)
  const tdPct   = allOC.length > 0 ? Number((ocTD.length / allOC.length * 100).toFixed(2)) : 0
  const montoAll = allOC.reduce((s, oc) => s + (oc.Monto ?? 0), 0)
  const montoTD  = ocTD.reduce((s, oc) => s + (oc.Monto ?? 0), 0)
  const tdMontoPct = montoAll > 0 ? Number((montoTD / montoAll * 100).toFixed(2)) : 0

  // ── M5: Concentración organismos ─────────────────────────────────────────────
  const orgMontos: Record<string, { nombre: string; monto: number }> = {}
  for (const oc of oc12m) {
    const key = oc.Organismo?.Codigo ?? 'SIN_CODIGO'
    if (!orgMontos[key]) orgMontos[key] = { nombre: oc.Organismo?.Nombre ?? 'Desconocido', monto: 0 }
    orgMontos[key].monto += oc.Monto ?? 0
  }
  const sortedOrgs = Object.values(orgMontos).sort((a, b) => b.monto - a.monto)
  const topOrg     = sortedOrgs[0] ?? null
  const topOrgPct  = ingreso12m > 0 && topOrg ? Number((topOrg.monto / ingreso12m * 100).toFixed(2)) : 0

  // ── M6: Tamaño de contratos ───────────────────────────────────────────────────
  const maxContrato    = allOC.reduce((m, oc) => Math.max(m, oc.Monto ?? 0), 0)
  const maxContrato12m = oc12m.reduce((m, oc) => Math.max(m, oc.Monto ?? 0), 0)
  const ticketProm     = oc12m.length > 0 ? Math.round(ingreso12m / oc12m.length) : 0

  // ── M7: Diversificación sectorial ────────────────────────────────────────────
  const sectores: Record<string, number> = {}
  for (const oc of oc12m) {
    const s = sectorizar(oc.Organismo?.Nombre ?? '')
    sectores[s] = (sectores[s] ?? 0) + (oc.Monto ?? 0)
  }
  const sectoresCount = Object.keys(sectores).filter(s => sectores[s] > 0).length

  // ── M8: Win rate licitaciones (excluye Trato Directo tipo LD) ─────────────────
  const licitComp     = allLicit.filter(l => (l.Tipo ?? '') !== 'LD')
  const licitGanadas  = licitComp.filter(l => {
    const adj = l.Adjudicacion?.RutProveedor?.replace(/[^0-9Kk]/g, '').toUpperCase()
    return adj === rutNorm
  })
  const winRate = licitComp.length > 0
    ? Number((licitGanadas.length / licitComp.length * 100).toFixed(2))
    : null

  // ── M9: Competidores frecuentes ───────────────────────────────────────────────
  const competFreq: Record<string, number> = {}
  for (const l of allLicit) {
    for (const o of (l.Ofertas ?? [])) {
      const compRut = o.RutProveedor?.replace(/[^0-9Kk]/g, '').toUpperCase()
      if (!compRut || compRut === rutNorm) continue
      competFreq[compRut] = (competFreq[compRut] ?? 0) + 1
    }
  }
  const competidores = Object.entries(competFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r, coincidencias]) => ({ rut: r, coincidencias }))

  // ── Persistir ─────────────────────────────────────────────────────────────────
  const calculadoAl = now.toISOString().split('T')[0]

  const row = {
    rut:                        rutNorm,
    calculado_al:               calculadoAl,
    ingreso_fiscal_12m:         ingreso12m,
    ingreso_fiscal_12m_anterior: ingreso13_24m,
    tendencia_pct:              tendenciaPct,
    deuda_estado_pendiente_clp: deudaEstado,
    oc_pendientes_count:        ocPendientesN,
    trato_directo_pct:          tdPct,
    trato_directo_monto_pct:    tdMontoPct,
    top_organismo_nombre:       topOrg?.nombre ?? null,
    top_organismo_pct:          topOrgPct,
    organismos_count:           Object.keys(orgMontos).length,
    sectores_count:             sectoresCount,
    distribucion_sectorial:     sectores,
    max_contrato_clp:           maxContrato,
    max_contrato_12m_clp:       maxContrato12m,
    ticket_promedio_clp:        ticketProm,
    win_rate_pct:               winRate,
    licit_participadas:         licitComp.length,
    licit_ganadas:              licitGanadas.length,
    competidores_frecuentes:    competidores,
    oportunidades_abiertas:     null,
    oc_procesadas:              allOC.length,
  }

  const { error: dbErr } = await supabase
    .from('chilecompra_metricas')
    .upsert(row, { onConflict: 'rut,calculado_al' })

  if (dbErr) {
    console.error('[chilecompra-calcular] DB upsert error:', dbErr)
    return json({ error: 'Error guardando métricas', detail: dbErr.message }, 500)
  }

  console.log(`[chilecompra-calcular] OK — RUT ${rutNorm} al ${calculadoAl} — ${allOC.length} OC procesadas`)
  return json({ ...row, _cached: false })
})
