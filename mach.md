# Estudio de Mercado — ValidateAI
## Plan de implementación completo (Chile v1)

> **Contexto:** Este documento describe la implementación de la feature `/market` en ValidateAI.
> Stack: React 19 + Vite + TypeScript + Supabase + Tailwind v4 + shadcn/ui + Zustand v5.
> Todo el trabajo va dentro de `validateai/`.

---

## Resumen del flujo

```
idea del usuario (description + industry)
        │
        ▼
[INE API] clasificar texto → código CAENES (sector económico)
        │
        ▼
[BCCh BDE API] series de tiempo del sector → datos económicos reales
        │
        ▼
[Claude] analizar datos → insights estructurados (JSON)
        │
        ▼
[Supabase DB] guardar con caché para no re-llamar APIs
        │
        ▼
[Frontend /market] mostrar estudio con Recharts + mapa de zonas
```

---

## APIs disponibles

### Banco Central de Chile (BDE)

- **Base URL:** `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx`
- **Auth:** query params `user` y `pass` (credenciales propias ya habilitadas)
- **Método principal:** `GetSeries`

```
GET ?user=USER&pass=PASS&function=GetSeries&timeseries=SERIE_ID&firstdate=YYYY-MM-DD&lastdate=YYYY-MM-DD
```

Respuesta:
```json
{
  "Codigo": 0,
  "Descripcion": "Success",
  "Series": {
    "descripEsp": "Nombre de la serie",
    "seriesId": "F033.PIB.PIB.TOT.A",
    "Obs": [
      { "indexDateString": "01-01-2023", "value": "1234.5", "statusCode": "OK" }
    ]
  }
}
```

- **Método catálogo:** `SearchSeries` — frequency: `DAILY | MONTHLY | QUARTERLY | ANNUAL`
- **Variables de entorno necesarias:** `BDE_USER`, `BDE_PASS`

### INE — API de codificación automática

- **Base URL:** `https://rapps.ine.cl:9292`
- **Endpoint:** `POST /predict`
- **Sin autenticación** — API pública

```json
// Request
{ "text": "aplicación móvil servicios financieros", "classification": "caenes", "digits": 1 }

// Response
[{ "cod_final": "K", "prob": 0.91 }]
```

**Clasificadores disponibles:**
- `caenes` — sector económico (letras A–S, 1 o 2 dígitos)
- `ciuo` — ocupación

**Uso en ValidateAI:** clasificar la `idea_description` + `industry` del usuario para identificar el sector CAENES y así saber qué series del BCCh son relevantes.

---

## Series BCCh por sector CAENES

Estas son las series a usar según el código CAENES que devuelva el INE. Son series **anuales de PIB por actividad**.

| CAENES | Sector | Serie BCCh |
|--------|--------|-----------|
| A | Agricultura | `F033.PIB.PIB.010.A` |
| B | Minería | `F033.PIB.PIB.020.A` |
| C | Manufactura | `F033.PIB.PIB.030.A` |
| D | Electricidad/Gas | `F033.PIB.PIB.040.A` |
| F | Construcción | `F033.PIB.PIB.060.A` |
| G | Comercio | `F033.PIB.PIB.070.A` |
| H | Transporte | `F033.PIB.PIB.080.A` |
| I | Turismo/Alojamiento | `F033.PIB.PIB.090.A` |
| J | Información/Telecom | `F033.PIB.PIB.100.A` |
| K | Actividades Financieras | `F033.PIB.PIB.110.A` |
| L | Inmobiliario | `F033.PIB.PIB.120.A` |
| M | Profesional/Técnico | `F033.PIB.PIB.130.A` |
| N | Servicios administrativos | `F033.PIB.PIB.160.A` |
| P | Educación | `F033.PIB.PIB.170.A` |
| Q | Salud | `F033.PIB.PIB.180.A` |

**Series macro siempre incluidas (independiente del sector):**

| Serie | Descripción | Frecuencia |
|-------|-------------|-----------|
| `F073.IPC.IPC.IND.Z.Z.M` | IPC mensual | MONTHLY |
| `F033.PIB.PIB.TOT.A` | PIB total Chile | ANNUAL |
| `F026.DESE.DESE.M` | Tasa desempleo | MONTHLY |

