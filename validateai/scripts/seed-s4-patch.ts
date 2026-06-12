/**
 * S4 Patch — Cierra las dos brechas identificadas en el audit S3:
 *   1. Sanciones CMF (legal — miss en keyword "sanción")
 *   2. Análisis de Cohortes (methodology — 0 chunks retrieved)
 *
 * Uso: npx tsx scripts/seed-s4-patch.ts
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const PATCH_DOCS = [
  // ── BRECHA 1: Sanciones CMF ─────────────────────────────────────────────────
  {
    title: 'CMF — Régimen Sancionatorio para Fintechs (Ley 21.521 Art. 46-52)',
    source: 'Ley 21.521 — Capítulo VIII / CMF Norma General',
    category: 'regulatory' as const,
    tags: ['cmf', 'sancion', 'multa', 'infraccion', 'ley-fintec', 'chile', 'regulacion'],
    content: `El Capítulo VIII de la Ley 21.521 establece el régimen sancionatorio aplicable a los prestadores de servicios fintech que operen sin inscripción o incumplan sus obligaciones regulatorias en Chile.

Artículo 46 — Infracciones graves: Constituyen infracciones graves: (a) operar como prestador de servicios fintech sin inscripción en el RPSF; (b) proporcionar información falsa o incompleta a la CMF; (c) incumplir los requisitos de capital mínimo; (d) vulnerar el deber de confidencialidad de datos de clientes.

Artículo 47 — Sanciones pecuniarias: La CMF puede aplicar las siguientes sanciones: (1) Amonestación por escrito. (2) Multa de hasta 10.000 UF (~$340 millones CLP) por infracción grave. (3) Multa de hasta 20.000 UF (~$680 millones CLP) por operación sin licencia o reincidencia. (4) Suspensión temporal de actividades por hasta 90 días. (5) Cancelación definitiva del registro (RPSF).

Artículo 48 — Operación sin licencia: Las personas naturales o jurídicas que presten servicios fintech regulados sin inscripción vigente cometen infracción muy grave. La CMF puede ordenar el cese inmediato de operaciones y aplicar multa de hasta 20.000 UF. Adicionalmente, los directores y gerentes de la entidad pueden ser sancionados individualmente con multas de hasta 5.000 UF.

Artículo 49 — Procedimiento sancionatorio: La CMF inicia el procedimiento mediante formulación de cargos. El infractor dispone de 15 días hábiles para presentar descargos. Tras la vista, la CMF dicta resolución fundada. Las sanciones son reclamables ante la Corte de Apelaciones de Santiago.

Artículo 50 — Graduación de sanciones: Para graduar la sanción, la CMF considera: (a) el beneficio económico obtenido, (b) el daño causado a clientes, (c) la conducta anterior del infractor, (d) la cooperación con la investigación, (e) las medidas correctivas adoptadas.

Artículo 51 — Publicidad de sanciones: Las resoluciones sancionatorias son públicas y se publican en el sitio web de la CMF. El Registro de Prestadores de Servicios Fintech (RPSF) refleja el estado de cada entidad, incluyendo sanciones vigentes.

Artículo 52 — Medidas provisionales: Ante riesgo inminente para clientes o el sistema financiero, la CMF puede ordenar medidas provisionales: suspensión de nuevas operaciones, designación de administrador provisional, bloqueo de cuentas de la entidad.

Multas CMF históricas de referencia: La CMF ha sancionado a entidades financieras no-fintech con multas de hasta 15.000 UF por infracciones a la ley de bancos. El umbral de 20.000 UF para fintechs es el más alto de la regulación sectorial chilena.`,
  },
  {
    title: 'CMF — Requisitos de Registro y Consecuencias de No Inscripción (RPSF)',
    source: 'CMF — Norma de Carácter General sobre Registro de Prestadores Fintech',
    category: 'regulatory' as const,
    tags: ['cmf', 'registro', 'rpsf', 'sancion', 'requisitos', 'inscripcion', 'chile'],
    content: `La Comisión para el Mercado Financiero (CMF) administra el Registro de Prestadores de Servicios Fintech (RPSF) conforme a la Ley 21.521 y las normas de carácter general derivadas.

Consecuencias de operar sin inscripción en el RPSF:
- Infracción muy grave según Art. 48 Ley 21.521
- Multa de hasta 20.000 UF (aprox. $680 millones CLP al valor UF 2024)
- Orden de cese inmediato de operaciones emitida por la CMF
- Publicación en el listado de entidades sancionadas del sitio CMF
- Responsabilidad personal de directores y gerentes: multas individuales hasta 5.000 UF
- Posible persecución penal si hay captación de fondos del público sin autorización (Ley General de Bancos Art. 39)

Proceso de inscripción RPSF:
1. Constitución legal como sociedad (SA o SpA recomendada)
2. Solicitud formal ante CMF con antecedentes técnicos y legales
3. Plan de negocios detallado con proyecciones financieras a 3 años
4. Manual de gestión de riesgos y ciberseguridad
5. Demostración de capital mínimo pagado (4.000 UF para crowdfunding; varía por tipo de servicio)
6. Plazo de resolución CMF: hasta 60 días hábiles
7. Inscripción provisional: permite operar mientras se resuelve la solicitud definitiva

Supervisión continua post-inscripción:
- Reportes trimestrales de actividad a la CMF
- Auditoría externa anual obligatoria
- Notificación inmediata de incidentes de ciberseguridad
- Mantenimiento de capital mínimo en todo momento
- La CMF puede requerir información adicional en cualquier momento

Fintechs exentas de inscripción RPSF: Las startups en etapa de prototipo o prueba de concepto (sin clientes reales ni manejo de fondos) no requieren inscripción. El umbral es la prestación habitual y remunerada del servicio.`,
  },

  // ── BRECHA 2: Análisis de Cohortes ─────────────────────────────────────────
  {
    title: 'Análisis de Cohortes para SaaS — Métricas de Retención y Churn',
    source: 'Guía de Unit Economics SaaS — Metodología Validus',
    category: 'methodology' as const,
    tags: ['cohort', 'cohorte', 'retencion', 'churn', 'saas', 'metricas', 'unit-economics'],
    content: `El análisis de cohortes es la metodología fundamental para medir retención real de usuarios en productos SaaS y startups de tecnología. Una cohorte es un grupo de usuarios que realizaron su primera acción (registro, pago, activación) en el mismo período.

¿Por qué cohortes y no métricas agregadas?
Las métricas agregadas (usuarios totales, revenue total) ocultan el comportamiento real. Un producto con churn del 20% mensual puede mostrar crecimiento de usuarios si adquiere más de lo que pierde. Las cohortes revelan si el producto retiene o expulsa usuarios.

Tipos de cohortes esenciales para SaaS:
1. Cohorte de retención por registro: % de usuarios de una cohorte que siguen activos N meses después
2. Cohorte de retención de revenue (Net Revenue Retention - NRR): % del revenue de una cohorte que se mantiene o expande
3. Cohorte de activación: % de usuarios que completan el "momento aha" dentro de los primeros 7 días

Métricas clave derivadas del análisis de cohortes:
- Churn mensual: % de usuarios de una cohorte que cancela cada mes (objetivo SaaS B2B: <2% mensual)
- Churn anual implícito: (1 - (1 - churn_mensual)^12) × 100
- Retención D7, D30, D90: % de usuarios activos a los 7, 30 y 90 días desde el registro
- Curva de retención: visualización de la retención de cada cohorte en el tiempo
- LTV implícito por cohorte: ARPU / churn_mensual
- Payback period: meses hasta recuperar el CAC con el revenue de la cohorte

Benchmarks de retención para SaaS B2B:
- D30 retention: >40% es bueno, >60% es excelente
- D90 retention: >20% es bueno, >35% es excelente
- Monthly churn: <2% es bueno, <1% es world-class
- Annual NRR: >100% (expansión neta) es el indicador más buscado por VCs

Cómo construir una tabla de cohortes:
Eje X: tiempo desde el registro (mes 0, mes 1, mes 2, ...)
Eje Y: cohorte por mes de adquisición (ene, feb, mar, ...)
Celda: % de usuarios de esa cohorte activos en ese mes

Señales de alerta en cohortes:
- Curva de retención no se estabiliza: indica que el producto no tiene "stickiness" real
- Cohortes recientes peor que cohortes antiguas: señal de deterioro del producto o cambio en ICP
- Alta varianza entre cohortes: indica inconsistencia en el proceso de onboarding
- Retención plana pero revenue cayendo: usuarios activos pero downgradeando

Herramientas para análisis de cohortes: Mixpanel, Amplitude, ChartMogul (para SaaS), hojas de cálculo con tablas pivot para etapa seed.`,
  },
  {
    title: 'Retención, Engagement y Churn — Estrategias para Startups',
    source: 'Playbook de Crecimiento SaaS — Metodología Validus',
    category: 'methodology' as const,
    tags: ['cohort', 'cohorte', 'retencion', 'churn', 'engagement', 'saas', 'growth'],
    content: `La retención es la métrica más importante de un negocio SaaS. Sin retención, el crecimiento es un balde con fugas: por más que se invierta en adquisición, el negocio no escala.

Anatomía del churn: por qué se van los usuarios

Tipos de churn:
1. Churn voluntario: usuario decide cancelar activamente
   - Por falta de valor percibido (principal causa, ~60% de casos)
   - Por encontrar alternativa mejor (~20% de casos)
   - Por restricciones presupuestarias (~15% de casos)
2. Churn involuntario: usuario quiere continuar pero no puede
   - Falla de pago (tarjeta vencida, fondos insuficientes) — representa 20-40% del churn total
   - Puede recuperarse con dunning emails automatizados

Estrategias de reducción de churn:
A) Onboarding: el 60-80% del churn se determina en los primeros 14 días
   - Time-to-value: reducir el tiempo entre registro y primer valor obtenido
   - Segmentación por caso de uso para onboarding personalizado
   - Checklist de activación visible: 5-7 pasos para llegar al "aha moment"

B) Engagement continuo:
   - Feature adoption tracking: usuarios que usan 3+ features tienen 2.5x mayor retención
   - Email triggers basados en comportamiento (no en tiempo)
   - Health score por usuario: predictor de churn 30 días antes de que ocurra
   - QBR (Quarterly Business Reviews) para cuentas enterprise

C) Intervención temprana:
   - Usuarios con health score bajo → activar CSM o automated rescue sequence
   - Exit surveys obligatorios: identificar patrones de churn por segmento
   - Win-back campaigns: 15-25% de usuarios que cancelan pueden recuperarse con la oferta correcta

Indicadores líderes de churn (leading indicators):
- Caída de login frequency >50% vs. baseline de la cohorte
- No completar el ciclo de activación en primeros 7 días
- Soporte tickets de frustración (sentimiento negativo)
- Ausencia en 3+ sesiones consecutivas para producto con uso esperado diario

Net Promoter Score (NPS) y cohortes:
Correlacionar el NPS por cohorte con la retención a 6 meses permite predecir early churn. Usuarios con NPS < 7 (detractores) tienen 4x más probabilidad de churn en 90 días que promotores.

Objetivo para startup seed/series A: lograr una curva de retención que se "aplana" (no llega a cero). Si la curva de retención de la cohorte mes 6+ se estabiliza sobre el 30%, el producto tiene product-market fit estructural.`,
  },
]

// ── Chunker ───────────────────────────────────────────────────────────────────

function chunkText(text: string, maxLen = 900): string[] {
  const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      chunks.push(p)
    } else {
      const sentences = p.split('. ')
      let cur = ''
      for (const s of sentences) {
        if ((cur + s).length > maxLen) {
          if (cur) chunks.push(cur.trim() + '.')
          cur = s
        } else {
          cur += (cur ? ' ' : '') + s
        }
      }
      if (cur) chunks.push(cur.trim() + '.')
    }
  }
  return chunks
}

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  return res.data.map(d => d.embedding)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('S4 Patch — ingesting missing corpus documents\n')

  let totalChunks = 0

  for (const doc of PATCH_DOCS) {
    // Check for existing entry
    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('source', doc.source)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log(`  SKIP (exists): ${doc.title}`)
      continue
    }

    const chunks = chunkText(doc.content)
    console.log(`  Embedding ${chunks.length} chunks: ${doc.title}`)

    const embeddings = await embedBatch(chunks)

    const rows = chunks.map((chunk, i) => ({
      title: doc.title,
      source: doc.source,
      category: doc.category,
      content: chunk,
      tags: doc.tags,
      embedding: embeddings[i],
    }))

    const { error } = await supabase.from('knowledge_base').insert(rows)
    if (error) throw new Error(`Insert failed for "${doc.title}": ${error.message}`)

    totalChunks += chunks.length
    console.log(`  ✅ Inserted ${chunks.length} chunks`)
  }

  console.log(`\nPatch complete. Total new chunks: ${totalChunks}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
