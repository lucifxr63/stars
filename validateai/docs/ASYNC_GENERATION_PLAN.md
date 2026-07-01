# Validus — Generación asíncrona: mapa actual y plan por fases

> **Estado:** Documento técnico · actualizado 2026-07-01 (Fase 15)
> **Propósito:** mapear cómo funciona hoy la generación del dossier y definir una estrategia **incremental** (sin sobrerrefactor) para volverla más robusta y escalable de cara a pilotos y usuarios concurrentes.
> **Alcance ejecutado:** Fase 11 (documentación + analítica) y **Fase 15 (11B + 11C: estado `partial` explícito + async real server-side)**. Ver §3 para el estado por sub-fase.

## 0. TL;DR (Fase 15 — desplegado)

- **11B — estado `partial`/`failed` explícito:** `validations.status` ya distingue `completed` / `partial` / `failed`; el `GenerationStatusWidget` lo surfacia (verde / ámbar "N secciones no se generaron" / rojo "no pudimos generar"). Migración aplicada en prod.
- **11C — async real server-side:** tabla `generation_jobs` (cola + estado por-task), Edge `enqueue-generation` que ejecuta el job con **`EdgeRuntime.waitUntil`** usando el **JWT fresco del usuario** (tab-independiente, sin tocar `ai-validate`/`premium-validate` ni guardar tokens), y Edge `process-generation-jobs` (**cron janitor** que finaliza jobs colgados). **Premium ya es asíncrono** (encola + polling con la terminal en vivo preservada). Verificado e2e en prod: enqueue → `running` → `done`/`completed` en ~8s.
- **Decisión de arquitectura clave:** se descartó el "cron-worker puro" porque `ai-validate`/`premium-validate` identifican al usuario **solo por JWT** (rate-limit + scoping) y el cron no lo tiene. `waitUntil` con el JWT del request resuelve esto sin tocar esas Edge.

---

## 1. Mapa del flujo actual

### 1.1 No-premium (quick / detailed) — **background real** ✅

```
Wizard (último paso) → <StepGenerating> (mount)
  → startGeneration()  [src/components/wizard/StepGenerating.tsx]
    → startBackgroundGeneration()  [src/lib/generationService.ts]
        1. Crea/actualiza fila `validations` (status=in_progress, current_step=4)
        2. Lee generation_progress previo → REANUDA (salta tasks ya 'success')
        3. Dispara runTasksInBackground(...) SIN await  (fire-and-forget)
        4. Devuelve { status: 'started' | 'completed' }
    → navigate('/dashboard')  (no bloquea la UI)
  GenerationStatusWidget (dashboard) POLEA validations in_progress y muestra avance
```

`runTasksInBackground`:
- `Promise.allSettled` sobre las tasks del tier (free=1, basic=2, pro/premium=3 prompts).
- Cada task → `fetch ai-validate` → éxito/error persistido por-task vía RPC `merge_generation_progress`.
- Al terminar: `validations.status = 'completed'` (**incluso con fallos parciales**) + analítica.

**Propiedades clave:** progreso **persistente** (`generation_progress` JSONB) y **resumible**; el frontend no se bloquea; recarga/relogin retoman vía el widget de polling.

### 1.2 Premium — **síncrono con timeout** ⚠️

```
<StepGenerating> (mount) → startGeneration() → rama premium
  → crea fila → fetch premium-validate  (AWAITED, AbortSignal.timeout = 60s)
     mientras espera: <PremiumTerminal> (mensajes cíclicos)
  → éxito  → setPremiumResult → navigate('/results/:id')
  → timeout/abort → toast + navigate('/dashboard')  (job persiste server-side)
```

> **⚠️ SUPERADO en Fase 15 (11C-c).** Premium ya NO es síncrono: encola vía
> `enqueue-generation` (server-side con `waitUntil`) + polling con la terminal
> preservada. El flujo de abajo describe el estado previo (pre-Fase 15).

Bloquea el `await` hasta 60s, pero con terminal en vivo y **fallback elegante** al dashboard si se demora. No es asíncrono real.

### 1.3 Reintentos
`handleRetryTask` (StepGenerating) reintenta una task puntual (`ai-validate` con `retry_task`) sin re-correr las exitosas; actualiza `generation_progress`.

### 1.4 Persistencia y estado
| Dónde | Qué |
|---|---|
| `validations.status` | `in_progress` / `completed` / `partial` / `failed` *(11B)* |
| `generation_jobs` *(11C)* | cola + estado por-task del job async (fuente de orquestación) |
| `validations.generation_progress` (JSONB) | estado por-task (`success`/`error`/`pending`) vía RPC `merge_generation_progress` |
| Zustand `validationStore` | datos del wizard + `validationId` (persistidos a localStorage) |
| Premium | `agent_log` / `reddit_status` / `trends_status` / `errors` en el payload |

