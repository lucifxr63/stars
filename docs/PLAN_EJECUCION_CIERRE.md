# Plan de ejecución — cierre de la integración (sin romper nada)

> Estado: 2026-07-15. Ordena el trabajo pendiente en fases por **riesgo creciente sobre producción**.
> Cada fase tiene: objetivo, pasos, **verificación** y **rollback**. Se avanza sólo si la fase
> anterior quedó verde. Las fases 0–2 son riesgo-cero sobre prod; la 3 es el único paso irreversible.

## Baseline verificado (ya vivo, no tocar)

- Migración `company_identity`: **aplicada** en prod `fcdhcntyvsydnvjwopfe` (tabla + RLS + 3 policies + trigger).
- Gates de identidad: nexus (desplegado), Bralidus (PR#3 merged), Licitus (PR#6 merged).
- Bralidus cron: PR#2 merged. Cadena `Validus DD → Bralidus → S-Pulse → AuraDB` cableada en código.
- Remote correcto del monorepo: **`origin` = `lucifxr63/stars`** (`denarius` no comparte historial).

## Qué falta (resumen)

1. Mergear rama `feat/bralidus-spulse-integration` → `main` (gates Validus+Denarius + consumo DD).
2. Desplegar: Edge Function `assemble-mega-prompt` (auto en merge) + frontends Validus/Denarius.
3. Seguridad: PAT filtrado en remote de `validateai-knowledge-vault` + rotar secretos del setup.
4. Housekeeping: sync de checkouts locales stale.

---

## Automatismos relevantes (para saber qué dispara qué)

| Trigger | Workflow / integración | Efecto |
|---|---|---|
| PR → `main` (paths frontend) | `frontend-ci.yml` | gates duros: tsc + vitest + build (bloquea merge si falla) |
| push → `main` (paths `supabase/functions/**`) | `deploy-functions.yml` | **auto-deploy** de las Edge Functions cambiadas (necesita secret `SUPABASE_ACCESS_TOKEN`) |
| PR / push (paths functions) | `deno-check.yml` | type-check Deno |
| push → `main` (Vercel Git) | proyectos Vercel `validateai` / `cashflow` | deploy frontend **si** la Git integration está activa (a confirmar en Fase 4) |

**Consecuencia:** el **merge a main es el punto irreversible** — dispara el deploy del Edge Function a prod.
Todo lo previo debe estar verde antes de ese merge.

---

## Fase 0 — Pre-flight local (riesgo prod: NINGUNO)

**Objetivo:** garantizar que el merge no romperá CI ni prod, verificándolo localmente primero.

1. Build/type-check de Validus en la rama: `cd validateai && npm run build`.
2. Build de Denarius/cashflow (si el CI lo cubre): `cd cashflow && npm run build`.
3. `deno check` del Edge Function tocado: `assemble-mega-prompt/index.ts` (+ `_shared/bralidus.ts`).
4. Confirmar que existe el secret `SUPABASE_ACCESS_TOKEN` en el repo (si falta, el auto-deploy
   falla **visible** sin tocar prod → habría que desplegar el Edge Function a mano).

**Verificación:** los 3 builds/checks pasan en verde localmente.
**Rollback:** N/A (no se tocó nada remoto).

## Fase 1 — Seguridad (riesgo prod: NINGUNO; independiente)

**Objetivo:** cerrar la exposición del PAT y rotar secretos del setup.

1. **PAT filtrado** en `validateai-knowledge-vault/.git/config`:
   `git -C validateai-knowledge-vault remote set-url origin https://github.com/lucifxr63/validateai-knowledge-vault.git`
   (sin token; usar credential manager para auth). → luego **el usuario revoca el PAT** en
   GitHub → Settings → Developer settings → Personal access tokens.
2. **Rotar secretos del setup** (en pares producer↔consumer para no romper la cadena):
   `NEO4J_PASSWORD` (Aura + `nexus-api`), `BRALIDUS_API_KEY` (`bralidus-api` + Validus Edge),
   `INTERNAL_API_KEY` (`nexus-api` + cron GH). Acción manual del usuario en cada panel.

**Verificación:** `git -C validateai-knowledge-vault remote -v` no muestra token; smoke del ecosistema
sigue 200 tras cada rotación de par.
**Rollback:** el `set-url` es local y reversible; las rotaciones se hacen de a pares y se verifican.

## Fase 2 — Sync de checkouts locales (riesgo prod: NINGUNO)

**Objetivo:** alinear el working copy con lo ya mergeado en remoto.

1. `git -C validateai-developer-portal pull` (trae `master` con PR#3 ya mergeado).
   ⚠️ tiene `pulse.md` untracked + `.gitignore` mod local → decidir commit/stash antes del pull.

**Verificación:** el gate de identidad aparece en `validateai-developer-portal/src` tras el pull.
**Rollback:** `git reset --hard @{u}` si el pull ensucia (previo backup de `pulse.md`).

## Fase 3 — Merge a `main` (riesgo prod: SÍ — punto irreversible)

**Objetivo:** llevar gates Validus+Denarius + consumo DD a prod.

**Precondición:** Fase 0 verde + confirmación explícita del usuario.

1. Abrir PR `feat/bralidus-spulse-integration` → `main` en `lucifxr63/stars`.
2. Esperar CI verde (`frontend-ci` + `deno-check`).
3. Merge.
4. `deploy-functions.yml` despliega `assemble-mega-prompt` (y toda fn que importe `_shared/bralidus.ts`)
   a prod automáticamente. Vigilar el run de Actions.

**Por qué es seguro (backward-compatible):** `company_rut`/`tenant_id` son **opcionales y aditivos**;
si no hay identidad, el path DD degrada (no pasa RUT) igual que hoy. La tabla ya existe → no rompe.

**Verificación:** run de `deploy-functions` verde; `assemble-mega-prompt` responde en prod.
**Rollback:** `git revert` del merge → nuevo push a main re-despliega la versión previa del Edge Function.

## Fase 4 — Deploy de frontends (riesgo prod: MEDIO)

**Objetivo:** publicar Validus y Denarius con el gate.

1. Confirmar si `validateai` y `cashflow` tienen **Vercel Git integration** (deploy auto en push a main).
   - Si sí: el merge de Fase 3 ya los desplegó → sólo verificar.
   - Si no (Validus flagship): deploy manual (`vercel --prod` o botón en dashboard).

**Verificación:** `validus.scouttech.lat` carga; tras login aparece el gate de identidad.
**Rollback:** en Vercel, "Promote to Production" del deployment previo (instantáneo).

## Fase 5 — Verificación E2E del payoff (riesgo prod: NINGUNO)

**Objetivo:** confirmar que la interconexión llega al usuario.

1. Usuario con identidad → validación **Due Diligence** con RUT real.
2. En logs de `bralidus-api`: confirmar hit a `/spulse/companies/{rut}/*`.
3. La respuesta de Bralidus trae la sección de relaciones societarias S-Pulse.
4. Smoke del ecosistema:
   ```
   GET  https://api.nexus.scouttech.lat/api/health    → 200
   GET  https://api.bralidus.scouttech.lat/health     → spulse "alcanzable"
   UI   nexus / bralidus / validus                    → login + gate OK
   ```

**Verificación:** las relaciones S-Pulse aparecen en un informe DD real.
**Rollback:** N/A (sólo lectura).

---

## Orden de ejecución

Fase 0 → 1 → 2 (riesgo cero, en cualquier orden entre sí) → **[confirmación]** → 3 → 4 → 5.
