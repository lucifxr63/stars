# Análisis Detallado: FacturaIA y Data Storytelling MVP

Este documento complementa el análisis de ValidateAI (Parte 1), cubriendo el resto del repositorio y sus productos derivados enfocados en el mercado B2B y automatización de marketing.

---

## 1. Proyecto: FacturaIA

FacturaIA es un MVP Fintech (Plataforma de Financiamiento Colectivo) destinado a proveer liquidez a Pymes evaluando el riesgo tributario de sus facturas mediante IA y reglas duras de negocio.

### A. APIs y Flujo de Motor de Riesgo (`sii-risk-evaluator`)
La automatización del riesgo ocurre en la Edge Function `sii-risk-evaluator` (Deno).

- **APIs Consumidas:**
  - **Anthropic Claude Haiku (`claude-haiku-4-5-20251001`):** Usada para análisis semántico rápido y económico de riesgo.
  - **Futuro / Deuda Técnica:** El sistema está preparado para consumir Fintoc API (Open Banking) y Firma Electrónica Acepta / SII, aunque actualmente opera con datos que provee el usuario en el Wizard.

- **Ponderación del Riesgo y Lógica (0 a 100):**
  1. **Score por Monto (`monto_score` 0-25):** 
     - Facturas < $500,000 CLP penalizadas con 20 puntos (riesgo de fragmentación).
     - Facturas > $500M CLP penalizadas con 18 puntos.
     - Si el pagador es Gran Empresa, se bonifica restando hasta 10 puntos de riesgo.
  2. **Score por Plazo (`plazo_score` 0-25):**
     - Pagos <= 30 días tienen bajo riesgo (5 pts).
     - > 90 días conllevan mayor incertidumbre (22 pts).
  3. **Score por Antigüedad (`antiguedad_score` 0-25):**
     - 3 pts si el receptor es gran empresa, 12 pts si es Pyme (simplificado).
  4. **Score de IA Semántica (`ai_score` 0-25):**
     - **Prompt inyectado a Claude:** Se le pasan los RUTs, razón social y datos de la factura, pidiendo buscar "consistencia entre razón social y RUT", "monto coherente con tipo de empresa" y "señales de operación fantasma". La IA retorna únicamente un entero entre 0 y 25.

- **Veredicto y Fines:**
  - **Aprobación Automática:** Se da solo si el `total_score` es `<= 35` Y el pagador es una Gran Empresa registrada.
  - **Revisión / Rechazo:** Scores entre 36 y 70 pasan a revisión manual. > 70 se rechazan.
  - **Comisión:** La plataforma cobra un flat fee hardcodeado del **1.5%** por el adelanto de liquidez.

### B. Flujos de Usuario y UI
1. **Ruta `/dashboard` (Panel PYME):**
   - **Métricas:** Total Liquidado, Facturas Aprobadas, En Evaluación.
   - **Botón "Liquidar Factura":** Llama a `FacturaWizard` (Upload → IA Análisis → Oferta Comercial → Confirmación).
   - **Listado de Facturas (`InvoiceRow`):** Estados: `pendiente`, `en_evaluacion`, `aprobada`, `rechazada`, `liquidada`.

---

## 2. Proyecto: Data-Storytelling-MVP

Data Storytelling es un repositorio de automatización "Headless" (Node.js script-based) que orquesta obtención de datos macro/microeconómicos, procesamiento con Claude y generación masiva de contenido gráfico (vía Canva / Puppeteer) para estrategias Growth de B2B.

### A. Flujos, APIs Consumidas y Propósito
El foco aquí no es una app web reactiva, sino flujos de línea de comandos para Content Marketing automatizado.

- **APIs Consumidas:**
  - **`google-trends-api`**: Se usa (vía `data-fetcher.ts`) para descargar series de interés de búsqueda sobre tópicos de negocios.
  - **Anthropic Claude API (`@anthropic-ai/sdk`)**: Ingiere las tendencias descargadas y las traduce a un "copy" narrativo o posts educativos.
  
- **Flujo Principal (`script-generador.ts`):**
  1. Define una interfaz estructurada `CanvaRow` que contiene los campos: `titulo_post`, `metrica_nombre`, `benchmark_latam`, `estado_saludable`, `estado_peligro`.
  2. Contiene un dataset de Benchmarks SaaS en LatAm 2026 (ej: LTV:CAC de 3:1, Payback period 12-15 meses, Net Revenue Retention > 110%).
  3. Exporta esto vía `csv-writer` al archivo local `canva_bulk_data.csv`.
  4. **Fin de la automatización:** El usuario importa este `.csv` directamente en la función **"Bulk Create" de Canva**, permitiendo que de un solo clic se generen decenas de carruseles de LinkedIn o posts de Instagram orientados a educar al mercado B2B, reduciendo el CAC (Costo de Adquisición de Clientes) de ValidateAI y FacturaIA casi a cero mediante Growth Hacking.

### B. Costos y Casos de Uso
- **Costos:** Al ser scripts Node que se ejecutan localmente o en GitHub Actions, el costo de cómputo es nulo. Solo se consumen tokens de la API de Anthropic para la ingesta de las tendencias de Google, lo cual es residual.
