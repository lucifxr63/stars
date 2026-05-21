/**
 * Seed script — Corpus Piloto ValidateAI
 *
 * Ingesta documentos regulatorios y metodológicos en la tabla knowledge_base.
 * Genera embeddings con text-embedding-3-small (1536d) vía OpenAI.
 *
 * Uso:
 *   npx tsx scripts/seed-corpus-piloto.ts
 *
 * Variables de entorno necesarias en .env.local:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Corpus Piloto ─────────────────────────────────────────────────────────────

const CORPUS: Array<{
  title: string
  source: string
  category: 'regulatory' | 'gtm' | 'methodology' | 'market'
  tags: string[]
  content: string
}> = [
  // ── REGULATORIO: Ley Fintec ──────────────────────────────────────────────
  {
    title: 'Ley Fintec Chile — Objeto y Ámbito (Art. 1-3)',
    source: 'Ley 21.521 — Capítulo I',
    category: 'regulatory',
    tags: ['ley-fintec', 'regulacion', 'cmf', 'chile', 'fintech'],
    content: `La Ley N°21.521 (Ley Fintec) fue promulgada el 4 de enero de 2023 y publicada en el Diario Oficial el 13 de enero de 2023. Establece un marco regulatorio para las actividades de tecnología financiera en Chile bajo la supervisión de la Comisión para el Mercado Financiero (CMF).

Artículo 1 — Objeto: Esta ley tiene por objeto promover la competencia e inclusión financiera a través de la regulación de la provisión de servicios basados en tecnología en el ámbito financiero (servicios fintech).

Artículo 2 — Ámbito de aplicación: La ley aplica a personas naturales y jurídicas que de manera habitual y remunerada presten en Chile cualquiera de los servicios fintech regulados: (a) plataformas de financiamiento colectivo, (b) intermediación de instrumentos financieros, (c) enrutamiento de órdenes, (d) asesoría crediticia o de inversión, (e) custodia de instrumentos financieros, (f) pagos transfronterizos, (g) otros que determine la CMF.

Artículo 3 — Registro: Los prestadores de servicios fintech deben inscribirse en el Registro de Prestadores de Servicios Fintech (RPSF) que administra la CMF. El proceso de inscripción requiere cumplir requisitos de capital mínimo, gobierno corporativo, gestión de riesgos y ciberseguridad.`,
  },
  {
    title: 'Ley Fintec — Open Finance y Portabilidad de Datos (Art. 17-25)',
    source: 'Ley 21.521 — Capítulo III',
    category: 'regulatory',
    tags: ['ley-fintec', 'open-finance', 'portabilidad', 'datos', 'api', 'chile'],
    content: `El Capítulo III de la Ley 21.521 establece el marco de Open Finance en Chile, también llamado "Sistema de Finanzas Abiertas".

Artículo 17 — Sistema de Finanzas Abiertas: Se establece un sistema mediante el cual las instituciones financieras reguladas comparten información de sus clientes (previa autorización) con prestadores de servicios fintech a través de APIs estandarizadas.

Artículo 18 — Participantes: Son participantes del sistema: (a) proveedores de información (bancos, cooperativas, emisores de tarjetas), (b) proveedores de servicios de iniciación de pagos, (c) prestadores de servicios fintech registrados.

Artículo 19 — Consentimiento: El cliente debe otorgar consentimiento expreso, informado y específico para que su información sea compartida. El consentimiento puede ser revocado en cualquier momento.

Artículo 21 — Estándares técnicos: La CMF establecerá los estándares técnicos de las APIs, formatos de datos, protocolos de seguridad y mecanismos de autenticación. Las normas deben ser interoperables y basadas en estándares internacionales (ISO 20022, OpenID Connect).

Artículo 25 — Responsabilidad: Los participantes del sistema son responsables de la seguridad de los datos que manejan. El incumplimiento puede resultar en sanciones de hasta 10.000 UF.`,
  },
  {
    title: 'Ley Fintec — Plataformas de Financiamiento Colectivo (Crowdfunding)',
    source: 'Ley 21.521 — Capítulo IV',
    category: 'regulatory',
    tags: ['ley-fintec', 'crowdfunding', 'financiamiento-colectivo', 'pyme', 'chile'],
    content: `Las plataformas de financiamiento colectivo (crowdfunding) en Chile quedan reguladas bajo el Capítulo IV de la Ley 21.521.

Tipos de crowdfunding regulados: (1) Equity crowdfunding: permite a empresas captar capital de múltiples inversionistas a cambio de participación. (2) Debt crowdfunding: permite a empresas obtener préstamos colectivos. (3) Reward crowdfunding: obtención de fondos a cambio de productos o servicios (no financiero).

Requisitos para operar: Las plataformas de equity y debt crowdfunding deben registrarse en la CMF. Capital mínimo requerido: 4.000 UF. Límites de inversión por proyecto: los proyectos pueden captar máximo 10.000 UF por plataforma. Los inversionistas no acreditados tienen un límite de 20 UF por proyecto.

Obligaciones de transparencia: Las plataformas deben publicar: información financiera auditada de los proyectos, modelos de negocio, factores de riesgo, estructura de comisiones, historial de proyectos exitosos y fallidos.

Relevancia para startups: El crowdfunding regulado es una alternativa de financiamiento para startups que no califican para capital de riesgo tradicional. Ideal para empresas con más de 12 meses de operación y validación de mercado demostrable.`,
  },

  // ── REGULATORIO: CMF ─────────────────────────────────────────────────────
  {
    title: 'CMF — Norma de Carácter General 502: Ciberseguridad para Entidades Financieras',
    source: 'CMF NCG 502 (2023)',
    category: 'regulatory',
    tags: ['cmf', 'ciberseguridad', 'regulacion', 'fintech', 'chile', 'iso27001'],
    content: `La Norma de Carácter General N°502 de la CMF establece los requisitos mínimos de ciberseguridad para entidades financieras supervisadas, incluyendo prestadores de servicios fintech.

Requisitos principales:
1. Marco de gestión de riesgos de ciberseguridad: Las entidades deben implementar un marco documentado basado en estándares internacionales (ISO 27001 o NIST CSF).

2. Gobierno de ciberseguridad: El Directorio o máximo órgano de administración debe aprobar políticas de ciberseguridad y recibir reportes al menos semestral.

3. Gestión de identidades y accesos: Implementar autenticación multifactor (MFA) para accesos privilegiados. Aplicar principio de mínimo privilegio.

4. Detección y respuesta a incidentes: Las entidades deben notificar a la CMF dentro de las 24 horas siguientes a la detección de incidentes que afecten la continuidad operacional o comprometan datos de clientes.

5. Gestión de proveedores tecnológicos: Se requiere debida diligencia en la contratación de proveedores cloud y SaaS que procesen datos financieros de clientes.

6. Pruebas de penetración: Las entidades deben realizar pentests al menos una vez al año por empresas externas acreditadas.

Multas por incumplimiento: Hasta 15.000 UF por infracción grave. La reincidencia puede resultar en revocación del registro.

Plazos de implementación: Entidades grandes: 6 meses desde publicación. Startups y nuevas entidades: 12 meses desde inscripción en RPSF.`,
  },
  {
    title: 'CMF — Regulación de Criptoactivos y Activos Digitales en Chile',
    source: 'CMF Informe Regulatorio 2023 + Ley 21.521 Art. 4',
    category: 'regulatory',
    tags: ['cmf', 'criptomonedas', 'activos-digitales', 'bitcoin', 'blockchain', 'chile', 'regulacion'],
    content: `Estado regulatorio de criptoactivos en Chile (2023-2024):

Marco actual: Los criptoactivos no están regulados como valores mobiliarios ni como moneda de curso legal en Chile. Sin embargo, la Ley 21.521 otorga a la CMF facultades para regular plataformas de intercambio de criptoactivos (exchanges) que presten servicios en Chile.

Tratamiento tributario (SII): Los criptoactivos son considerados "bienes incorporales" sujetos al Impuesto a la Renta. Las ganancias de capital por compraventa deben declararse como "otras rentas" en el formulario 22. Las empresas que aceptan criptoactivos como pago deben registrarlos al valor de mercado del día de la transacción.

Exchanges en Chile: Las plataformas de intercambio deben registrarse en la UAF (Unidad de Análisis Financiero) como sujetos obligados a reportar operaciones sospechosas bajo la Ley 19.913 (Lavado de Activos). Deben implementar procedimientos KYC/AML.

Regulación esperada (2024-2025): La CMF trabaja en una regulación específica para proveedores de servicios de activos virtuales (PSAV) alineada con las recomendaciones del GAFI. Se esperan requisitos de capital mínimo y custodio regulado.

Riesgo para startups cripto: Operar sin registro UAF es infracción grave. Recomendación: consultar abogado especializado antes de lanzar cualquier servicio relacionado con criptoactivos en Chile.`,
  },

  // ── MERCADO: Ecosistema Startup Chile ────────────────────────────────────
  {
    title: 'Ecosistema Startup Chile — Panorama 2024',
    source: 'ACAFI + StartupChile Informe Anual 2024',
    category: 'market',
    tags: ['startup', 'chile', 'ecosistema', 'venture-capital', 'financiamiento', 'latam'],
    content: `Chile cuenta con uno de los ecosistemas de startups más maduros de América Latina. Key metrics 2024:

Financiamiento: El mercado de venture capital en Chile movilizó ~USD 380M en 2023 (incluyendo deuda y equity). Los sectores con mayor inversión: Fintech (31%), Agtech (18%), Salud (14%), SaaS B2B (22%).

Fondos activos en Chile (2024):
- Manutara Ventures: tickets USD 500K - 3M (Series A)
- Fen Ventures: pre-seed y seed, tickets USD 50K - 500K
- Kaszek: LatAm fund, tickets USD 1M+ (Series A en adelante)
- CORFO Fondo de Fondos: co-inversión con fondos privados
- QueAporte: ángeles acreditados, tickets USD 25K - 200K

Programas de apoyo:
- StartupChile: subsidio no dilutivo hasta USD 100K para startups internacionales
- CORFO Capital Semilla: hasta CLP 40M no dilutivos para validación
- CORFO Capital Abeja: hasta CLP 120M para escalar modelos validados
- Incuba CORFO: subsidios para aceleradoras registradas

Métricas de mercado chileno:
- PIB 2023: ~USD 344B (16° en el mundo)
- Clase media: 65% de la población
- Penetración internet: 92%
- Usuarios banca digital: 78% de los bancarizados
- PyMEs en Chile: ~1.2M empresas (98% del total)`,
  },
  {
    title: 'Financiamiento SAFE y Notas Convertibles en Chile',
    source: 'Guía Legal Startup Chile — Abogados de Startups CL',
    category: 'regulatory',
    tags: ['safe', 'nota-convertible', 'financiamiento', 'startup', 'chile', 'legal', 'inversion'],
    content: `Los instrumentos SAFE (Simple Agreement for Future Equity) y notas convertibles son los vehículos más usados para rondas pre-seed y seed en Chile.

SAFE en Chile:
- No existe regulación específica para SAFE en Chile. Se implementa como contrato civil atípico.
- Debe incluir: cap de valorización, discount rate (típicamente 15-25%), eventos de conversión (equity round, cambio de control, vencimiento).
- Riesgo legal: La CMF puede clasificar un SAFE como "valor mobiliario" si se emite masivamente. Para rondas pequeñas (< 10 inversionistas) el riesgo es bajo.
- Tributación del inversionista: La ganancia en la conversión no genera hecho gravado hasta la venta de las acciones resultantes.

Nota Convertible:
- Instrumento de deuda que se convierte en equity en el siguiente evento de financiamiento.
- Requiere escritura pública si el monto supera ciertos límites. Recomendado para montos > USD 50K.
- Tasa de interés: Generalmente TIB + spread. Las notas sin interés pueden ser cuestionadas por el SII como donación encubierta.

Cap Table estándar para startups en etapa temprana:
- Fundadores: 70-80% (post primera ronda)
- ESOP (pool de opciones): 10-15%
- Inversionistas semilla: 10-20%

Recomendación: Usar la plataforma Funder.cl o el modelo de SAFE de YCombinator adaptado al derecho chileno. Siempre asesorarse con abogado especializado (costo estimado: CLP 500K - 2M para una ronda semilla).`,
  },

  // ── GTM: Go-to-Market Chile ───────────────────────────────────────────────
  {
    title: 'Go-to-Market B2B en Chile — Estrategia para Startups',
    source: 'ValidateAI GTM Playbook v1.0',
    category: 'gtm',
    tags: ['gtm', 'go-to-market', 'b2b', 'ventas', 'chile', 'startup', 'saas'],
    content: `Guía de Go-to-Market B2B para startups en Chile:

1. Segmentación del mercado chileno:
- Enterprise (>200 empleados): Ciclo de venta 6-18 meses. Requiere champion interno + aprobación legal y TI. Presupuesto: USD 20K-500K+ anuales. ~5.000 empresas en Chile.
- Mid-market (50-200 empleados): Ciclo 3-6 meses. Decision maker es el gerente de área. Presupuesto: USD 5K-50K. ~35.000 empresas.
- SMB/PyME (<50 empleados): Ciclo 2-8 semanas. Decisión rápida del dueño. Presupuesto: USD 500-10K. ~1.2M empresas.

2. Canales de adquisición efectivos en Chile:
- LinkedIn Ads: CPL de USD 20-60 para B2B tech. Mejor para mid-market y enterprise.
- Referidos: El mercado chileno es muy relacional. Un NPS alto genera 40-60% de nuevos clientes vía referido.
- Eventos: ExpoFeria Pyme, Chile Day, Congreso Futuro. Alta densidad de decision makers.
- Telemarketing outbound: Efectivo en sectores tradicionales (salud, construcción, retail).
- Integraciones de canal: Alianzas con consultoras SAP/Oracle, bancos, cámaras de comercio.

3. Pricing B2B en Chile (benchmarks 2024):
- SaaS básico: CLP 50K-200K/mes por empresa
- SaaS mid-market: CLP 300K-1.5M/mes
- Enterprise: CLP 2M-15M/mes + implementación
- Regla de oro: precio en UF para protegerse de la inflación (UF ≈ $38.000 CLP en 2024)

4. Ciclo de ventas recomendado:
Prospección → Demo (30 min) → Prueba gratuita (14-30 días) → Propuesta → Negociación → Cierre → Onboarding

5. Métricas clave:
- CAC objetivo SMB: < 3 meses de MRR
- CAC objetivo mid-market: < 6 meses de MRR
- Churn mensual aceptable: < 2%
- NRR (Net Revenue Retention): > 100% para SaaS saludable`,
  },
  {
    title: 'Estrategia de Precios para SaaS en Chile — Modelos y Benchmarks',
    source: 'ValidateAI GTM Playbook v1.0',
    category: 'gtm',
    tags: ['pricing', 'saas', 'chile', 'gtm', 'revenue', 'monetizacion'],
    content: `Modelos de precios más efectivos para SaaS en el mercado chileno:

1. Freemium: Funciona bien en Chile para productos con viralidad inherente (ej. herramientas de colaboración, formularios). Tasa de conversión freemium→pago: 2-5% en B2C, 8-15% en B2B.

2. Free Trial (prueba gratuita): 14-30 días es el estándar. El 60-70% de las conversiones ocurre en los primeros 7 días. Requiere un onboarding que lleve al usuario al "momento aha" en < 5 minutos.

3. Per seat (por usuario): Modelo estándar para herramientas de productividad. Escalamiento natural pero con resistencia en PyMEs que quieren "compartir la cuenta".

4. Usage-based: Cobra por volumen de uso (ej. por API call, por documento procesado, por GB). Reduce la barrera de entrada pero puede generar ingresos impredecibles.

5. Value-based pricing: Precio atado al valor entregado (ej. % del ahorro generado, % de ingresos incrementales). Difícil de implementar pero maximiza LTV.

Benchmarks de conversión Chile 2024:
- Trial → Pago: 15-25% (B2B), 3-8% (B2C)
- Visitante → Trial: 2-5%
- Lead calificado → Demo: 20-35%
- Demo → Cierre: 30-50% (SMB), 15-25% (mid-market)

Errores comunes en pricing chileno:
- Cobrar en USD en un mercado que compra en CLP (genera fricción)
- No tener opción anual con descuento (18-20% de descuento incentiva el prepago)
- Planes demasiado complejos (máximo 3 planes visibles)
- No ajustar precio a la inflación (usar UF o cláusula de reajuste IPC)`,
  },

  // ── METODOLOGÍA ───────────────────────────────────────────────────────────
  {
    title: 'Metodología Lean Startup — Validación de Ideas en Chile',
    source: 'ValidateAI Methodology Playbook v2.0',
    category: 'methodology',
    tags: ['lean-startup', 'validacion', 'mvp', 'hipotesis', 'metodologia', 'startup'],
    content: `Marco de validación Lean Startup adaptado al contexto latinoamericano:

1. El ciclo Build-Measure-Learn:
- Build: Construir el MVP más pequeño que permita probar la hipótesis central.
- Measure: Medir la métrica clave que confirma o refuta la hipótesis (NPS, conversión, retención).
- Learn: Tomar decisión de pivotar o perseverar basada en datos, no en opiniones.

2. Tipos de MVP para el mercado chileno:
- Landing page: Valida si existe demanda antes de construir. Herramientas: Carrd, Framer, Webflow. Costo: < USD 100. Plazo: 2-3 días.
- Wizard of Oz: El producto parece automatizado pero es manual por detrás. Ideal para validar antes de invertir en desarrollo.
- Concierge: Servicio personalizado 1:1 con 5-10 clientes piloto. Valida el proceso completo sin software.
- Smoke test: Mide willingness-to-pay real (botón de "comprar" antes de que el producto exista).

3. Customer Discovery en Chile:
- Objetivo: 30 entrevistas con clientes potenciales antes de escribir una línea de código.
- Preguntas clave: "¿Cuánto te cuesta este problema hoy?", "¿Qué solución usas actualmente?", "¿Por qué no te satisface?".
- Señales de PMF: Los clientes pagan sin que se los pidas. NPS > 40. Churn < 2%/mes. Los usuarios recomiendan el producto espontáneamente.

4. Problem-Solution Fit vs. Product-Market Fit:
- PSF: Confirmación de que el problema es real, frecuente y los clientes buscan solución activamente.
- PMF: El producto resuelve el problema mejor que cualquier alternativa disponible y el mercado lo adopta orgánicamente.

5. Métricas de validación por etapa:
- Pre-seed: 10 cartas de intención (LOIs) o 3 clientes pagando cualquier monto.
- Seed: MRR de CLP 5-20M, churn < 3%/mes, NPS > 35.
- Serie A: MRR > CLP 50M, crecimiento MoM > 15%, payback CAC < 12 meses.`,
  },
  {
    title: 'Unit Economics para Startups — CAC, LTV y Payback en el Mercado Chileno',
    source: 'ValidateAI Finance Playbook v1.0',
    category: 'methodology',
    tags: ['unit-economics', 'cac', 'ltv', 'payback', 'finanzas', 'startup', 'chile'],
    content: `Guía de Unit Economics para startups en Chile:

Definiciones clave:
- CAC (Customer Acquisition Cost): Costo total de adquirir un cliente. Incluye marketing, ventas, demos, contratos.
  Fórmula: CAC = (Gasto en Marketing + Gasto en Ventas) / Nuevos Clientes en el Período

- LTV (Lifetime Value): Ingreso total generado por un cliente durante su vida con la empresa.
  Fórmula simple: LTV = ARPU / Churn Rate Mensual
  Fórmula avanzada: LTV = ARPU × Margen Bruto × (1 / Churn Rate)

- Payback Period: Meses necesarios para recuperar el CAC.
  Fórmula: Payback = CAC / (ARPU × Margen Bruto)

Benchmarks Chile 2024 por sector:
| Sector | CAC target | LTV/CAC | Payback |
|--------|-----------|---------|---------|
| SaaS SMB | CLP 150K-500K | >3x | <6 meses |
| SaaS Mid-market | CLP 1M-5M | >5x | <12 meses |
| Fintech B2C | CLP 30K-120K | >4x | <8 meses |
| Healthtech B2B | CLP 500K-3M | >6x | <18 meses |

Normalización en UF (recomendado):
Expresar CAC y LTV en UF protege el análisis de la inflación. Con UF 2024 ≈ CLP 38.000:
- CAC SMB saludable: 3-10 UF
- LTV SMB saludable: 15-50 UF
- CAC Mid-market: 25-120 UF

Señales de unit economics no viables:
- LTV/CAC < 2x: El modelo de negocio no es sostenible.
- Payback > 18 meses para SMB: El flujo de caja no soporta el crecimiento.
- Churn > 5% mensual: El producto no está resolviendo el problema correctamente.

Quick-wins para mejorar unit economics:
1. Aumentar precio promedio (ARPU) +20% sin perder conversión = +20% LTV sin cambiar nada más.
2. Reducir churn pasando de pago mensual a anual = aumenta LTV 2-3x.
3. Segmentar canales de adquisición por CAC: cortar canales con CAC > 30% del LTV.`,
  },
]

// ── Chunking ──────────────────────────────────────────────────────────────────

function chunkContent(content: string, maxLength = 1200): string[] {
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxLength && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

// ── Embeddings batch ──────────────────────────────────────────────────────────

async function batchEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  return response.data.map(d => d.embedding)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 ValidateAI — Seed Corpus Piloto\n')

  // Check for existing entries (idempotency)
  const { data: existing } = await supabase
    .from('knowledge_base')
    .select('source')
  const existingSources = new Set((existing ?? []).map((r: any) => r.source))

  const toInsert: typeof CORPUS = CORPUS.filter(doc => !existingSources.has(doc.source))

  if (toInsert.length === 0) {
    console.log('✅ Corpus ya está cargado. Nada que insertar.')
    return
  }

  console.log(`📚 Documentos a insertar: ${toInsert.length} (${CORPUS.length - toInsert.length} ya existentes)\n`)

  let totalChunks = 0
  let totalErrors = 0

  for (const doc of toInsert) {
    process.stdout.write(`  → ${doc.title.slice(0, 60)}... `)
    try {
      const chunks = chunkContent(doc.content)
      const embeddings = await batchEmbeddings(chunks)

      const rows = chunks.map((chunk, i) => ({
        title: doc.title,
        source: doc.source,
        category: doc.category,
        content: chunk,
        tags: doc.tags,
        embedding: embeddings[i],
      }))

      const { error } = await supabase.from('knowledge_base').insert(rows)
      if (error) throw error

      console.log(`✅ ${chunks.length} chunks`)
      totalChunks += chunks.length
    } catch (err) {
      console.log(`❌ ERROR: ${err}`)
      totalErrors++
    }

    // Rate limit: 500ms entre documentos
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n📊 Resumen:`)
  console.log(`   Documentos procesados: ${toInsert.length - totalErrors}/${toInsert.length}`)
  console.log(`   Chunks insertados: ${totalChunks}`)
  console.log(`   Errores: ${totalErrors}`)
  console.log(`\n✅ Corpus Piloto listo. El motor RAG ya puede responder consultas sobre:\n`)
  const categories = [...new Set(CORPUS.map(d => d.category))]
  categories.forEach(cat => {
    const count = CORPUS.filter(d => d.category === cat).length
    console.log(`   - ${cat}: ${count} documentos`)
  })
}

main().catch(console.error)
