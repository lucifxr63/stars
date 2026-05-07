# Hotfix Blueprint: Resolución de Datos Vacíos en Documentos PDF

**Contexto para Claude Code:** Eres un Ingeniero Frontend y Arquitecto Backend. El usuario ha notado que los nuevos documentos PDF (Lean Roadmap, Unit Economics y Compliance) se generan exitosamente a nivel de UI, pero el contenido dice "No hay datos disponibles". 

Tu objetivo es arreglar la asincronía entre los datos que existen en la base de datos (Zustand/Supabase) y el nuevo esquema de Zod.

## Diagnóstico del Problema (Root Cause)
Los componentes PDF están programados de forma defensiva correctamente (mostrando el mensaje de fallback). El problema es que el objeto `validationData` no contiene las propiedades `mvp_sprints`, la extensión de `financials` ni `compliance`. 

### Esto ocurre por dos casos principales:
1. **Datos Legacy (Caché):** El usuario está intentando descargar los PDFs desde una idea (ej. *FacturaIA*) que fue validada **antes** de que actualizáramos el prompt en la Edge Function (`ai-validate`).
2. **Falta de Deploy:** El prompt de la IA se actualizó en el código fuente, pero la Edge Function no fue redesplegada a Supabase.

## Sprint de Solución Inmediata (Ejecuta esto paso a paso):

### Paso 1: Actualizar y Desplegar el Backend
* **Acción:** Revisa el archivo `supabase/functions/ai-validate/index.ts` y asegúrate de que las instrucciones al LLM exijan explícitamente generar las llaves JSON de `compliance`, `mvp_sprints` y los nuevos campos de `financials`.
* **Terminal:** Ejecuta `supabase functions deploy ai-validate` para que el backend en producción comience a retornar esta nueva data.

### Paso 2: Migración de Estado (Frontend / Zustand)
* **Acción:** Revisa `src/stores/validationStore.ts` y `src/types/validation.ts`. Si la estructura de datos cambió, asegúrate de que las interfaces exportadas reflejen que estos campos pueden ser opcionales `(?)` para ideas viejas, pero obligatorios para nuevas.

### Paso 3: Forzar el Re-Análisis (Solución UX)
* **Acción:** En `src/app/routes/ValidationDetail.tsx` (o donde se consuma el Dashboard), si el sistema detecta que `!validationData.compliance` o `!validationData.mvp_sprints`, debe mostrar un Banner UI o habilitar un botón que diga: 
> *"Nuevos módulos disponibles: Haz clic en **Re-analizar Idea** para generar tu Roadmap Legal, Financiero y de MVP con la versión más reciente de la IA."*
* Esto forzará una nueva llamada a la Edge Function, poblando los datos faltantes en la base de datos de Supabase y en el estado local.

### Paso 4: Comprobación Final
* Ejecuta un test end-to-end creando una **idea completamente nueva** en el Wizard. Verifica en la consola que el JSON retornado por la Edge Function traiga los nuevos nodos antes de pasar a la vista de Resultados.
