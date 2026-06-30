# Validus — Generación asíncrona: mapa actual y plan por fases

> **Estado:** Documento técnico · 2026-06-30 (Fase 11)
> **Propósito:** mapear cómo funciona hoy la generación del dossier y definir una estrategia **incremental** (sin sobrerrefactor) para volverla más robusta y escalable de cara a pilotos y usuarios concurrentes.
> **Alcance de la Fase 11:** documentación + analítica de fiabilidad. La cola/worker real requiere schema/Edge nuevos y queda planificada para una fase posterior.

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

Bloquea el `await` hasta 60s, pero con terminal en vivo y **fallback elegante** al dashboard si se demora. No es asíncrono real.

### 1.3 Reintentos
`handleRetryTask` (StepGenerating) reintenta una task puntual (`ai-validate` con `retry_task`) sin re-correr las exitosas; actualiza `generation_progress`.

### 1.4 Persistencia y estado
| Dónde | Qué |
|---|---|
| `validations.status` | `in_progress` / `completed` |
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

## 2. Problemas / límites actuales

1. **Fallo parcial silencioso a nivel de estado:** la validación se marca `completed` aunque falten secciones (los errores quedan por-task en `generation_progress`, pero el `status` no distingue "parcial"). *Fase 11 lo hace medible vía `validation_generation_partial`; surfaciarlo en BD/UI requiere decisión aparte.*
2. **Premium síncrono (60s):** no escala a alta concurrencia ni a reportes muy largos; depende del timeout.
3. **Sin cola real:** los jobs viven en el ciclo de vida de la pestaña (no-premium: el `fetch` corre en background del navegador; si el usuario cierra todo antes de que terminen, las tasks pendientes no se reanudan solas server-side).
4. **Reanudación depende del cliente:** el resume lo orquesta el frontend (salta tasks `success`), no un worker server-side.

---

## 3. Estrategia por fases (incremental)

### Fase 11A — Robustez sobre lo existente *(esta fase)*
- Analítica de fiabilidad (completed/partial/failed + conteos + duración) en ambos flujos. ✅
- Documentar el flujo y los límites (este documento). ✅
- *(Opcional futuro, presentacional)* mostrar conteo de secciones fallidas en el `GenerationStatusWidget` y un aviso honesto de "no pudimos generar X" en el dossier.

### Fase 11B — Tabla de jobs (requiere schema)
- Tabla `generation_jobs` (o ampliar `validations`): `id`, `validation_id`, `status` (`queued/running/partial/done/failed`), `tasks` (json con estado por prompt), `attempts`, `last_error`, `created_at`, `updated_at`.
- El frontend deja de orquestar; solo **encola** y **consulta estado**.
- Estado `partial` explícito (hoy se colapsa en `completed`).

### Fase 11C — Worker / Edge async (requiere Edge nueva)
- Una Edge Function/worker consume `generation_jobs` y ejecuta los prompts **server-side** (no atado a la pestaña).
- **Premium pasa a fire-and-forget + polling**, igual que no-premium → coherencia total y fin del timeout de 60s.
- Reintentos server-side con backoff; idempotencia por `validation_id + prompt_type`.

### Fase 11D — Reintentos y polling robustos
- Polling con backoff exponencial en el widget; cancelación al completar.
- Reintento automático de tasks `error` (N intentos) antes de marcar `failed`.
- Notificación (email/in-app) al completar un job largo (reusar `followup-email` / Resend cuando haya dominio).

> Premium async real = **Fase 11C** (worker + polling). Hoy se mantiene el síncrono-con-timeout, que funciona con fallback elegante.

---

## 4. Qué NO se tocó en Fase 11

`ai-validate`, `premium-validate`, prompts, score, tiers, schema de `validations`, RPC `merge_generation_progress`, auth, pagos. Solo se añadió analítica frontend PII-safe y este documento. Los pasos 11B–11D requieren aprobación explícita por tocar schema/Edge Functions.
