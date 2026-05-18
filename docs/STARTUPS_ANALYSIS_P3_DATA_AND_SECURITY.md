# Análisis Detallado: Bases de Datos, Seguridad y Operaciones Avanzadas (Parte 3)

Este documento cierra la auditoría técnica profunda del repositorio, abordando las áreas de persistencia de datos, políticas de seguridad (RLS), procesamiento de documentos y generación de activos gráficos.

---

## 1. Esquema de Base de Datos y Políticas de Seguridad (RLS)

Ambos proyectos principales (FacturaIA y ValidateAI) utilizan **Supabase PostgreSQL**. La seguridad es crítica, especialmente en FacturaIA por tratarse de una Fintech sujeta a regulaciones (Ley 19.628 y CMF).

### FacturaIA: Seguridad y Cumplimiento
- **Esquema Relacional:** 
  - `companies`: Perfil tributario de la Pyme (user_id, rut, razon_social).
  - `invoices`: Registro de la factura (company_id, folio, montos, estado).
  - `risk_assessments`: Evaluaciones de IA (invoice_id, tax_risk_score, breakdown).
- **Row Level Security (RLS):** 
  - Las políticas RLS en `002_rls_policies.sql` son estrictas. Una política fundamental como `"invoices_select_own"` fuerza a que un usuario autenticado (`auth.uid()`) solo pueda acceder mediante `SELECT`, `INSERT` o `UPDATE` a facturas que pertenezcan a su `company_id`.
  - **Inmutabilidad:** No se permite `DELETE` en la tabla `companies` para preservar el historial ante posibles auditorías de la CMF.
  - **Roles:** Existe un rol especial `admin_facturaia` para la "Mesa Directiva", que tiene una política RLS que permite `SELECT` global para armar el panel analítico de LTV y CAC.
  - **Edge Functions:** La escritura en `risk_assessments` está bloqueada para los clientes. Solo la función `sii-risk-evaluator` puede insertar resultados usando el `SERVICE_ROLE_KEY` (bypass de RLS).

### ValidateAI: Migraciones y Vectorización
- Usa un esquema más complejo gestionado a lo largo de 30 migraciones `.sql`.
- Destacan las tablas `market_ai_insights`, `economic_knowledge`, `ai_interactions` y el soporte pesado a **pgvector** para el caché semántico (`001_rag_competitors.sql`, `20260424_rag_cache.sql`).

---

## 2. Procesamiento de Documentos (OCR/XML) en FacturaIA

- **Estado Actual del "Upload":** Actualmente, el `FacturaWizard` (Paso 1) **no implementa OCR ni parseo de XML** del SII. Es un MVP donde el usuario digita manualmente los datos críticos de la factura (Folio, RUT Receptor, Razón Social, Monto Neto, Fechas).
- **Lógica Front-end:** El sistema auto-calcula el IVA (19%) en tiempo real al modificar el monto neto.
- **Deuda Técnica:** Para un paso a producción real, este Wizard deberá reemplazar el input manual por un File Uploader que conecte con una API de extracción de XML del SII (o un OCR para PDFs emitidos), eliminando el factor de error humano o fraude en el tipeo de montos.

---

## 3. Orquestación del Generador de PDF en ValidateAI

El botón "Descargar Dossier" del Bento Box (`ValidationDetail.tsx`) utiliza la librería **jsPDF**.
- **Mecanismo:** El código (típicamente aislado en un archivo como `pdf.ts` o `ExportPDF.tsx`) inyecta todo el estado de React (`validationStore`) y los JSONs retornados por la IA. 
- Formatea programáticamente textos, dibuja gráficos vectoriales (como el velocímetro de "Founder Fit" o barras de TAM/SAM) y tabula los competidores extraídos por el prompt de `competitive_analysis` en un PDF estructurado de múltiples páginas. 
- Se apoya en una llamada asíncrona a la API antes de compilar si el usuario solicita módulos on-demand (ej. *Compliance Roadmap*) que aún no estaban cacheados.

---

## 4. Renderizado Visual Automático (Data-Storytelling-MVP)

El script maestro del "Venture Studio" para marketing de contenidos no solo escupe un `.csv`. El archivo **`renderer.ts`** orquesta un pipeline visual completo:

- **Template de Renderizado:** Construye dinámicamente un template HTML usando Tailwind CSS, Chart.js (para gráficos de línea/barras) y fuentes tipográficas premium (Inter, JetBrains Mono, Playfair). Este HTML inyecta los datos extraídos de las APIs (Google Trends, Banco Central).
- **Puppeteer:** Se lanza una instancia de Chrome headless (sin sandbox) a una resolución de 1080x1080px (ideal para carruseles de LinkedIn o Instagram). Puppeteer inyecta el HTML, espera que los gráficos de Chart.js se dibujen y dispara un `screenshot()` en formato PNG.
- **Doble Inferencia de Claude:** Además de la imagen, el pipeline consume **Claude Sonnet 4.6** mandándole el `SYSTEM_PROMPT` y los datos crudos, para que la IA actúe como "Growth Marketer" y redacte un copy persuasivo (con ganchos y hashtags) para acompañar la imagen generada.
- **Output:** Se genera el par (PNG + TXT) en la carpeta local `./outputs/`.

---

## 5. Arquitectura de Prompts de ValidateAI (Los 18 Entregables)

En lugar de un solo prompt masivo, ValidateAI tiene los prompts atomizados en la base de datos (migraciones como `006_market_sizing.sql` o `008_mentors.sql`). 

La función `ai-validate` actúa como un **Router LLM**:
1. El usuario hace clic en el dashboard en un botón on-demand (ej. "Generar Hoja de Ruta Legal").
2. El frontend envía un request con el `prompt_type` (ej. `compliance_roadmap`).
3. El backend extrae la plantilla del prompt asociada en la base de datos, le inyecta las variables de contexto de ese cliente específico (RUT, país, segmento) e invoca a Claude 3.5 Sonnet.
4. El resultado se guarda en `ai_interactions` y se refleja inmediatamente en el UI. Esto permite que el equipo de producto iteré y mejore los prompts modificando la base de datos sin necesidad de redesplegar el código (hot-swappable prompts).
