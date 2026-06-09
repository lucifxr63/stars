# Variables de Entorno — Checklist completo

Estado de todas las variables requeridas por ValidateAI en producción (Supabase Edge Functions + Vercel).

Última revisión: 2026-06-08

---

## Leyenda

| Símbolo | Significado |
|---------|------------|
| ✅ | Confirmado en prod |
| ⚠️ | Necesario pero no verificado |
| ❌ | Faltante — bloquea funcionalidad |
| 🔜 | Futuro — no necesario aún |

---

## Supabase Edge Functions (Secrets)

Configurar en: **Supabase Dashboard → Settings → Edge Functions → Secrets**

### Core / Infraestructura

| Variable | Estado | Descripción | Cómo obtenerla |
|----------|--------|-------------|----------------|
| `SUPABASE_URL` | ✅ | Auto-inyectada por Supabase | Automática |
| `SUPABASE_ANON_KEY` | ✅ | Auto-inyectada | Automática |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Auto-inyectada | Automática |
| `OPENAI_API_KEY` | ✅ | Embeddings + GPT-4o | platform.openai.com → API Keys |
| `ANTHROPIC_API_KEY` | ✅ | Claude (análisis IA principal) | console.anthropic.com → API Keys |

### Datos Económicos

| Variable | Estado | Descripción | Cómo obtenerla |
|----------|--------|-------------|----------------|
| `FRED_API_KEY` | ✅ | FRED API (macro USA) | fred.stlouisfed.org/docs/api/api_key.html (gratis) |
| `MERCADOPUBLICO_TICKET` | ⚠️ | ChileCompra API | mercadopublico.cl → solicitar ticket de acceso |
| `CMF_BEST_KEY` | ⚠️ | CMF BEST indicadores financieros | cmfchile.cl → portal desarrolladores |

### Scrapers / Parsers

| Variable | Estado | Descripción | Cómo obtenerla |
|----------|--------|-------------|----------------|
| `LLAMAPARSE_API_KEY` | ✅ | LlamaParse PDF parsing | cloud.llamaindex.ai → API Keys |
| `SERPAPI_KEY` | ✅ | Google Trends scraping | serpapi.com → Dashboard |

### Integraciones Externas

| Variable | Estado | Descripción | Cómo obtenerla |
|----------|--------|-------------|----------------|
| `FINTOC_SECRET_KEY` | ⚠️ | Fintoc Open Banking webhooks | fintoc.com → Dashboard → Webhooks → Secret |
| `REDDIT_CLIENT_ID` | 🔜 | Reddit API (datos simulados por ahora) | reddit.com/prefs/apps |
| `REDDIT_CLIENT_SECRET` | 🔜 | Reddit API | Ídem |

### LinkedIn OAuth (Sprint 1.5-B — BLOQUEADO hasta crear Company Page)

| Variable | Estado | Descripción | Cómo obtenerla |
|----------|--------|-------------|----------------|
| `LINKEDIN_CLIENT_ID` | ❌ | OAuth client ID | developer.linkedin.com (ver LINKEDIN_COMPANY_PAGE.md) |
| `LINKEDIN_CLIENT_SECRET` | ❌ | OAuth client secret | Ídem |

### Knowledge Vault (Proyecto separado en Supabase)

| Variable | Estado | Descripción | Nota |
|----------|--------|-------------|------|
| `VAULT_SUPABASE_URL` | ✅ | `szzibobuwgcopewmnkkl.supabase.co` | Knowledge-vault separado (INAPI Phase 2) |
| `VAULT_SERVICE_ROLE_KEY` | ✅ | Service role del vault | Configurada en Edge Functions que consultan el vault |

---

## Vercel (Frontend validateai)

Configurar en: **Vercel Dashboard → Project → Settings → Environment Variables**

| Variable | Estado | Descripción |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | ✅ | URL del proyecto Supabase principal |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon key del proyecto |
| `VITE_POSTHOG_KEY` | ✅ | PostHog project key (analytics) |
| `VITE_POSTHOG_HOST` | ✅ | PostHog host (reverse proxy) |

---

## Developer Portal (validateai-developer-portal)

El portal se despliega bajo `validus.scouttech.lat/developers`.
Configurar las mismas variables en Vercel (proyecto scouttech) o en el `.env.local` para desarrollo.

| Variable | Estado | Descripción |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Apunta al mismo Supabase principal |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Ídem |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ | Solo para el script `npm run sync` (nunca en cliente) |

---

## Script npm run sync (scripts/sync-knowledge-graph.js)

Variables necesarias en `.env.local` local (nunca en Vercel):

| Variable | Estado | Descripción |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Reutiliza la misma del portal |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ | Necesaria para el Bearer token — obtener de Supabase Dashboard → Settings → API |

---

## Crons activos (verificar que tengan las vars)

| Cron | Función | Variables críticas |
|------|---------|-------------------|
| `0 13 * * 1-5` (sugerido) | `fred-sync` | `FRED_API_KEY` |
| `0 7 * * 1` | `tier-health` | Service role (auto) |
| Diario | `followup-email` | Service role + SMTP/Resend key |
| Diario | `cron-uf-daily` | Service role (auto) |

---

## Cómo aplicar un secret nuevo en Supabase

```bash
# Via CLI (recomendado)
supabase secrets set NOMBRE_VAR=valor --project-ref <project-ref>

# Para ver qué secrets ya están:
supabase secrets list --project-ref <project-ref>

# El project-ref está en: Supabase Dashboard → Settings → General → Reference ID
```

---

## Resumen de bloqueantes críticos

| Prioridad | Variable | Impacto si falta |
|-----------|----------|-----------------|
| 🔴 Alto | `LINKEDIN_CLIENT_ID/SECRET` | Sprint 1.5-B completamente bloqueado |
| 🟡 Medio | `MERCADOPUBLICO_TICKET` | ChileCompra sin datos frescos |
| 🟡 Medio | `CMF_BEST_KEY` | Indicadores financieros CMF BEST sin datos |
| 🟡 Medio | `FINTOC_SECRET_KEY` | Webhooks Fintoc no verificados |
| 🟢 Bajo | `REDDIT_CLIENT_ID/SECRET` | Reddit usa datos simulados actualmente |
