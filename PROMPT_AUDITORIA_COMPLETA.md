# Auditoría completa — ValidateAI
## Prompt para Claude Code

No modifiques ningún archivo todavía. Este es un ejercicio de lectura y análisis completo.
Necesito que recorras el proyecto `validateai/` y me entregues un reporte estructurado en las secciones que se detallan abajo.

---

## SECCIÓN 1 — Mapa completo de la base de datos

Lee TODOS los archivos en `supabase/migrations/` en orden cronológico.

Para cada tabla que exista en el schema final (después de todas las migraciones), entrega:

```
Tabla: nombre_tabla
Columnas: lista completa con tipo y constraints
Relaciones FK: hacia qué tablas apunta
RLS: activo sí/no
Políticas RLS: lista de nombres de políticas
Índices: lista
Estado: activa / probablemente deprecada / sin uso aparente
```

Al final de esta sección, dibuja el mapa de relaciones entre tablas (texto ASCII o lista de FKs).

---

## SECCIÓN 2 — Mapa completo de Edge Functions

Lee el `index.ts` de cada función en `supabase/functions/`.

Para cada función entrega:

```
Función: nombre
Ruta de invocación: supabase.functions.invoke('nombre', ...)
Propósito: qué hace
Modelo IA que usa: OpenAI / Anthropic / ninguno
Prompt types que maneja: lista de strings (ej: 'questions', 'summary', etc.)
Tablas que lee: lista
Tablas que escribe: lista
Variables de entorno que requiere: lista
Llamada desde frontend: sí/no — desde qué archivo/componente
Estado: activa / posiblemente deprecada / sin llamadas desde frontend
```

---

## SECCIÓN 3 — Mapa completo del wizard de validación

Lee los archivos en `src/components/wizard/` y `src/app/routes/Validate.tsx`.

Necesito entender:

1. **Cuántos steps reales hay** — lista cada Step con su archivo, su propósito y qué datos captura/genera
2. **El store de Zustand** — muestra el tipo completo del estado (`validationStore.ts` o similar), todos los campos y todas las acciones
3. **El flujo de llamadas a IA** — en qué step se llama a qué Edge Function con qué `prompt_type`
4. **Dónde se guarda en DB** — en qué momento del wizard se hace INSERT/UPDATE en `validations`

---

## SECCIÓN 4 — Los dos flows de validación

Sé que existen (o existieron) dos modalidades:
- **Flow rápido** — la IA genera todo con mínima intervención del usuario
- **Flow detallado** — más preguntas, más pasos, más profundidad

Necesito que busques en todo el código evidencia de esto:

1. ¿Hay algún flag, variable, campo en el store o en la DB que distinga ambos flows? (buscar: `fast`, `quick`, `mode`, `flow`, `type`, `deep`, `detailed`, `short`, `express`)
2. ¿Hay steps que se saltan según alguna condición? Buscar en `Validate.tsx` cualquier lógica de `if` que cambie el step actual o lo salte
3. ¿Hay campos en `validations` como `validation_mode`, `flow_type` o similares?
4. ¿Hay algún componente de selección de modo que haya sido creado pero no esté conectado?
5. Muestra los fragmentos de código exactos donde encuentres cualquiera de las anteriores

---

## SECCIÓN 5 — Auditoría de componentes frontend

Recorre `src/components/` y `src/app/routes/` completo.

Para cada archivo entrega una línea:

```
Archivo | Propósito | Importado/usado desde | Estado
```

Estado puede ser:
- `✅ activo` — se renderiza en algún flujo real del usuario
- `⚠️ parcial` — existe pero no está completamente conectado
- `❌ huérfano` — no es importado por nadie
- `🔒 admin` — solo accesible desde /admin

Para los componentes en `src/components/shared/` prestar especial atención — hay muchos y sospecho que varios son huérfanos o están duplicados.

---

## SECCIÓN 6 — Auditoría de rutas

Lee `src/App.tsx` completo y lista todas las rutas con:

```
Path | Componente | Protegida | Accesible desde UI (hay link/botón) | Estado
```

---

## SECCIÓN 7 — Dependencias y packages

Lee `package.json`. Lista:

1. **Dependencias instaladas pero sin uso aparente** — busca en el código si se importa cada package
2. **Packages que podrían estar desactualizados o deprecados** — especialmente los que tienen versiones muy viejas
3. **Packages en `dependencies` que deberían estar en `devDependencies`**

---

## SECCIÓN 8 — Deuda técnica y recomendaciones

Basándote en todo lo anterior, entrega una tabla priorizada:

```
Prioridad | Área | Problema | Recomendación | Esfuerzo estimado
🔴 Alta   | ...  | ...      | ...           | horas/días
🟡 Media  | ...  | ...      | ...           | ...
🟢 Baja   | ...  | ...      | ...           | ...
```

Incluir específicamente:
- Código muerto / componentes sin usar
- Tablas de DB sin uso
- Inconsistencias entre el schema y el código
- Features a medio implementar
- Riesgos de seguridad obvios (RLS faltante, keys expuestas, etc.)

---

## SECCIÓN 9 — Plan para implementar selector de flow

Con toda la información anterior, propón cómo implementar la elección entre **flow rápido** y **flow detallado** en ValidateAI.

Específicamente necesito saber:

1. **Qué cambios requiere el store de Zustand** — qué campo agregar para guardar el modo elegido
2. **Qué cambios requiere la DB** — si hay que agregar una columna en `validations`
3. **Dónde mostrar el selector** — ¿en Landing? ¿en el Step 1? ¿en una pantalla previa al wizard?
4. **Qué steps se omiten en el flow rápido** — basado en el código actual, cuáles podrían generarse automáticamente sin input del usuario
5. **Qué prompt_type de la Edge Function `ai-validate` se usaría para generar los steps omitidos** — o si hay que crear un nuevo prompt_type

Muestra el código mínimo necesario para el selector (solo el componente de elección, no todo el flujo).

---

## Formato de entrega esperado

Entrega el reporte completo en un solo bloque de texto estructurado con las 9 secciones.
Si algún archivo es muy largo para leer completo, prioriza los fragmentos más relevantes para cada sección.
No hagas cambios. Solo lee, analiza y reporta.
