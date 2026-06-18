# Dependencias de las Edge Functions (Deno) — convención

## Regla
Importar deps externas por **URL `esm.sh` pinneada**. **No usar `npm:`**.

Motivo: `npm:<pkg>` requiere un `node_modules/` poblado, y `deno check` (el gate de
CI en `deno-check.yml`) falla en un checkout fresco con *"Could not find … in a
node_modules folder"*. Las URLs `esm.sh`/`deno.land` se resuelven sin node_modules.
(Esto rompió el CI al introducir `outputSchemas.ts` — por eso la regla.)

## Versiones canónicas
| Dep | Import |
|-----|--------|
| zod | `https://esm.sh/zod@3.23.8` |
| supabase-js | `https://esm.sh/@supabase/supabase-js@2` |
| std (nuevas/editadas) | `https://deno.land/std@0.224.0/...` |

`std@0.168.0` sigue presente en ~23 funciones antiguas. **No** se hace un bump masivo
(el API de `serve` cambió entre versiones → riesgo). Migrar a `@0.224.0` solo al editar
una función, verificando que `serve`/`Deno.serve` siga andando.

## Backlog de migración (`npm:zod` restante)
- `shared-schemas/mod.ts` → migrado a esm.sh ✅
- `sii-proxy/index.ts` → migrado a esm.sh ✅
- `api-v1/routes/validate.ts` → **pendiente**: api-v1 arrastra ~7 errores de tipos
  **preexistentes** (mismatches de `SupabaseClient` + RPCs no tipadas), ajenos a zod.
  Migrar su zod requiere primero limpiar esa deuda de tipos → tarea aparte.

## Nota sobre módulos compartidos y el auto-deploy
`deploy-functions.yml` redepliega las funciones cambiadas + las que importan `../_shared/`.
**No** trackea importadores de `shared-schemas` (otro módulo compartido). Si cambiás
`shared-schemas/mod.ts`, redesplegá manualmente sus importadores (`api-v1`, `sii-proxy`)
o incluilos en el mismo PR.