> ⚠️ **Nota importante:** Los IDs de series deben validarse contra el catálogo oficial antes de hacer deploy.
> Descargar catálogo: `https://si3.bcentral.cl/estadisticas/Principal1/Web_Services/Webservices/series.xlsx`
> Si alguna serie retorna `Codigo !== 0`, ignorarla y continuar con las demás.

---

## Paso 1 — Migración SQL

Crear archivo `supabase/migrations/20260426_market_study.sql`:

```sql
-- ──────────────────────────────────────────────────────────────
-- TABLA 1: Caché de clasificaciones INE
-- ──────────────────────────────────────────────────────────────
create table if not exists market_ine_classifications (
  id            uuid primary key default gen_random_uuid(),
  input_text    text not null,
  caenes_code   text not null,
  caenes_prob   numeric,
  ciuo_code     text,
  ciuo_prob     numeric,
  classified_at timestamptz default now()
);

create index if not exists idx_ine_class_input
  on market_ine_classifications(input_text);

-- ──────────────────────────────────────────────────────────────
-- TABLA 2: Caché de series BCCh
-- ──────────────────────────────────────────────────────────────
create table if not exists market_bde_data (
  id          uuid primary key default gen_random_uuid(),
  series_id   text not null,
  series_desc text,
  obs_date    date not null,
  value       numeric,
  fetched_at  timestamptz default now(),
  unique(series_id, obs_date)
);

create index if not exists idx_bde_series_date
  on market_bde_data(series_id, obs_date desc);

-- ──────────────────────────────────────────────────────────────
-- TABLA 3: Insights de mercado por validación
-- ──────────────────────────────────────────────────────────────
create table if not exists market_ai_insights (
  id            uuid primary key default gen_random_uuid(),
  validation_id uuid references validations(id) on delete cascade,
  caenes_code   text,
  zone          text default 'CL',
  insights_json jsonb,
  raw_series    jsonb,
  generated_at  timestamptz default now(),
  unique(validation_id)
);

create index if not exists idx_market_insights_validation
  on market_ai_insights(validation_id);

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────
alter table market_ine_classifications enable row level security;
alter table market_bde_data enable row level security;
alter table market_ai_insights enable row level security;

-- Datos macro: lectura pública (son datos del BCCh, no privados)
create policy "public read bde"
  on market_bde_data for select using (true);

create policy "public read ine"
  on market_ine_classifications for select using (true);

-- Edge Functions pueden insertar/upsert (service role bypasses RLS)

-- Insights: solo el dueño de la validación puede leer
create policy "owner read insights"
  on market_ai_insights for select
  using (
    validation_id in (
      select id from validations where user_id = auth.uid()
    )
  );
```

---

## Paso 2 — Edge Function `market-analyze`

