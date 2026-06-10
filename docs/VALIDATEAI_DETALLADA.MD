# Documento de Mesa Directiva: Optimización del Wizard "Detallado"

**Producto:** ValidateAI
**Fecha:** 01 de Junio 2026

Como Mesa Directiva, consideramos que optimizar el flujo "Detallado" es una jugada estratégica crucial. Actualmente, este flujo consta de cuatro pasos: Idea, Mercado, Fundador y Generación. Si mejoramos la captura de datos aquí, no solo aumentamos el valor del reporte para el usuario (justificando la conversión a pago), sino que construimos un "data moat" (foso defensivo de datos) para ValidateAI con tendencias macroeconómicas de startups en LatAm.

A continuación, se presenta el análisis estratégico y el plano estructurado para rediseñar la modalidad **Detallada**.

---

## 1. Estrategia de Captura de Datos (Valor Interno vs. Privacidad)

Para nutrir el sistema de ValidateAI sin infringir normativas de protección de datos, debemos separar la información en dos capas: **Datos transaccionales (para el usuario)** y **Datos analíticos (para nuestro sistema)**.

### Qué guardar anonimizado para nuestro sistema

- **Tendencias de Mercado (Macro):** Combinación de Industria, País/Región y Modelo de Negocio.
- **Comportamiento de Pricing:** Cruzar la industria con el campo de "Rango de precio" para entender la elasticidad de precio esperada por los fundadores.
- **Gaps de los Fundadores:** Analizar estadísticamente qué porcentaje de equipos carecen de perfiles técnicos frente a la complejidad de la solución propuesta.
- **Métricas de UX (Telemetría):** Tiempo de permanencia por campo, uso de la función "Atrás", y ratio de completitud del texto de la idea para alimentar el evento `wizard_abandoned`.

**Regla de Privacidad:** Antes de almacenar estos datos en la capa analítica, se debe hacer un hash del `user_id` y eliminar textos libres (como "Nombre de la idea" y "Descripción") que puedan contener propiedad intelectual o nombres propios, guardando solo la metadata categórica.

---

## 2. Plano Estructurado: Mejoras al Flujo "Detallado"

Actualmente existen "gaps" identificados en el documento de arquitectura que diluyen la precisión de la IA. Aquí está el diseño optimizado paso a paso:

### PASO 1: IDEA (Enfoque en el Problema)

El objetivo es obligar al usuario a separar el _problema_ de la _solución_.

- **Nombre de la idea:** (Obligatorio).
- **Problema a resolver:** (Nuevo campo separado). Al separar el problema de la solución, la IA puede evaluar el "Founder-Market Fit" de manera más precisa.
- **Descripción de la solución:** (Obligatorio). Mantener el indicador visual de calidad.
- **Solución actual (Incumbentes):** (Mejorado). Se aborda el gap actual de estar subutilizado. **Cambio:** Convertirlo en campo obligatorio y pedir explícitamente "Nombra 2 herramientas o métodos que usa tu cliente hoy". Esto alimentará directamente el análisis de competencia.
- **Industria:** (Selección).

### PASO 2: MERCADO (Enfoque en Viabilidad)

Debemos estructurar los datos para que sean procesables estadísticamente.

- **Perfil de cliente ideal (ICP):** (Obligatorio).
- **País objetivo:** (Obligatorio).
- **Región específica:** Se aborda el gap actual de ser un campo libre sin mapear. **Cambio:** Mapear a las 16 regiones de Chile para activar datos del Banco Central en el análisis de mercado.
- **Modelo de negocio & Rango de precio:** (Obligatorio).
- **Canal de adquisición principal:** Se aborda el gap actual de no tener uso en los prompts. **Cambio:** Hacerlo obligatorio y conectarlo directamente a un nuevo bloque en el prompt de IA para generar recomendaciones de "Unit Economics" (CAC esperado según el canal).

### PASO 3: FUNDADOR Y TRACCIÓN (El gran diferenciador)

Se aborda el gap actual donde este paso es muy corto y no captura equipo ni tracción. Para que el motor de IA actúe como un "socio de fondo VC implacable", necesitamos saber si solo hay una idea o si hay ejecución.

- **Años de experiencia en la industria:** (Obligatorio).
- **¿Ha vivido el problema personalmente?:** (Obligatorio).
- **Composición del Equipo:** (Nuevo). Dropdown: Solo Founder / Equipo Fundador / Equipo + Empleados.
- **Capacidad Técnica:** Mantener la selección entre No técnico, Algo de código, o Equipo completo.
- **Estado de Tracción:** (Nuevo y Crucial). Dropdown: Idea en papel / MVP en desarrollo / MVP lanzado sin ventas / Con primeros clientes pagos. Esto cambia drásticamente cómo la IA evalúa la dimensión "Ejecución", la cual pesa un 15% del score final.

---

## 3. El "Acompañamiento": Mejoras en la Experiencia de Usuario (UX)

Para evitar el abandono y mejorar la calidad de las respuestas de los usuarios, el wizard debe ser dinámico:

1. **Refuerzo Positivo Intermedio (Gamificación):** Al terminar el Paso 2 (Mercado), mostrar un mensaje dinámico generado localmente. Ejemplo: _"Interesante combinación de Fintech B2B en México. Ahora cuéntanos sobre el equipo para calcular tu Score de Ejecución."_
2. **Preview del Score (Anticipación):** Mostrar un mini-preview del desglose estimado al terminar el Paso 3, como se propuso en las oportunidades de mejora de UX. Esto empuja al usuario a esperar la generación sin cerrar la pestaña.
3. **Progreso Pegajoso (Sticky Progress):** Implementar la barra de progreso visible en todo momento en pantallas pequeñas.

---

_Nota de la Mesa Directiva: Esta estructura resuelve las inconsistencias de los prompts actuales, captura data valiosa para su analítica interna de forma segura y mejora sustancialmente la precisión de la IA. Quedamos a la espera de la confirmación para proceder con el análisis de las modalidades "Rápido" y "Premium"._
