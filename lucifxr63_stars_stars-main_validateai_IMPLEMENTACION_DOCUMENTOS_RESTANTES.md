# Feature Blueprint: Generador de Documentos Operativos (ValidateAI)

**Contexto para Claude Code:** Eres un Ingeniero Frontend y Arquitecto de Software. El usuario requiere expandir el generador de reportes de `validateai/` para incluir tres nuevos documentos PDF enfocados en la **ejecución, viabilidad financiera y cumplimiento legal** de las startups en el mercado chileno. 

Actualmente, el proyecto genera un `InvestmentDossier.tsx` y un `PitchDeckOutline.tsx`. Tu tarea es implementar los 3 formatos restantes integrándolos al componente `<DeliverableTabs>` en `src/app/routes/Results.tsx`.

A continuación, la definición técnica de los sprints para implementar:

---

## Sprint 1: Plan de Ejecución y Arquitectura del MVP (Lean Roadmap)
**Objetivo:** Crear un documento táctico (PDF) que traduzca la idea validada en sprints de desarrollo accionables para equipos técnicos o agentes de IA.
* **Paso 1.1:** Modificar el esquema Zod en `src/types/validation.ts` para incluir un array de `mvp_sprints` dentro de la respuesta de la IA (incluyendo Nombre del Sprint, Duración, Stack Recomendado [ej. React + Supabase vs No-Code], y Features Core).
* **Paso 1.2:** Crear el componente `src/components/pdf/LeanRoadmapPDF.tsx` usando `@react-pdf/renderer`.
* **Paso 1.3:** Diseñar el layout en forma de "Kanban" vertical o "Timeline" para los primeros 3 sprints, separando "Must Haves" de "Nice to Haves".
* **Exigencias:** El LLM en Supabase (`ai-validate`) debe instruirse para priorizar arquitecturas Lean/No-Code (FlutterFlow, Bubble) para MVPs no técnicos, y arquitecturas escalables para Fintech/Healthtech.

---

## Sprint 2: Reporte de Viabilidad Financiera (Unit Economics & Growth)
**Objetivo:** Generar un reporte financiero visual que calcule y proyecte métricas vitales (CAC, LTV, Break-even).
* **Paso 2.1:** Extender `financials` en `src/types/validation.ts` para que la IA retorne estimaciones de LTV:CAC Ratio, Modalidad de Cobro y Estrategia de Crecimiento (PLG vs Sales-Led).
* **Paso 2.2:** Crear el componente `src/components/pdf/UnitEconomicsPDF.tsx`.
* **Paso 2.3:** Integrar gráficos o tablas generadas con SVG en `@react-pdf/renderer` para visualizar el flujo de caja de los primeros 12 meses y la relación CAC/LTV.
* **Exigencias:** La lógica debe penalizar ideas de consumo masivo B2C con márgenes bajos y premiar modelos B2B SaaS recurrentes, utilizando los benchmarks insertados en el RAG de la plataforma.

---

## Sprint 3: Roadmap Regulatorio y Societario (Legal & Compliance Chile)
**Objetivo:** Crear un "Checklist Legal" enfocado en el ecosistema chileno para mitigar riesgos societarios y multas.
* **Paso 3.1:** Crear `src/components/pdf/ComplianceRoadmapPDF.tsx`.
* **Paso 3.2:** Estructurar el PDF en tres bloques: 
  1. Constitución (SpA vía Tu Empresa en un Día).
  2. Normativas de la Industria (Trigger dinámico: Si es financiera -> Ley Fintec 21.521; Si procesa datos masivos -> Ley de Protección de Datos 21.719).
  3. Pacto de Accionistas (Recomendaciones de Vesting, Cliff, Drag/Tag-along).
* **Paso 3.3:** Añadir un disclaimer visual en el PDF indicando que es una "Recomendación estratégica generada por IA, no asesoría legal formal".
* **Exigencias:** El prompt de `ai-validate` debe evaluar el nivel de riesgo regulatorio de la idea (Ej. ideas de salud, finanzas o IA profunda deben marcar alerta alta).

---

## Sprint 4: Integración en la UI (`DeliverableTabs.tsx`)
**Objetivo:** Hacer que los 5 documentos sean accesibles y descargables desde el Dashboard de Resultados.
* **Paso 4.1:** Actualizar `src/components/shared/DeliverableTabs.tsx` para agregar 3 nuevas pestañas (`value="roadmap"`, `value="financials"`, `value="compliance"`).
* **Paso 4.2:** Integrar el componente `<ExportPDF>` en cada pestaña, pasando los nuevos componentes PDF con la `validationData` y el `type` correspondiente.
* **Paso 4.3:** Asegurar que los estados de carga funcionen correctamente durante la generación de cada documento.

---
**Instrucción Final para Claude Code:** Ejecuta los Sprints 1 a 4. Si requieres modificar las Edge Functions en Supabase para obtener la nueva data estructurada del LLM, hazlo antes de programar las vistas en PDF.
