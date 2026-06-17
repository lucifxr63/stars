# Activar datos reales de Reddit (premium-validate)

**Estado:** el código ya está implementado y desplegado (`fetchRedditReal` en
`supabase/functions/premium-validate/index.ts`: OAuth app-only + cache de token en
Deno KV + búsqueda + inferencia de sentimiento). **Solo falta configurar 2 secrets.**

Mientras no estén los secrets, `fetchReddit` lanza un error que `Promise.allSettled`
captura como `null` → el reporte premium muestra "datos no disponibles" para Reddit
(NO datos ficticios — los mocks se eliminaron por directiva 01-Jun-2026).

Verificado 2026-06-17: `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` NO están en los
secrets de prod. `SERPAPI_KEY` (Google Trends) sí → Trends ya funciona en real.

---

## Paso 1 — Crear la app de Reddit (gratis, ~3 min)

1. Entrar a https://www.reddit.com/prefs/apps (con la cuenta Reddit de la empresa).
2. **Create another app...** → tipo **script**.
3. Campos:
   - **name:** `Validus`
   - **redirect uri:** `https://validus.scouttech.lat` (no se usa en app-only, pero es obligatorio)
4. Crear. Anotar:
   - **client_id:** la cadena bajo el nombre de la app (debajo de "personal use script").
   - **client_secret:** el campo `secret`.

> App-only (client_credentials grant): no requiere login de usuario ni scopes.
> Límite gratuito ~100 req/min, de sobra para el volumen actual.

## Paso 2 — Setear los secrets en Supabase

```bash
cd validateai
npx supabase secrets set REDDIT_CLIENT_ID=<client_id> --project-ref fcdhcntyvsydnvjwopfe
npx supabase secrets set REDDIT_CLIENT_SECRET=<client_secret> --project-ref fcdhcntyvsydnvjwopfe
```

(o vía Dashboard → Project Settings → Edge Functions → Secrets)

No hace falta re-deployar `premium-validate`: lee los secrets en runtime.

## Paso 3 — Verificar

1. Correr una validación premium con una idea real.
2. En el reporte, el `EvidenceWall` debe mostrar discusiones reales con
   `source: 'Reddit API (real)'` (en vez del aviso de datos no disponibles).
3. Logs: Supabase → Edge Functions → `premium-validate` → buscar `Reddit search`
   (no debe aparecer `Reddit credentials not configured`).

## Notas

- El `User-Agent` está fijado a `Validus/1.0 by Luciano` (requisito de la API de Reddit).
- El token OAuth se cachea 55 min en Deno KV (`reddit_oauth_token`).
- Subreddits consultados: `entrepreneur+startups+SaaS+smallbusiness+business`.
- Si Reddit empieza a cobrar o bloquear app-only, el fallback es degradar a
  "datos no disponibles" sin romper el reporte.