Crear `supabase/functions/market-analyze/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.1'

// ── Constantes ────────────────────────────────────────────────
const BDE_USER = Deno.env.get('lucianoalonso2000@gmail.com')!
const BDE_PASS = Deno.env.get('6691576aA')!
const BDE_BASE = 'https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx'
const INE_BASE = 'https://rapps.ine.cl:9292'

const SECTOR_SERIES: Record<string, { id: string; label: string }[]> = {
  'A': [{ id: 'F033.PIB.PIB.010.A', label: 'PIB Agricultura' }],
  'B': [{ id: 'F033.PIB.PIB.020.A', label: 'PIB Minería' }],
  'C': [{ id: 'F033.PIB.PIB.030.A', label: 'PIB Manufactura' }],
  'D': [{ id: 'F033.PIB.PIB.040.A', label: 'PIB Electricidad/Gas' }],
  'F': [{ id: 'F033.PIB.PIB.060.A', label: 'PIB Construcción' }],
  'G': [{ id: 'F033.PIB.PIB.070.A', label: 'PIB Comercio' }],
  'H': [{ id: 'F033.PIB.PIB.080.A', label: 'PIB Transporte' }],
  'I': [{ id: 'F033.PIB.PIB.090.A', label: 'PIB Turismo/Alojamiento' }],
  'J': [{ id: 'F033.PIB.PIB.100.A', label: 'PIB Información/Telecom' }],
  'K': [{ id: 'F033.PIB.PIB.110.A', label: 'PIB Actividades Financieras' }],
  'L': [{ id: 'F033.PIB.PIB.120.A', label: 'PIB Inmobiliario' }],
  'M': [{ id: 'F033.PIB.PIB.130.A', label: 'PIB Profesional/Técnico' }],
  'N': [{ id: 'F033.PIB.PIB.160.A', label: 'PIB Servicios' }],
  'P': [{ id: 'F033.PIB.PIB.170.A', label: 'PIB Educación' }],
  'Q': [{ id: 'F033.PIB.PIB.180.A', label: 'PIB Salud' }],
}

const MACRO_SERIES = [
  { id: 'F073.IPC.IPC.IND.Z.Z.M', label: 'IPC mensual' },
  { id: 'F033.PIB.PIB.TOT.A',     label: 'PIB total Chile' },
  { id: 'F026.DESE.DESE.M',       label: 'Tasa desempleo' },
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helpers ───────────────────────────────────────────────────

/** Convierte DD-MM-YYYY → YYYY-MM-DD */
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

// ── Handler principal ─────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { idea_description, industry, validation_id } = await req.json()

    if (!idea_description || !industry || !validation_id) {
      return new Response(
        JSON.stringify({ error: 'idea_description, industry y validation_id son requeridos' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── PASO 1: Verificar si ya existe un insight para esta validación ──
    const { data: existingInsight } = await supabase
      .from('market_ai_insights')
      .select('insights_json, caenes_code')
      .eq('validation_id', validation_id)
      .maybeSingle()

    if (existingInsight) {
      return new Response(
        JSON.stringify({ caenes: existingInsight.caenes_code, insights: existingInsight.insights_json, cached: true }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ── PASO 2: Clasificar con INE (con caché en DB) ──────────────────
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
          input_text: inputText,
          caenes_code: caenes,
          caenes_prob: prob,
        })
      } catch (err) {
        console.error('INE API error, usando fallback G:', err)
        caenes = 'G' // fallback: Comercio
      }
    }

    // ── PASO 3: Fetch series BCCh ────────────────────────────────────
    const sectorSeries = SECTOR_SERIES[caenes] ?? SECTOR_SERIES['G']
    const allSeries = [...sectorSeries, ...MACRO_SERIES]
    const { today, fiveYearsAgo } = getDateRange()

    const bdeResults = await Promise.all(
      allSeries.map(async ({ id, label }) => {
        // Verificar caché DB
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

        // Fetch desde BCCh
        try {
          const url = new URL(BDE_BASE)
          url.searchParams.set('user', BDE_USER)
          url.searchParams.set('pass', BDE_PASS)
          url.searchParams.set('function', 'GetSeries')
          url.searchParams.set('timeseries', id)
          url.searchParams.set('firstdate', fiveYearsAgo)
          url.searchParams.set('lastdate', today)

          const res = await fetch(url.toString())
          const json = await res.json()

          if (json.Codigo !== 0 || !json.Series?.Obs) {
            console.warn(`Serie ${id} no disponible:`, json.Descripcion)
            return { id, label, obs: [] }
          }

          const obs = json.Series.Obs
            .filter((o: any) => o.statusCode === 'OK' && o.value !== 'NaN')
            .map((o: any) => ({
              obs_date: bdeToIso(o.indexDateString),
              value: parseFloat(o.value),
            }))

          // Guardar en caché
          if (obs.length > 0) {
            await supabase.from('market_bde_data').upsert(
              obs.map((o: any) => ({ series_id: id, series_desc: label, ...o })),
              { onConflict: 'series_id,obs_date' }
            )
          }

          return { id, label, obs: obs.slice(-8) }
        } catch (err) {
          console.error(`Error fetching serie ${id}:`, err)
          return { id, label, obs: [] }
        }
      })
    )

    // ── PASO 4: Analizar con Claude ──────────────────────────────────
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const seriesSummary = bdeResults
      .filter(r => r.obs.length > 0)
      .map(r => {
        const pts = r.obs.map((o: any) => `${o.obs_date}: ${o.value}`).join(' | ')
        return `${r.label}: ${pts}`
      })
      .join('\n')

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Eres un analista de mercado experto en Chile. Analiza los datos del Banco Central de Chile (BCCh) para una startup en el sector "${industry}" (código CAENES: ${caenes}).

DATOS BCCh (series de tiempo reales):
${seriesSummary || 'Sin datos disponibles — usar conocimiento general del sector en Chile'}

Responde SOLO con este JSON (sin texto adicional, sin bloques de código markdown):
{
  "sector_name": "nombre del sector en Chile",
  "caenes_code": "${caenes}",
  "trend": "creciente" | "estable" | "decreciente",
  "trend_description": "1-2 oraciones sobre la tendencia basada en los datos",
  "trend_pct": número (variación % anual aproximada, puede ser negativo),
  "key_metrics": [
    { "label": "Tamaño del sector", "value": "X.X MMM CLP", "context": "..." },
    { "label": "Crecimiento anual", "value": "X.X%", "context": "..." },
    { "label": "Desempleo sectorial", "value": "X.X%", "context": "..." }
  ],
  "tam_clp": número en millones de CLP,
  "sam_clp": número en millones de CLP (mercado accesible en Chile),
  "tam_description": "metodología de estimación del TAM",
  "opportunities": ["oportunidad 1", "oportunidad 2", "oportunidad 3"],
  "risks": ["riesgo 1", "riesgo 2", "riesgo 3"],
  "chile_context": "contexto específico de Chile para este sector: regulación, cultura de consumo, geografía, concentración en RM vs regiones"
}`,
      }],
    })

    let insights: Record<string, unknown>
    try {
      const raw = completion.content[0].type === 'text' ? completion.content[0].text : '{}'
      // Limpiar si Claude envuelve en ```json
      const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      insights = JSON.parse(clean)
    } catch (err) {
      console.error('Error parseando JSON de Claude:', err)
      insights = { error: 'parse_failed', caenes_code: caenes }
    }

    // ── PASO 5: Persistir en DB ──────────────────────────────────────
    await supabase.from('market_ai_insights').upsert({
      validation_id,
      caenes_code: caenes,
      zone: 'CL',
      insights_json: insights,
      raw_series: bdeResults.map(r => ({
        id: r.id,
        label: r.label,
        points: r.obs.length,
        latest: r.obs[0] ?? null,
      })),
    }, { onConflict: 'validation_id' })

    return new Response(
      JSON.stringify({ caenes, insights }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('market-analyze error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## Paso 3 — Variables de entorno

En el dashboard de Supabase → **Settings → Edge Functions → Secrets**, agregar:

```
BDE_USER    = el email registrado en BCCh BDE
BDE_PASS    = la contraseña de BCCh BDE
```

Las existentes `ANTHROPIC_API_KEY`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya deben estar.

---

## Paso 4 — Types TypeScript

Crear `src/types/market.ts`:

```typescript
export interface MarketInsights {
  sector_name: string
  caenes_code: string
  trend: 'creciente' | 'estable' | 'decreciente'
  trend_description: string
  trend_pct: number
  key_metrics: {
    label: string
    value: string
    context: string
  }[]
  tam_clp: number
  sam_clp: number
  tam_description: string
  opportunities: string[]
  risks: string[]
  chile_context: string
  error?: string
}

export interface MarketAnalysisResult {
  caenes: string
  insights: MarketInsights
  cached?: boolean
}
```

---

## Paso 5 — Hook `useMarketAnalysis`

Crear `src/hooks/useMarketAnalysis.ts`:

```typescript
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { MarketInsights } from '@/types/market'

interface UseMarketAnalysisParams {
  validationId: string | null
  ideaDescription: string | null
  industry: string | null
}

export function useMarketAnalysis({
  validationId,
  ideaDescription,
  industry,
}: UseMarketAnalysisParams) {
  const [data, setData] = useState<MarketInsights | null>(null)
  const [caenes, setCaenes] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!validationId || !ideaDescription || !industry) return

    setLoading(true)
    setError(null)

    // Primero verificar caché en DB
    supabase
      .from('market_ai_insights')
      .select('insights_json, caenes_code')
      .eq('validation_id', validationId)
      .maybeSingle()
      .then(({ data: cached, error: dbErr }) => {
        if (dbErr) {
          console.error('DB error:', dbErr)
        }

        if (cached?.insights_json) {
          setData(cached.insights_json as MarketInsights)
          setCaenes(cached.caenes_code)
          setLoading(false)
          return
        }

        // Generar via Edge Function
        supabase.functions
          .invoke('market-analyze', {
            body: {
              idea_description: ideaDescription,
              industry,
              validation_id: validationId,
            },
          })
          .then(({ data: res, error: fnErr }) => {
            if (fnErr) {
              setError(fnErr.message)
            } else if (res?.insights) {
              setData(res.insights as MarketInsights)
              setCaenes(res.caenes)
            }
          })
          .catch((err) => setError(String(err)))
          .finally(() => setLoading(false))
      })
  }, [validationId, ideaDescription, industry])

  return { data, caenes, loading, error }
}
```

---

## Paso 6 — Ruta `/market`

Agregar en `src/App.tsx` (dentro del bloque de rutas protegidas):

```tsx
import MarketStudy from './app/routes/MarketStudy'

// Dentro de <Routes>, junto a /results, /history, etc.
<Route path="/market/:validationId" element={<MarketStudy />} />
```

Crear `src/app/routes/MarketStudy.tsx`:

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMarketAnalysis } from '@/hooks/useMarketAnalysis'
import { MarketInsights } from '@/types/market'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const TREND_CONFIG = {
  creciente:   { icon: TrendingUp,   color: 'text-green-600',  badge: 'default' },
  estable:     { icon: Minus,        color: 'text-yellow-600', badge: 'secondary' },
  decreciente: { icon: TrendingDown, color: 'text-red-600',    badge: 'destructive' },
} as const

function formatClp(millions: number): string {
  if (millions >= 1_000_000) return `${(millions / 1_000_000).toFixed(1)} B CLP`
  if (millions >= 1_000)     return `${(millions / 1_000).toFixed(1)} MM CLP`
  return `${millions.toFixed(0)} M CLP`
}

export default function MarketStudy() {
  const { validationId } = useParams<{ validationId: string }>()
  const navigate = useNavigate()
  const [ideaDescription, setIdeaDescription] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)

  // Cargar datos de la validación
  useEffect(() => {
    if (!validationId) return
    supabase
      .from('validations')
      .select('idea_description, idea_industry')
      .eq('id', validationId)
      .single()
      .then(({ data }) => {
        if (data) {
          setIdeaDescription(data.idea_description)
          setIndustry(data.idea_industry)
        }
      })
  }, [validationId])

  const { data, caenes, loading, error } = useMarketAnalysis({
    validationId: validationId ?? null,
    ideaDescription,
    industry,
  })

  const TrendIcon = data ? TREND_CONFIG[data.trend]?.icon ?? Minus : Minus

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Estudio de mercado</h1>
            <p className="text-muted-foreground text-sm">Chile · Datos BCCh + INE</p>
          </div>
          {data && (
            <Badge variant="outline" className="ml-auto">
              Sector CAENES: {caenes}
            </Badge>
          )}
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive mb-6">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">Error al cargar el estudio: {error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3 w-3 mr-2" /> Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64 w-full" />
            <p className="text-center text-sm text-muted-foreground animate-pulse">
              Consultando Banco Central de Chile e INE…
            </p>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <div className="space-y-6">

            {/* Hero card — tendencia */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{data.sector_name}</p>
                    <h2 className="text-xl font-semibold mb-2">{data.trend_description}</h2>
                    <div className="flex items-center gap-2">
                      <TrendIcon className={`h-4 w-4 ${TREND_CONFIG[data.trend]?.color}`} />
                      <span className={`font-medium ${TREND_CONFIG[data.trend]?.color}`}>
                        {data.trend_pct > 0 ? '+' : ''}{data.trend_pct}% anual
                      </span>
                      <Badge variant={TREND_CONFIG[data.trend]?.badge as any}>
                        {data.trend}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Métricas clave */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {data.key_metrics.map((m, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-2xl font-semibold my-1">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.context}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* TAM / SAM */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tamaño de mercado</CardTitle>
                <p className="text-xs text-muted-foreground">{data.tam_description}</p>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'TAM', value: data.tam_clp },
                      { name: 'SAM', value: data.sam_clp },
                    ]} barSize={60}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis
                        tickFormatter={(v) => formatClp(v)}
                        axisLine={false}
                        tickLine={false}
                        width={90}
                      />
                      <Tooltip formatter={(v: number) => formatClp(v)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">TAM — Mercado total</p>
                    <p className="font-semibold">{formatClp(data.tam_clp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SAM — Mercado accesible (Chile)</p>
                    <p className="font-semibold">{formatClp(data.sam_clp)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Oportunidades y riesgos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-green-700 dark:text-green-400">
                    Oportunidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.opportunities.map((op, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        {op}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-700 dark:text-red-400">
                    Riesgos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Contexto Chile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contexto chileno</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.chile_context}</p>
              </CardContent>
            </Card>

            {/* Footer fuentes */}
            <p className="text-xs text-center text-muted-foreground">
              Datos: Banco Central de Chile (BDE) · INE · Análisis: Claude (Anthropic)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Paso 7 — Entrada desde Results.tsx

En `src/app/routes/Results.tsx`, agregar un botón que lleve al estudio. Buscar el bloque donde se muestran los CTAs principales y agregar:

```tsx
import { useNavigate } from 'react-router-dom'
import { BarChart2 } from 'lucide-react'

// Dentro del componente, donde ya tenés el validationId:
const navigate = useNavigate()

// En el JSX, junto a otros botones de acción:
<Button
  variant="outline"
  onClick={() => navigate(`/market/${validationId}`)}
  className="flex items-center gap-2"
>
  <BarChart2 className="h-4 w-4" />
  Ver estudio de mercado Chile
</Button>
```

---

## Checklist de implementación

```
[ ] 1. Ejecutar migración SQL en Supabase (dashboard o CLI)
[ ] 2. Crear supabase/functions/market-analyze/index.ts
[ ] 3. Agregar BDE_USER y BDE_PASS en Secrets de Edge Functions
[ ] 4. Deploy Edge Function: supabase functions deploy market-analyze
[ ] 5. Crear src/types/market.ts
[ ] 6. Crear src/hooks/useMarketAnalysis.ts
[ ] 7. Crear src/app/routes/MarketStudy.tsx
[ ] 8. Agregar ruta /market/:validationId en App.tsx
[ ] 9. Agregar botón en Results.tsx apuntando a /market/:validationId
[ ] 10. Verificar que las series BCCh responden (testear manualmente 2-3 IDs)
[ ] 11. Smoke test completo: idea → clasificar → datos → insights → UI
```

---

## Validación manual de series BCCh (antes de deploy)

Probar en el browser o con curl reemplazando credenciales:

```
https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=TU_USER&pass=TU_PASS&function=GetSeries&timeseries=F033.PIB.PIB.TOT.A&firstdate=2020-01-01&lastdate=2024-12-31
```

Si `Codigo` es `0` y hay `Obs`, el ID es válido. Si no, buscar el ID correcto en:
`https://si3.bcentral.cl/estadisticas/Principal1/Web_Services/Webservices/series.xlsx`

---

## Notas para Claude Code

- No modificar las Edge Functions existentes (`ai-validate`). La nueva función `market-analyze` es independiente.
- El campo `idea_description` viene de `validations.idea_description` y `idea_industry` de `validations.idea_industry`. Verificar que estos campos existan en el schema actual antes de la query en `MarketStudy.tsx`.
- Si `idea_description` es null (deuda técnica conocida del Step 1), usar el campo `idea_name` como fallback en el hook.
- Los componentes de shadcn/ui usados (`Card`, `Badge`, `Button`, `Skeleton`) deben estar instalados. Si falta alguno: `npx shadcn@latest add [componente]`.
- Recharts ya está en el proyecto (`recharts v3` según el stack).
- La ruta `/market/:validationId` debe ser protegida (igual que `/results`).
