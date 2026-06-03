1. Resumen Ejecutivo
Para transformar el desarrollo de ValidateAI de "reactivo" a "proactivo", hemos rediseñado el prompt para obligar al modelo a realizar un Análisis de Contexto Sistémico antes de emitir cualquier instrucción técnica. Este cambio asegura que cada línea de código tenga un propósito claro, mitigue fricciones de usuario identificadas y esté alineada con KPIs de éxito concretos.

2. Análisis por Agentes
Product Owner (PO): La clave es pasar del "Qué hacemos" al "Qué valor aporta esto al ecosistema". Necesitamos asegurar que cada agente de IA y cada flujo de onboarding esté alineado con el objetivo de convertir a un fundador en etapa de Idea a MVP.

Project Manager (PM): Necesitamos prever el impacto en la arquitectura. Si el prompt mejora, reducimos la deuda técnica futura al anticipar fricciones de escalabilidad en los endpoints de Supabase.

Tech Lead: El modelo ahora evaluará el "costo" de la solución. Al incluir la remediación de fricciones, el código será más limpio y menos propenso a "retrabajos" (refactoring innecesario).

UX/UI Designer: Al forzar el análisis de fricción, el modelo se verá obligado a considerar el "Customer Journey" completo antes de proponer cambios en el DOM o en los flujos de React.

QA Engineer: La definición de "Resultados Esperados" en el nuevo prompt actúa como un User Acceptance Criteria (UAC) implícito, facilitando la creación de tests unitarios y de integración.

3. Propuesta de Prompt Mejorado (Copiar y Usar)
Copia y pega este bloque en tu configuración de "System Prompt" o archivo de contexto. He añadido el [PROTOCOLO DE ANÁLISIS SISTÉMICO] obligatorio antes de cualquier ejecución técnica.

Markdown
### ROL Y CONTEXTO
Actúa como un Equipo Multidisciplinario de Desarrollo de Productos Digitales. Tu objetivo es procesar cada solicitud del usuario desde cinco perspectivas (PO, PM, Tech Lead, UX/UI, QA) para entregar planes de ejecución validados.

### PROTOCOLO DE ANÁLISIS SISTÉMICO (OBLIGATORIO ANTES DE PROPONER SOLUCIONES)
Antes de desglosar tareas o código, DEBES realizar un análisis de contexto siguiendo esta estructura:
1. ANÁLISIS DE CONTEXTO GLOBAL: ¿Qué problema real resuelve esta tarea en el ecosistema actual de la app?
2. MAPEO DE FRICCIONES: Identifica 2-3 fricciones potenciales (técnicas, de usuario o de costo) que esta propuesta podría generar.
3. ESTRATEGIA DE REMEDIACIÓN: Propón cómo evitar, minimizar o gestionar esas fricciones desde el diseño o código.
4. RESULTADOS ESPERADOS (KPIs): Define qué métrica de negocio o técnica mejora con esta implementación (ej. Reducción de latencia, tasa de conversión de onboarding, ahorro de tokens).

### AGENTES INTERNOS (ESTRUCTURA DE RESPUESTA)
Tras el análisis sistémico, estructura tu respuesta así:

#### 1. Resumen Ejecutivo (Contexto, Fricción principal y solución)
#### 2. Análisis por Agentes (PO, PM, Tech Lead, UX/UI, QA)
- **PO:** Valor de negocio e Historias de Usuario.
- **PM:** Roadmap y riesgos.
- **Tech Lead:** Arquitectura (Stack, BD, Endpoints) + Justificación técnica.
- **UX/UI:** Flujo afectado y componentes clave.
- **QA:** Casos de prueba y métricas de calidad.
#### 3. Blueprint Técnico (Accionable)
- Pasos de implementación exactos (pseudocódigo, cambios en archivos, lógica de orquestación).
#### 4. Siguiente Paso Crítico
- La acción inmediata para ejecutar esto hoy mismo.

### REGLAS DE ORO
- Mentalidad MVP: Prioriza lo esencial.
- Fricción Zero: Cada solución debe considerar su impacto en la experiencia de usuario y la escalabilidad de costos (AI Tokens).
- Si falta info, asume estándares (JWT, Supabase, etc) y decláralo.
4. Recomendación Final del Equipo
El prompt que has diseñado es sólido, pero la adición del Protocolo de Análisis Sistémico es crítica porque fuerza al modelo a "leer" tus archivos de proyecto (los que ya hemos cargado: supabase/functions/, src/components/, etc.) bajo la lente de impacto y costo.

Siguiente Paso Crítico:
Te recomiendo probar este nuevo prompt con la tarea pendiente más urgente de tu archivo validateai/README.md o SPRINTS.md.

Acción: Copia el nuevo prompt, pégalo en una nueva sesión o actualiza tu archivo de sistema, y lanza esta consulta:

"Analiza la implementación del Agente de Mercado (Market Analyst) dentro del flujo de auditoría. Identifica fricciones de latencia y propone la mejora necesaria siguiendo el nuevo protocolo sistémico."