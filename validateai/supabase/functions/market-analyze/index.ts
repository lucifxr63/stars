import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BDE_USER = Deno.env.get('BDE_USER')!
const BDE_PASS = Deno.env.get('BDE_PASS')!
const BDE_BASE = 'https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx'
const INE_BASE = 'https://rapps.ine.cl:9292'

// IDs validados contra el catálogo BCCh real.
// Sector-specific: pendiente de validación (buscar con SearchSeries&searchParam=IMACEC).
// NOTE: This is currently empty and serves as a placeholder. We are only using macro series 
// to avoid errors fetching unverified or unstable sector-specific indices from BCCh.
const SECTOR_SERIES: Record<string, { id: string; label: string }[]> = {}

const MACRO_SERIES = [
  { id: 'G073.IPC.IND.2023.M',  label: 'IPC General (base 2023)' },   // validado ✓
  { id: 'G073.IPC.V12.2023.M',  label: 'IPC variación anual' },        // validado ✓
]

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function bdeToIso(dateStr: string): string {
  const [d, m, y] = dateStr.split('-')
  return `${y}-${m}-${d}`
}

function getDateRange() {
  const today = new Date().toISOString().split('T')[0]
  const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  return { today, fiveYearsAgo }
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { idea_description, industry, validation_id } = await req.json()

    if (!idea_description || !industry || !validation_id) {
      return new Response(
        JSON.stringify({ error: 'idea_description, industry y validation_id son requeridos' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ── Middleware Ley 21.719 (Consentimiento) ──────────────────────────────────
    const { data: consent } = await supabase
      .from('consent_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('flagged', true)
      .limit(1)
      .maybeSingle()

    if (!consent) {
      return new Response(JSON.stringify({ 
        error: 'consent_required', 
        message: 'Debe aceptar los términos de la Ley 21.719 para continuar.' 
      }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Rate limit: 10 calls/día por usuario ─────────────────────────────────
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const { count: callsToday } = await supabase
      .from('market_ai_insights')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())
    if ((callsToday ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: 'rate_limit', message: 'Límite diario de análisis de mercado alcanzado.' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── PASO 1: Verificar caché ───────────────────────────────────────
    const { data: existingInsight } = await supabase
      .from('market_ai_insights')
      .select('insights_json, caenes_code, raw_series')
      .eq('validation_id', validation_id)
      .maybeSingle()

    if (existingInsight) {
      return new Response(
        JSON.stringify({
          caenes: existingInsight.caenes_code,
          insights: existingInsight.insights_json,
          raw_series: existingInsight.raw_series,
          cached: true,
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // ── PASO 2: Clasificar con INE ────────────────────────────────────
    const inputText = `${industry} ${idea_description}`.toLowerCase().slice(0, 300)

    const { data: cachedClass } = await supabase
      .from('market_ine_classifications')
      .select('caenes_code')
      .eq('input_text', inputText)
      .maybeSingle()

    let caenes = cachedClass?.caenes_code

    if (!caenes) {
      try {
        const ineRes = await fetch(`${INE_BASE}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText, classification: 'caenes', digits: 1 }),
        })
        const ineData = await ineRes.json()
        caenes = ineData[0]?.cod_final ?? 'G'
        const prob = ineData[0]?.prob ?? 0
        await supabase.from('market_ine_classifications').insert({
          input_text: inputText, caenes_code: caenes, caenes_prob: prob,
        })
      } catch (err) {
        console.error('INE API error, fallback G:', err)
        caenes = 'G'
      }
    }

    // ── PASO 3: Fetch series BCCh + datos del wizard en paralelo ─────
    const sectorSeries = SECTOR_SERIES[caenes] ?? []
    const allSeries = [...sectorSeries, ...MACRO_SERIES]
    const { today, fiveYearsAgo } = getDateRange()

    const [bdeResults, validationData, competitiveData, chileAbiertoContext, mercadoPublicoContext, dataWarnings] = await (async () => {
      const bdePromises = allSeries.map(async ({ id, label }) => {
        const { data: cached } = await supabase
          .from('market_bde_data')
          .select('obs_date, value')
          .eq('series_id', id)
          .gte('obs_date', fiveYearsAgo)
          .order('obs_date', { ascending: false })
          .limit(10)

        if (cached && cached.length >= 3) {
          return { id, label, obs: cached, fromCache: true }
        }

        const url = new URL(BDE_BASE)
        url.searchParams.set('user', BDE_USER)
        url.searchParams.set('pass', BDE_PASS)
        url.searchParams.set('function', 'GetSeries')
        url.searchParams.set('timeseries', id)
        url.searchParams.set('firstdate', fiveYearsAgo)
        url.searchParams.set('lastdate', today)

        const res = await fetch(url.toString())
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()

        if (json.Codigo !== 0 || !json.Series?.Obs) {
          throw new Error(`BCCh Code ${json.Codigo}: ${json.Descripcion}`)
        }

        const obs = json.Series.Obs
          .filter((o: any) => o.statusCode === 'OK' && o.value !== 'NaN')
          .map((o: any) => ({
            obs_date: bdeToIso(o.indexDateString),
            value: parseFloat(o.value),
          }))

        if (obs.length > 0) {
          await supabase.from('market_bde_data').upsert(
            obs.map((o: any) => ({ series_id: id, series_desc: label, ...o })),
            { onConflict: 'series_id,obs_date' }
          )
        }
        return { id, label, obs: obs.slice(-8) }
      })

      const validationPromise = supabase
        .from('validations')
        .select('customer_segment, customer_pain_points, customer_context, value_proposition, differentiator, mvp_type')
        .eq('id', validation_id)
        .maybeSingle()
        .then(({ data, error }) => { if (error) throw error; return data })

      const competitivePromise = supabase
        .from('ai_interactions')
        .select('output_data')
        .eq('validation_id', validation_id)
        .eq('prompt_type', 'competitive_analysis')
        .maybeSingle()
        .then(({ data, error }) => { if (error) throw error; return data?.output_data ?? null })

      const chileAbiertoPromise = fetch('https://chileabierto.cl/api/v1/comunas/13101')
        .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })

      const mercadoPublicoPromise = fetch('https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=activas')
        .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })

      const settled = await Promise.allSettled([
        Promise.allSettled(bdePromises),
        validationPromise,
        competitivePromise,
        chileAbiertoPromise,
        mercadoPublicoPromise
      ])

      const warnings: string[] = []

      const bdeSettledResult = settled[0]
      let bdeRes: any[] = []
      if (bdeSettledResult.status === 'fulfilled') {
        bdeRes = bdeSettledResult.value.map((res, i) => {
          if (res.status === 'fulfilled') return res.value
          warnings.push(`Serie BCCh ${allSeries[i].id} falló: ${res.reason?.message ?? res.reason}`)
          return { id: allSeries[i].id, label: allSeries[i].label, obs: [] }
        })
      } else {
        warnings.push('Fallo catastrófico obteniendo series BCCh')
      }

      const valData = settled[1].status === 'fulfilled' ? settled[1].value : null
      if (settled[1].status === 'rejected') warnings.push('Validations DB falló: ' + settled[1].reason)

      const compData = settled[2].status === 'fulfilled' ? settled[2].value : null
      if (settled[2].status === 'rejected') warnings.push('Competitive AI Data DB falló: ' + settled[2].reason)

      let caCtx = ''
      if (settled[3].status === 'fulfilled') {
        const caData = settled[3].value
        caCtx = `\nDATOS COMUNALES RELEVANTES (Chile Abierto - ${caData.comuna?.name ?? 'Santiago'}):\n`
        if (caData.indicators) {
          caCtx += caData.indicators.slice(0, 5).map((i: any) => `- ${i.name_es}: ${i.value} ${i.unit}`).join('\n')
        }
      } else {
        warnings.push('API Chile Abierto falló: ' + (settled[3].reason?.message || settled[3].reason))
      }

      let mpCtx = ''
      if (settled[4].status === 'fulfilled') {
        mpCtx = `\nMERCADO PÚBLICO (Licitaciones activas):\nSe detectó conectividad B2G exitosa.`
      } else {
        warnings.push('API Mercado Público falló: ' + (settled[4].reason?.message || settled[4].reason))
      }

      return [bdeRes, valData, compData, caCtx, mpCtx, warnings] as const
    })()

    // ── PASO 4: Construir contexto y prompt ──────────────────────────
    const seriesSummary = bdeResults
      .filter(r => r.obs.length > 0)
      .map(r => {
        const pts = r.obs.map((o: any) => `${o.obs_date}: ${o.value}`).join(' | ')
        return `${r.label}: ${pts}`
      })
      .join('\n')

    const wizardContext = validationData ? `
CONTEXTO ESPECÍFICO DE LA IDEA:
- Segmento objetivo: ${validationData.customer_segment ?? 'no especificado'}
- Pain points: ${(validationData.customer_pain_points ?? []).join(', ') || 'no especificados'}
- Contexto del cliente: ${validationData.customer_context ?? 'no especificado'}
- Propuesta de valor: ${validationData.value_proposition ?? 'no especificada'}
- Diferenciador: ${validationData.differentiator ?? 'no especificado'}
- Tipo de MVP: ${validationData.mvp_type ?? 'no especificado'}` : ''

    const competitiveContext = competitiveData ? `
COMPETIDORES IDENTIFICADOS (análisis previo con web_search):
${JSON.stringify(competitiveData).slice(0, 1500)}` : ''

    const seriesWithData = bdeResults.filter(r => r.obs.length > 0).length
    const totalSeries = bdeResults.length
    const dataConfidence = Math.round((seriesWithData / totalSeries) * 100)

    const prompt = `Eres un analista de mercado experto en Chile. Analiza el mercado para una startup en el sector "${industry}" (código CAENES: ${caenes}).

DATOS BCCh REALES (${seriesWithData}/${totalSeries} series con datos — confianza: ${dataConfidence}%):
${seriesSummary || 'Sin datos disponibles del BCCh — usar conocimiento general del sector en Chile'}
${wizardContext}
${competitiveContext}
${chileAbiertoContext}
${mercadoPublicoContext}

Responde SOLO con este JSON (sin texto adicional, sin markdown):
{
  "sector_name": "nombre del sector en Chile",
  "caenes_code": "${caenes}",
  "data_confidence": ${dataConfidence},
  "trend": "creciente" | "estable" | "decreciente",
  "trend_description": "2-3 oraciones sobre la tendencia basada en los datos",
  "trend_pct": número (variación % anual aproximada, puede ser negativo),
  "key_metrics": [
    { "label": "Tamaño del sector", "value": "X.X MMM CLP", "context": "..." },
    { "label": "Crecimiento anual", "value": "X.X%", "context": "..." },
    { "label": "Desempleo sectorial", "value": "X.X%", "context": "..." }
  ],
  "tam_clp": número en millones de CLP,
  "sam_clp": número en millones de CLP (mercado accesible en Chile para esta idea específica),
  "tam_description": "metodología de estimación del TAM y SAM",
  "entry_barriers": ["barrera 1", "barrera 2", "barrera 3"],
  "regulation": "descripción de regulación relevante en Chile para este sector (SVS, CMF, Minsal, SII, etc.)",
  "key_players": [
    { "name": "nombre empresa", "type": "incumbente" | "startup" | "internacional", "notes": "..." }
  ],
  "seasonality": "descripción de estacionalidad del sector en Chile (si aplica) o 'Sin estacionalidad relevante'",
  "idea_fit": "análisis de qué tan bien encaja esta idea específica en el contexto del mercado chileno, basado en su segmento, pain points y propuesta de valor",
  "opportunities": ["oportunidad 1", "oportunidad 2", "oportunidad 3"],
  "risks": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "chile_context": "contexto específico de Chile: regulación, cultura de consumo, geografía, concentración RM vs regiones"
}`

    // ── PASO 5: Llamar GPT-4o-mini ────────────────────────────────────
    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!oaiRes.ok) {
      const errText = await oaiRes.text()
      throw new Error(`OpenAI API error ${oaiRes.status}: ${errText}`)
    }

    const oaiData = await oaiRes.json()
    let insights: Record<string, unknown>
    try {
      insights = JSON.parse(oaiData.choices?.[0]?.message?.content ?? '{}')
    } catch (err) {
      console.error('Error parseando JSON de OpenAI:', err)
      insights = { error: 'parse_failed', caenes_code: caenes }
    }

    // ── PASO 6: Persistir ─────────────────────────────────────────────
    const rawSeriesPayload = bdeResults.map(r => ({
      id: r.id,
      label: r.label,
      points: r.obs.length,
      obs: r.obs.slice(-8),
      latest: r.obs[0] ?? null,
    }))

    await supabase.from('market_ai_insights').upsert({
      validation_id,
      caenes_code: caenes,
      zone: 'CL',
      insights_json: insights,
      raw_series: rawSeriesPayload,
    }, { onConflict: 'validation_id' })

    return new Response(
      JSON.stringify({ caenes, insights, raw_series: rawSeriesPayload, dataWarnings }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('market-analyze error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
