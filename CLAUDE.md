## Mapa del monorepo

| Carpeta | Qué es | Doc propia |
|:---|:---|:---|
| `validateai/` | Validus (SPA) + **el gateway `api-v1`** (Supabase Edge Functions) | `validateai/CLAUDE.md` |
| `validateai-financial-worker/` | **Worker de Bralidus**: extractores y grafo de conocimiento | `validateai-financial-worker/CLAUDE.md` |
| `validateai-developer-portal/` | Portal de Animus + servicio `mp-sync` | `validateai-developer-portal/CLAUDE.md` |
| `animus-engine-mcp/` | Servidor MCP publicado en npm | `animus-engine-mcp/CLAUDE.md` |
| `cashflow/` | Denarius | |

### Tres cosas que muerden y no son evidentes

1. **`bralidus-api` y `mp-sync` NO tienen integración Git.** Un `git push` no los
   despliega; hay que correr `vercel deploy --prod` desde su carpeta. El CI del
   portal despliega el **frontend**, no esos servicios. Ya causó que un arreglo
   quedara commiteado, verde en CI, y nunca en producción.

2. **Publicar en npm sólo desde `animus-engine-mcp/`.** La raíz tiene
   `private: true` y un `prepublishOnly` que aborta, porque un `npm publish`
   desde acá intentó subir 1305 archivos —`graphify-out/`, PDFs de `pitch/`, el
   portal entero— y sólo falló por una colisión de nombres.

3. **Verificar el efecto, no el status.** El patrón que dominó la auditoría de
   agosto: jobs con `success`, CI en verde y deploys correctos que no producían
   nada. Un 200 no significa que haya datos; un deploy verde no significa que el
   código corra en el camino que se ejecuta.

### Estado al 2026-08-05

- **Animus/gateway**: acceso cerrado (API key obligatoria), medición de cuota
  arreglada, Mercado Público completo con competencia y precios.
- **MCP**: `animus-engine-mcp@0.1.1` publicado, 15 herramientas.
- **Worker**: SEIA y Concursal arreglados; CMF y BCCh desactivados por fuentes
  inaccesibles; monitoreo de fallos silenciosos con alerta a Discord.
- **Abierto**: `empleo_sync` congelado; `sync-compra-agil` falla con 0
  encontradas; validación de PJUD pendiente de un abogado
  (`validateai/docs/PJUD_VALIDACION_EXPERTO.md`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
