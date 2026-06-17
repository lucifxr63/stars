# Founder Fit — Arquitectura del flujo y roadmap

> Última actualización: 2026-06-16. Resultado de la sesión que estabilizó el
> Founder-Market Fit (PRs #14–#20). Este doc describe **cómo funciona hoy** y
> **hacia dónde va**.

---

## 1. Qué es

`founder_fit` es una de las secciones del reporte de validación. Evalúa qué tan
bien posicionado está el fundador para ejecutar **esta idea específica**, en 5
dimensiones (0–100 cada una):

| Dimensión | Significado |
|-----------|-------------|
| `problemKnowledge` | ¿Entiende el problema? ¿lo vivió? |
| `industryExperience` | Años/profundidad en la industria |
| `technicalCapability` | Capacidad del equipo de construir |
| `networkStrength` | Red de contactos / distribución |
| `trackRecord` | Ejecución demostrada |

Se persiste como columna JSONB `founder_fit` en la tabla `validations`.

---

## 2. Modelo HÍBRIDO de datos (estado actual)

El score se alimenta de **dos fuentes complementarias**:

### Fuente A — Perfil del fundador a nivel **usuario** (`founder_profiles`)
- Tabla 1:1 con el usuario (`supabase/migrations/20260525_founder_profiles.sql`).
- Identidad **persistente** del fundador: experiencia, skills, trayectoria,
  `competency_scores`. Vale para **todas** sus ideas.
- Se llena de dos formas (`FounderProfileTab.tsx`):
  - **Manual**: nombre, headline, bio, años, skills y **trayectoria laboral**
    (editable desde PR #20). `competency_scores` queda `null` (se infieren).
  - **LinkedIn**: extracción automática vía `extract-founder-profile` /
    `linkedin-oauth-callback` → trae `competency_scores` y experiencia
    verificada. **Bloqueado** hasta crear la LinkedIn Company Page
    (ver `LINKEDIN_OAUTH_INTEGRATION.md` / `LINKEDIN_COMPANY_PAGE.md`).
- Es la **única señal disponible en el flujo premium** (ver §3).

### Fuente B — Datos de **esta idea** (wizard, solo flujo detallado)
- `StepFounder.tsx` captura: `personallyFacedProblem`, `yearsInIndustry`,
  `team_composition`, `tech_level`, `traction_status`, `commitment_level`,
  `customer_interviews`, `unfair_advantage`.
- Se guardan en `validations.founder_context` (JSONB) + columnas
  `team_composition` / `tech_level` / `traction_status`.

### Fusión
`ai-validate/index.ts → buildFounderContext()` arma un bloque de prompt con
ambas fuentes y una línea **FUSIÓN** que le indica al LLM cómo combinarlas:
- Ambas presentes → perfil ancla la identidad, wizard ajusta lo de la idea.
- Solo perfil (premium) → evalúa con el perfil como fuente principal.
- Solo wizard (sin perfil) → evalúa con el wizard.
El prompt incluye una **regla anti-cero**: no devolver las 5 dimensiones en 0 si
hay cualquier señal.

---

## 3. Diferencia crítica entre flujos (causa raíz histórica)

| Flujo | Pasos del wizard | ¿Captura datos de fundador? |
|-------|------------------|-----------------------------|
| **Detallado** | Idea → Mercado → **Fundador** → Generación | ✅ Sí (Fuente B) |
| **Premium** | Upload → Idea → Mercado → Generación | ❌ **No tiene Paso Fundador** |
| **Quick** | Idea rápida → Generación | ❌ No |

Ver `Validate.tsx` (`STEP_COMPONENTS_PREMIUM` vs `STEP_COMPONENTS_DETAILED`).

→ Por esto un reporte **premium** depende 100% del **perfil a nivel usuario**
(Fuente A). Si el usuario no completó su perfil en Settings, el `founder_fit`
sale en 0. Este fue el bug original.

---

## 4. Componentes de UI (vista única)

Desde PR #19 hay **una sola vista**: `FounderFitCard` (radar + gaps +
recomendaciones), usada en **ambas** pestañas (Veredicto y Validación). El
widget compacto `VerdictFounderFit` fue eliminado.

`FounderFitCard` maneja 3 estados:
1. **Sin analizar** (`data == null`) → CTA "Generar Análisis Pro".
2. **Sin datos** (todas las dimensiones en 0) → CTA **contextual** (PR #18):
   - Perfil ya existe → "Regenerar análisis" + link "Editar perfil".
   - Sin perfil → "Completar perfil de fundador" → `/profile#founder-profile`.
3. **Poblado** → radar de 5 dimensiones + gaps + ruta sugerida.

### Hidratación y regeneración (`ValidationDetail.tsx`)
- Al abrir el reporte se hidrata `founder_profiles` desde la DB → `founderProfile`.
- `buildFounderCtx()` inyecta perfil + wizard al contexto.
- `handleRegenerateFounderFit()` fuerza el recálculo aunque ya exista.

---

## 5. Roadmap / futuro

### Corto plazo (cuando haya señal de que importa)
- [ ] **Captura de trayectoria en premium.** Hoy premium no pide datos de
      fundador; depende del perfil en Settings. Opciones: (a) un paso opcional
      post-generación que invite a completar el perfil, (b) un banner en el
      reporte premium. Evitar agregar fricción al flujo "upload-and-go".
- [ ] **Education en el form manual.** `work_experience` ya es editable (PR #20);
      `education[]` sigue sin UI de carga manual.

### Medio plazo
- [ ] **Desbloquear LinkedIn OAuth** (crear Company Page → `LINKEDIN_COMPANY_PAGE.md`).
      Habilita `competency_scores` verificados y autocompletado de trayectoria.
      Es el mayor salto de calidad del score sin esfuerzo del usuario.
- [ ] **NO agregar sliders de competencias auto-evaluados.** Decisión explícita:
      la auto-calificación es señal sesgada y contradice el "veredicto VC sin
      filtros". Los `competency_scores` deben venir de datos objetivos
      (LinkedIn) o inferirse de la trayectoria, nunca auto-declararse.

### Largo plazo / ideas
- [ ] **Founder Fit comparativo** contra benchmarks de fundadores del sector
      (requiere dataset).
- [ ] **Versionado del perfil**: que el score refleje el perfil al momento de la
      validación, no el actual (hoy regenerar usa el perfil vigente).
- [ ] **Reuso del perfil** en otras secciones (pitch, fundraising) — el perfil ya
      es a nivel usuario, está infrautilizado.

---

## 6. Archivos clave

| Archivo | Rol |
|---------|-----|
| `supabase/functions/ai-validate/index.ts` | Prompt `founder_fit` + `buildFounderContext()` / `buildUserContent()` |
| `src/components/shared/FounderFitCard.tsx` | Vista única (3 estados) |
| `src/components/shared/FounderProfileTab.tsx` | Perfil a nivel usuario (manual + LinkedIn) |
| `src/app/routes/ValidationDetail.tsx` | Hidratación, `buildFounderCtx`, regeneración |
| `src/app/routes/Validate.tsx` | Mapa de pasos por flujo (premium sin Paso Fundador) |
| `src/components/wizard/StepFounder.tsx` | Captura per-idea (flujo detallado) |
| `supabase/migrations/20260525_founder_profiles.sql` | Tabla `founder_profiles` |
| `supabase/functions/extract-founder-profile/` | Extracción LinkedIn (bloqueado) |

---

## 7. Historial de la estabilización (2026-06-16)

| PR | Cambio |
|----|--------|
| #14 | Fix A/B/C: contexto real del fundador + LinkedIn al prompt; botón Regenerar |
| #15 | Modelo híbrido: hidratación de `founder_profiles`, `buildFounderContext` |
| #16 | CTA "Completar perfil de fundador" + deep-link `/profile#founder-profile` |
| #17 | Empty-state con CTA en `FounderFitCard` |
| #18 | CTA contextual (Regenerar si el perfil ya existe) |
| #19 | Vista única: `FounderFitCard` en ambas pestañas; se elimina `VerdictFounderFit` |
| #20 | Trayectoria laboral editable en el form manual (agregar/eliminar/período) |
