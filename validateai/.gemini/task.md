# Task — Auditoría: Fixes Críticos + Limpieza

## Fase 1 — Eliminación de archivos muertos
- [x] Eliminar `refactor.cjs`
- [x] Eliminar `refactor2.cjs`
- [x] Eliminar `src/utils/prompts.ts`
- [x] Eliminar `supabase/functions/followup-email/` (no manejan correos)

## Fase 2 — Fixes Críticos
- [x] Restringir CORS en `ai-validate` (prod + localhost)
- [x] Restringir CORS en `market-analyze`
- [x] Restringir CORS en `anonymize-idea`
- [x] Validar `prompt_type` contra whitelist en `ai-validate`
- [x] Limpiar código muerto: `FounderContext` campos no usados
- [x] Limpiar código muerto: `SECTOR_SERIES` vacío (documentar)

## Fase 3 — Reescribir Documentación
- [x] Reescribir `ESTADO_ACTUAL.md`
- [x] Reescribir `CLAUDE.md`
