# LinkedIn OAuth + Proxycurl — Integración Futura

**Estado:** Planificado — pendiente de LinkedIn Company Page  
**Sprint:** 1.5-B (después de Sprint 1.5 ya desplegado)  
**Estimado de ejecución:** ~2 horas una vez obtenidos los credentials

---

## Prerrequisito bloqueante

LinkedIn exige que toda Developer App esté asociada a una **LinkedIn Company Page** verificada.

**Pasos a completar primero:**
1. Crear la LinkedIn Company Page de ValidateAI
2. Ir a [linkedin.com/developers/apps/new](https://www.linkedin.com/developers/apps/new)
3. Crear la app asociada a esa Company Page
4. En la pestaña **Products** → solicitar **"Sign In with LinkedIn using OpenID Connect"**
   - Aprobación instantánea (no requiere revisión manual)
5. En la pestaña **Auth** → Authorized redirect URLs agregar:
   - `https://validateai-mu.vercel.app/auth/linkedin/callback`
   - `http://localhost:5173/auth/linkedin/callback`
6. Copiar **Client ID** y **Client Secret**

---

## Qué aporta esta integración

| Sin integración (actual) | Con integración |
|--------------------------|-----------------|
| Usuario pega URL manualmente | Botón "Conectar LinkedIn" con 1 click |
| LLM infiere datos de la URL | Datos reales: nombre, foto, headline vía OIDC |
| Sin experiencia laboral real | Proxycurl extrae work_experience, skills, education |
| Competency scores estimados | Scores basados en datos reales del perfil |

---

## Arquitectura del flujo

```
[FounderProfileTab]
   click "Conectar LinkedIn"
          │
          ▼
  useLinkedInOAuth.initiate()
  → state = btoa({ return_to, nonce }) → sessionStorage
  → redirect a linkedin.com/oauth/v2/authorization
    scope: openid profile email
          │
          ▼ (LinkedIn redirige de vuelta)
  /auth/linkedin/callback   ← ruta React
          │
          ▼
  LinkedInCallback.tsx
  → valida state vs sessionStorage
  → POST /functions/v1/linkedin-oauth-callback con { code }
          │
          ▼
  Edge Function: linkedin-oauth-callback (Deno)
  ┌─────────────────────────────────────────────┐
  │ 1. POST /oauth/v2/accessToken               │
  │    → access_token (válido 60 días)          │
  │                                             │
  │ 2. GET /v2/me?projection=(id,vanityName,    │
  │    localizedHeadline,profilePicture(...))   │
  │    → vanityName → linkedin.com/in/{slug}   │
  │    → headline, foto                         │
  │                                             │
  │ 3. GET proxycurl.com/api/v2/linkedin        │
  │    ?url=linkedin.com/in/{slug}              │
  │    → experiences[], skills[], education[]   │
  │                                             │
  │ 4. gpt-4o-mini structured output           │
  │    → competency_scores {                    │
  │        visionComercial, capacidadTecnica,   │
  │        liderazgo, experienciaIndustria,     │
  │        resilienciaOperativa                 │
  │      }                                      │
  │                                             │
  │ 5. upsert founder_profiles                  │
  └─────────────────────────────────────────────┘
          │
          ▼
  setFounderProfile(data) → Zustand
  navigate(return_to)
```

---

## Archivos a crear / modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/migrations/20260526_founder_linkedin.sql` | CREAR | Agrega `linkedin_member_id TEXT UNIQUE`, `photo_url TEXT` |
| `supabase/functions/linkedin-oauth-callback/index.ts` | CREAR | Edge Function principal |
| `src/hooks/useLinkedInOAuth.ts` | CREAR | Hook para iniciar el flujo OAuth |
| `src/app/routes/LinkedInCallback.tsx` | CREAR | Ruta callback (patrón idéntico a FigmaCallback.tsx) |
| `src/components/shared/FounderProfileTab.tsx` | MODIFICAR | Botón OAuth primario + URL input como fallback |
| `src/App.tsx` | MODIFICAR | Registrar ruta `/auth/linkedin/callback` |

---

## Migración SQL

```sql
ALTER TABLE public.founder_profiles
  ADD COLUMN IF NOT EXISTS linkedin_member_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS photo_url          text;
```

`linkedin_member_id` = valor del claim `sub` del OIDC de LinkedIn.
Sirve para detectar reconexiones del mismo usuario sin duplicar filas.

---

## Edge Function: linkedin-oauth-callback

**Endpoint:** `POST /functions/v1/linkedin-oauth-callback`

**Body:**
```json
{ "code": "AQT...", "redirect_uri": "https://validateai-mu.vercel.app/auth/linkedin/callback" }
```

**Headers:** `Authorization: Bearer {supabase_session_token}`

**Flujo interno:**

```typescript
// Paso 1: Intercambiar code por access_token
POST https://www.linkedin.com/oauth/v2/accessToken
  grant_type=authorization_code
  code={code}
  client_id={LINKEDIN_CLIENT_ID}
  client_secret={LINKEDIN_CLIENT_SECRET}
  redirect_uri={redirect_uri}
→ { access_token, expires_in }

// Paso 2: Obtener perfil básico
GET https://api.linkedin.com/v2/me?projection=(
  id,vanityName,localizedHeadline,
  profilePicture(displayImage~:playableStreams)
)
Authorization: Bearer {access_token}
→ { id, vanityName, localizedHeadline, profilePicture }

// Paso 3: Proxycurl
GET https://nubela.co/proxycurl/api/v2/linkedin
  ?url=https://www.linkedin.com/in/{vanityName}
Authorization: Bearer {PROXYCURL_API_KEY}
→ { experiences, skills, education, summary, ... }

// Paso 4: Scores con LLM (gpt-4o-mini, response_format: json_object)
// Mismo patrón que extract-founder-profile/index.ts

// Paso 5: Upsert
supabase.from('founder_profiles').upsert({
  id: user.id,
  linkedin_member_id: linkedinId,
  linkedin_url: `https://www.linkedin.com/in/${vanityName}`,
  photo_url: fotoUrl,
  full_name: nombre,
  headline: localizedHeadline,
  ...proxycurlData,
  competency_scores: llmScores,
  extraction_status: 'done',
})
```

**Respuesta exitosa:** `FounderProfileData` (HTTP 200)
**Error de URL inválida:** `{ error }` (HTTP 422)

---

## Hook: useLinkedInOAuth

```typescript
// src/hooks/useLinkedInOAuth.ts

