# Estado Actual: Validus V3 — Mayo 2026

> Fuente de verdad del estado de implementación. Actualizar al cerrar cada sprint.
> Plan completo: `docs/VALIDUS_V3_NEW.MD` | Guía técnica: `validateai/CLAUDE.md`

---

## Estado general

| Dimensión | Estado |
|-----------|--------|
| Producción | ✅ Live — https://validateai-mu.vercel.app |
| Usuarios de pago | ❌ 0 — pagos no activados aún |
| Rate limiting | ✅ Sprint 1 implementado (anonymize-idea gate) |
| Tier premium | ✅ Restaurado (4 tiers activos) |
| Pagos | ⚠️ LemonSqueezy configurado, webhook pendiente |
| Compliance Ley 21.719 | ✅ ConsentModal + consent_logs + anonymize-idea |
| KYC / RUT | ✅ validate-rut + KycModal activos |

---

## Sprint 1 — COMPLETADO (22 mayo 2026)

**Fixes críticos:**

| # | Fix | Archivo(s) |
|---|-----|-----------|
| 1 | `training_data` sin `user_id` — rate limit nunca bloqueaba | `migrations/20260522_training_data_user_id.sql` |
| 2 | `anonymize-idea` no insertaba `user_id` en el row | `functions/anonymize-idea/index.ts` |
| 3 | Tier `premium` eliminado por migración anterior | `migrations/20260522_restore_premium_tier.sql` |
| 4 | `useUserTier.ts` no conocía el tier `premium` | `src/hooks/useUserTier.ts` |

**Features entregadas:**

| # | Feature | Detalle |
|---|---------|---------|
| 5 | Toast en `useTrainingData.ts` | Muestra `toast.warning` cuando `anonymize-idea` devuelve 429 o `rate_limit` |
| 6 | `MONTHLY_LIMITS` para premium en `ai-validate` | `premium: { total: 999, expensive: 999 }` |

---

## Sprint 2 — PENDIENTE

| Tarea | Prioridad | Notas |
|-------|-----------|-------|
| LemonSqueezy webhook → actualiza `profiles.tier` | 🔴 Bloqueante | Ver `SETUP_LEMONSQUEEZY.md`. Function `lemonsqueezy-webhook` existe, falta activar |
| `LockedSection` usar `isPremium` para secciones exclusivas premium | 🟡 Alta | `isPremium` ya disponible en `useUserTier.ts` |
| `Pricing.tsx` mostrar 4to tier (premium $29.990 CLP) | 🟡 Alta | Tier restaurado en BD, falta UI |
| Rate limiting enforcement en `ai-validate` (guard al inicio) | 🔴 Bloqueante | Sin esto usuarios free queman presupuesto en `competitive_analysis` + `market_sizing` |

---

## Sprint 3 — PLANIFICADO

| Tarea | Notas |
|-------|-------|
| Gobernanza / Cap Table (`governance_assessment`) | Nuevo prompt type + componente `GovernanceCard` |
| Fundraising Roadmap (`fundraising_roadmap`) | SAFE/convertible, fondos LatAm |
| Tab "Inversión" en `ValidationDetail.tsx` | Agrupa los 2 análisis anteriores |
| `TractionTracker` | Tabla `traction_events`, ya existe en BD |

---

## Integraciones planificadas (stubs listos, no activadas)

Estas edge functions existen como stubs. Se activan en Sprint 3+:

| Función | Propósito | Bloqueador |
|---------|-----------|-----------|
| `fintoc-link` / `fintoc-webhook` | Open Banking — contexto financiero del fundador | Requiere cuenta Fintoc + secrets |
| `webhook-pjud` | Antecedentes judiciales y marcas (INAPI) | Requiere acuerdo PJUD + HMAC secret |
| `inapi-fetch` | Marcas comerciales activas | Requiere API key INAPI |
| `sync-economic-data` | Sincronización periódica CMF/SII | Mover API keys hardcodeadas a `Deno.env` primero |
| `sii-proxy` | Verificación empresa en SII | Requiere SII_API_KEY en secrets |
| `assemble-mega-prompt` | Ensambla contexto Fintoc+PJUD+INAPI para due diligence | Depende de los 3 anteriores |

---

## Arquitectura de datos — tablas activas

| Tabla | Uso | Estado |
|-------|-----|--------|
| `profiles` | Auth + tier del usuario | ✅ |
| `validations` | Sesiones del wizard | ✅ |
| `training_data` | Corpus anonimizado (fine-tune futuro) | ✅ con `user_id` |
| `consent_logs` | Inmutable — registro consentimiento Ley 21.719 | ✅ |
| `ai_interactions` | Log de llamadas a Anthropic/OpenAI | ✅ |
| `cached_analyses` | Caché semántico de prompts pesados | ✅ |
| `competitors` | Vectores RAG competidores | ✅ |
| `mentors` | Matching de mentores | ✅ |
| `market_ai_insights` | Caché análisis de mercado | ✅ |
| `temp_context` | Almacén temporal webhooks (Fintoc/PJUD) | ✅ listo para Sprint 3+ |
| `traction_events` | Hitos del emprendedor | ✅ tabla lista, UI pendiente |
| `email_logs` | Retención por email | ⚠️ tabla lista, cron sin activar |