### 1.5 Analítica de generación
| Evento | Cuándo | Flujo |
|---|---|---|
| `validation_generation_started` | mount de StepGenerating (tier-agnóstico) | ambos |
| `validation_generation_completed` | fin sin fallos | ambos *(añadido en Fase 11)* |
| `validation_generation_partial` | fin con fallos parciales | no-premium *(Fase 11)* |
| `validation_generation_failed` | todas fallan / timeout / error | ambos *(Fase 11)* |
| `validation_completed` (KPI legacy) | fin no-premium | no-premium |

Propiedades (PII-safe): `is_premium`, `tier`, `sections_requested/completed/failed`, `duration_ms`, `failure_type`. **Nunca** idea, prompts, outputs, nombres, email, RUT.

---

## 2. Problemas / límites (estado tras Fase 15)

1. ~~**Fallo parcial silencioso a nivel de estado**~~ → **RESUELTO (11B):** `validations.status` distingue `partial`/`failed` y el widget lo surfacia.
2. ~~**Premium síncrono (60s)**~~ → **RESUELTO (11C-c):** premium encola + polling; el trabajo corre server-side vía `waitUntil`, no depende del timeout.
3. ~~**Sin cola real**~~ → **RESUELTO (11C):** tabla `generation_jobs`; el premium corre server-side aunque se cierre la pestaña. *(No-premium sigue en background del navegador; migrarlo a enqueue es opcional — ya tiene estado `partial`.)*
4. **Reanudación por-task server-side (parcial):** el janitor finaliza jobs colgados pero **no re-ejecuta** tasks (no tiene JWT). El reintento lo dispara el usuario (botón Reintentar) o queda para 11D.

---

## 3. Estrategia por fases (incremental)

### Fase 11A — Robustez sobre lo existente *(esta fase)*
- Analítica de fiabilidad (completed/partial/failed + conteos + duración) en ambos flujos. ✅
- Documentar el flujo y los límites (este documento). ✅
- *(Opcional futuro, presentacional)* mostrar conteo de secciones fallidas en el `GenerationStatusWidget` y un aviso honesto de "no pudimos generar X" en el dossier.

### Fase 11B — Estado `partial` explícito ✅ *(Fase 15 — desplegado)*
- Migración: `validations.status` CHECK ampliado a `in_progress/completed/archived/partial/failed`.
- `generationService.ts`: estado final calculado sobre el set COMPLETO del tier (reanudación-aware): todo ok→`completed`, algunos→`partial`, ninguno→`failed` (antes: siempre `completed`).
- `GenerationStatusWidget`: cards verde/ámbar/roja + toasts diferenciados.

### Fase 11C — Async server-side ✅ *(Fase 15 — desplegado)*
- Tabla `generation_jobs` (`queued/running/partial/done/failed`, `tasks` json, `attempts`, `last_error`) + RLS (lee lo suyo) + índice único parcial (1 job activo/validación).
- Edge `enqueue-generation`: materializa tasks, inserta job idempotente y ejecuta con **`EdgeRuntime.waitUntil` + JWT del usuario** (NO cron-worker puro — ver nota).
- Edge `process-generation-jobs`: **cron janitor** (finaliza jobs colgados >5 min; no re-ejecuta tasks).
- **Premium fire-and-forget + polling** con la terminal preservada (11C-c).
- Idempotencia por `validation_id` (job activo único). Reintento server-side por-task queda para 11D.

> **Nota de arquitectura (¿por qué `waitUntil` y no cron-worker puro?):** `ai-validate`/`premium-validate` identifican al usuario **solo por JWT** (rate-limit `check_and_increment_usage` + scoping por `user_id`). Un cron con service-role no tiene esa identidad. `waitUntil` ejecuta el job en la misma invocación de `enqueue` con el **JWT fresco** del request → server-side y tab-independiente **sin** tocar esas Edge ni guardar tokens. El cron queda como janitor.

### Fase 11D — Reintentos y polling robustos *(pendiente)*
- Reintento automático server-side de tasks `error` (N intentos) antes de `failed`.
- Backoff; notificación al completar un job largo (reusar `followup-email`/Resend cuando haya dominio).
- Sync de `generation_progress` para premium (hoy queda `null`; el job.tasks es la fuente autoritativa — cosmético).

---

## 4. Qué NO se tocó (Fases 11 y 15)

`ai-validate`, `premium-validate`, prompts, score, tiers, RPC `merge_generation_progress`, auth, pagos. La Fase 15 **invoca** esas Edge (con el JWT del usuario) pero no cambia su lógica. Cambios de schema de la Fase 15: `validations.status` (ampliar CHECK) + tabla nueva `generation_jobs` — ambos aditivos, aplicados en prod.
