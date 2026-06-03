# Documento de Mesa Directiva: Estructura Sprint A y Lógica de Negocio

**Producto:** ValidateAI
**Fecha:** 01 de Junio 2026

Aprobamos el inicio del ciclo de desarrollo. Para mantener la estabilidad del sistema en producción alojado en Vercel y Supabase, la ejecución debe ser quirúrgica. A continuación, se detalla la estructuración del **Sprint A**, la definición de la lógica condicional para el frontend, y el acta de decisiones estratégicas acordadas.

---

## 1. Estructuración Sprint A: Base de Datos y Contratos

El objetivo de este sprint es preparar los cimientos sin romper las validaciones en curso. Las migraciones deben ser retrocompatibles temporalmente.

### Épica 1: Actualización del Modelo de Datos (Supabase)

| User Story | Descripción y Criterios de Aceptación |
| --- | --- |
| **Migración SQL `validations**` | Crear migración en Supabase para añadir columnas a la tabla `validations`.

<br>

<br>• `idea_problem` (text, nullable).<br>

<br>• `team_composition` (varchar, nullable).<br>

<br>• `traction_status` (varchar, nullable).<br>

<br>• *Criterio:* Las filas históricas no deben romperse al quedar nulas temporalmente. |
| **Limpieza de Deuda Técnica** | Preparar el script de migración para eliminar `hasTechnicalCofounder`.

<br>

<br>• *Criterio:* El borrado físico de la columna se ejecutará solo después del Sprint C (cuando los prompts de IA ya no lo requieran).

 |

### Épica 2: Sincronización de Contratos Zod y TypeScript

| User Story | Descripción y Criterios de Aceptación |
| --- | --- |
| **Actualización de Schemas** | Modificar `types/validation.ts` para reflejar el nuevo modelo.

<br>

<br>• Remover `.optional()` de `current_solution`.

<br>

<br>• Añadir los nuevos campos categóricos con sus respectivos `z.enum()`.<br>

<br>• *Criterio:* Los tipos inferidos de TypeScript deben coincidir exactamente con las nuevas respuestas esperadas del frontend. |
| **Gestión de Sesiones (Zustand)** | Implementar versionado en el store de Zustand persistido en `localStorage`.

<br>

<br>• *Criterio:* Si se detecta una versión de esquema obsoleta (`validateai-session`), el sistema debe forzar un reset del store para evitar crasheos de Zod a mitad del flujo. |

---

## 2. Definición de Lógica Condicional: Frontend (Paso 2 - Mercado)

Para resolver el requerimiento del campo `target_region` sin introducir fricciones innecesarias a usuarios internacionales, el componente `StepMarket.tsx` implementará la siguiente lógica de renderizado:

**Flujo de la Lógica:**

1. El usuario selecciona un valor en el campo `target_country`.


2. Se evalúa el estado de `target_country`.
3. **Condición A (`target_country === 'Chile'`):** Se renderiza un componente `<Select/>` poblado con un array estático de las 16 regiones de Chile. El valor seleccionado se guarda en `target_region`.
4. **Condición B (`target_country !== 'Chile'`):** Se renderiza un componente `<TextInput/>` estándar (free text) con la etiqueta "Región/Ciudad específica" (Opcional).

Esta estructura nos permite recolectar data estructurada para nuestro análisis interno en Chile, manteniendo la flexibilidad global que requiere un producto SaaS.

---

## 3. Acta de Decisiones Estratégicas (Resolución de Fricciones)

Como Mesa Directiva, establecemos las siguientes directrices irrevocables para este ciclo de desarrollo, resolviendo los puntos críticos levantados en el análisis previo:

* **UX / Anticipación de Score (Paso 3):** Se implementará la **Opción C**. Se mostrará una animación o placeholder estilizado (ej. un radar formándose en estado "Calculando dimensiones") mientras la IA procesa. Queda estrictamente prohibido mostrar números ficticios o realizar pre-llamadas de IA que aumenten costos o latencia.
* **El Campo Zombie (`hasTechnicalCofounder`):** Este campo será **eliminado** del modelo. La composición del equipo (`team_composition`) será la única fuente de verdad. El equipo técnico debe asegurar que el prompt de `founder_fit` se actualice simultáneamente para no generar una degradación en la evaluación.


* **Integración Banco Central:** Esta feature queda **descartada y fuera de alcance** para este Q. La captura de las 16 regiones de Chile se utilizará exclusivamente para telemetría interna y analítica de tendencias en nuestra base de datos, no para enriquecer el prompt en esta iteración.


* **Manejo de Sesiones Obsoletas:** Se aprueba el reset forzoso de `localStorage`. Es preferible que un porcentaje mínimo de usuarios pierdan el progreso de su wizard a que experimenten una aplicación rota en producción debido a fallos de validación en los esquemas actualizados.