const LINKEDIN_SCOPES = 'openid profile email';

export function useLinkedInOAuth() {
  const initiateOAuth = (returnTo: string) => {
    const state = btoa(JSON.stringify({
      return_to: returnTo,
      nonce: crypto.randomUUID(),
    }));
    sessionStorage.setItem('linkedin_oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_LINKEDIN_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/linkedin/callback`,
      scope: LINKEDIN_SCOPES,
      state,
    });

    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  };

  return { initiateOAuth };
}
```

---

## Ruta: LinkedInCallback.tsx

Patrón idéntico al existente `src/app/routes/FigmaCallback.tsx`:

```typescript
// Lógica principal en useEffect:
const code  = params.get('code');
const state = params.get('state');

// 1. Validar CSRF
const saved = sessionStorage.getItem('linkedin_oauth_state');
if (state !== saved) { toast.error('Estado inválido'); navigate('/validate'); return; }
sessionStorage.removeItem('linkedin_oauth_state');

const returnTo = (() => {
  try { return JSON.parse(atob(state)).return_to ?? '/validate'; }
  catch { return '/validate'; }
})();

// 2. Llamar Edge Function
const res = await fetch(`${EDGE_URL}/linkedin-oauth-callback`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code,
    redirect_uri: `${window.location.origin}/auth/linkedin/callback`,
  }),
});

// 3. En éxito: guardar en store y navegar
const profile = await res.json();
setFounderProfile({ ...profile, id: session.user.id });
toast.success('Perfil de LinkedIn conectado');
navigate(returnTo, { replace: true });
```

---

## UI: FounderProfileTab — empty state actualizado

```
┌─────────────────────────────────────────────────┐
│             [Icono perfil]                      │
│                                                 │
│      Enriquece tu Perfil de Fundador            │
│   Los inversores y CORFO ponderan el FMF        │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  in  Conectar con LinkedIn             │    │
│  │      Importa tu perfil automáticamente │    │
│  └─────────────────────────────────────────┘    │
│              (botón azul #0077B5)               │
│                                                 │
│  ──────── o ingresa tu URL manualmente ──────   │
│                                                 │
│  [ https://linkedin.com/in/tu-perfil     ]      │
│  [ Analizar con IA ]  (botón secundario)        │
│                                                 │
│  Ley 21.719 · Solo tú accedes a estos datos     │
└─────────────────────────────────────────────────┘
```

---

## Variables de entorno y secrets

### Frontend (`.env`)
```bash
VITE_LINKEDIN_CLIENT_ID=tu_client_id_aqui
```

### Supabase Secrets
```bash
npx supabase secrets set \
  LINKEDIN_CLIENT_ID=tu_client_id \
  LINKEDIN_CLIENT_SECRET=tu_client_secret \
  PROXYCURL_API_KEY=tu_proxycurl_key \
  --project-ref fcdhcntyvsydnvjwopfe
```

### Proxycurl
- Registro: [proxycurl.com](https://nubela.co/proxycurl)
- Costo: ~$0.01 USD por perfil enriquecido
- Plan mínimo recomendado: Pay-as-you-go (sin suscripción fija)
- Endpoint usado: `GET /api/v2/linkedin` (Person Profile Endpoint)

---

## Secuencia de ejecución (cuando esté listo)

```
1. Usuario crea LinkedIn Company Page
2. Usuario crea LinkedIn Developer App y obtiene credentials
3. Ejecutar: npx supabase secrets set LINKEDIN_CLIENT_ID=... LINKEDIN_CLIENT_SECRET=... PROXYCURL_API_KEY=...
4. Agregar VITE_LINKEDIN_CLIENT_ID al .env y Vercel env vars
5. Claude ejecuta los 6 archivos del plan
6. npx supabase db push (migración 20260526)
7. npx supabase functions deploy linkedin-oauth-callback
8. Vercel redeploy (recoge VITE_LINKEDIN_CLIENT_ID)
9. Test: click "Conectar LinkedIn" → flujo completo
```

---

## Referencia de código existente

Para acelerar la implementación, estos archivos son la base directa:

| Nuevo archivo | Basado en |
|---------------|-----------|
| `LinkedInCallback.tsx` | `src/app/routes/FigmaCallback.tsx` |
| `linkedin-oauth-callback/index.ts` | `supabase/functions/figma-oauth-handler/index.ts` + `extract-founder-profile/index.ts` |
| `useLinkedInOAuth.ts` | Patrón propio (simple, ~20 líneas) |

---

*Documento generado: 2026-05-25 — ValidateAI Sprint 1.5-B*
