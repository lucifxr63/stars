# Validus — Feed de Inteligencia de Mercado (dashboard)

> **Estado:** D-lite desplegado · 2026-07-01 (Fase 17)
> Widget `MarketSignalsWidget` (dashboard) + hook `useMarketSignals` + Edge `market-signals`.

## Cómo resuelve la fuente (orden de prioridad)

`useMarketSignals` intenta en cascada y **degrada con elegancia** (nunca deja el dashboard en blanco):

1. **Bralidus real (GraphRAG)** — si `VITE_BRALIDUS_API_URL` está seteada → `POST {url}/query {scope:'market_signals', country:'CL'}`. `source: 'bralidus'`. **Aún no activo** (BralidusPY no desplegado en prod).
2. **Edge `market-signals` (D-lite, activo)** — indicadores reales vía mindicador.cl. `source: 'live'`.
3. **Mock** — datos de demostración honestamente etiquetados. `source: 'mock'`.

## D-lite (activo) — indicadores reales

Edge `supabase/functions/market-signals` → `https://mindicador.cl/api` (una sola llamada, con `User-Agent` obligatorio y reintentos; caché en memoria 10 min solo de éxitos; 502 → el frontend cae a mock).

- **USD/CLP** (`dolar`), **UF** (`uf`), **IPC mes** (`ipc`), **TPM** (`tpm`) — reales.
- Sin deltas (el snapshot `/api` no trae series); IPSA se reemplazó por TPM (no está en fuentes gratuitas).
- **Señales**: editoriales curadas (no GraphRAG), etiquetadas "Editorial Validus". Footer del widget: "Indicadores en vivo · mindicador.cl · señales editoriales orientativas".

## D-full (pendiente, externo) — Bralidus GraphRAG real

Para señales derivadas por IA (no editoriales) hace falta **BralidusPY** (repo aparte, FastAPI + GraphRAG), hoy **no desplegado en prod**.

**Runbook de activación:**
1. Desplegar BralidusPY en prod (Cloud Run / Fly / Render).
2. Implementar en BralidusPY un handler `POST /query` para `scope:'market_signals'` que devuelva el shape `MarketSignalsData` (ver `src/hooks/useMarketSignals.ts`): `{ indicators[], signals[], asOf, source }`.
3. Setear `VITE_BRALIDUS_API_URL` en Vercel → redeploy del frontend.
4. Verificar: el widget debe mostrar `source: 'bralidus'` y señales GraphRAG con procedencia citable.

> Hasta completar D-full, el feed sirve **indicadores reales (D-lite)** + señales editoriales. El contrato del hook no cambia: activar Bralidus es solo configuración + el endpoint en BralidusPY.
