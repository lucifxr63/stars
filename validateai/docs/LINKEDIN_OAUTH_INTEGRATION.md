# LinkedIn OAuth + Proxycurl â€” IntegraciÃ³n Futura

**Estado:** Planificado â€” pendiente de LinkedIn Company Page  
**Sprint:** 1.5-B (despuÃ©s de Sprint 1.5 ya desplegado)  
**Estimado de ejecuciÃ³n:** ~2 horas una vez obtenidos los credentials

---

## Prerrequisito bloqueante

LinkedIn exige que toda Developer App estÃ© asociada a una **LinkedIn Company Page** verificada.

**Pasos a completar primero:**
1. Crear la LinkedIn Company Page de Validus
2. Ir a [linkedin.com/developers/apps/new](https://www.linkedin.com/developers/apps/new)
3. Crear la app asociada a esa Company Page
4. En la pestaÃ±a **Products** â†’ solicitar **"Sign In with LinkedIn using OpenID Connect"**
   - AprobaciÃ³n instantÃ¡nea (no requiere revisiÃ³n manual)
5. En la pestaÃ±a **Auth** â†’ Authorized redirect URLs agregar:
   - `https://validus.scouttech.lat/auth/linkedin/callback`
   - `http://localhost:5173/auth/linkedin/callback`
6. Copiar **Client ID** y **Client Secret**

---

## QuÃ© aporta esta integraciÃ³n

| Sin integraciÃ³n (actual) | Con integraciÃ³n |
|--------------------------|-----------------|
| Usuario pega URL manualmente | BotÃ³n "Conectar LinkedIn" con 1 click |
| LLM infiere datos de la URL | Datos reales: nombre, foto, headline vÃ­a OIDC |
| Sin experiencia laboral real | Proxycurl extrae work_experience, skills, education |
| Competency scores estimados | Scores basados en datos reales del perfil |

---

## Arquitectura del flujo

```
[FounderProfileTab]
   click "Conectar LinkedIn"
          â”‚
          â–¼
  useLinkedInOAuth.initiate()
  â†’ state = btoa({ return_to, nonce }) â†’ sessionStorage
  â†’ redirect a linkedin.com/oauth/v2/authorization
    scope: openid profile email
          â”‚
          â–¼ (LinkedIn redirige de vuelta)
  /auth/linkedin/callback   â† ruta React
          â”‚
          â–¼
  LinkedInCallback.tsx
  â†’ valida state vs sessionStorage
  â†’ POST /functions/v1/linkedin-oauth-callback con { code }
          â”‚
          â–¼
  Edge Function: linkedin-oauth-callback (Deno)
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚ 1. POST /oauth/v2/accessToken               â”‚
  â”‚    â†’ access_token (vÃ¡lido 60 dÃ­as)          â”‚
  â”‚                                             â”‚
  â”‚ 2. GET /v2/me?projection=(id,vanityName,    â”‚
  â”‚    localizedHeadline,profilePicture(...))   â”‚
  â”‚    â†’ vanityName â†’ linkedin.com/in/{slug}   â”‚
  â”‚    â†’ headline, foto                         â”‚
  â”‚                                             â”‚
  â”‚ 3. GET proxycurl.com/api/v2/linkedin        â”‚
  â”‚    ?url=linkedin.com/in/{slug}              â”‚
  â”‚    â†’ experiences[], skills[], education[]   â”‚
  â”‚                                             â”‚
  â”‚ 4. gpt-4o-mini structured output           â”‚
  â”‚    â†’ competency_scores {                    â”‚
  â”‚        visionComercial, capacidadTecnica,   â”‚
  â”‚        liderazgo, experienciaIndustria,     â”‚
  â”‚        resilienciaOperativa                 â”‚
  â”‚      }                                      â”‚
  â”‚                                             â”‚
  â”‚ 5. upsert founder_profiles                  â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
          â”‚
          â–¼
  setFounderProfile(data) â†’ Zustand
  navigate(return_to)
```

---

## Archivos a crear / modificar

| Archivo | AcciÃ³n | DescripciÃ³n |
|---------|--------|-------------|
| `supabase/migrations/20260526_founder_linkedin.sql` | CREAR | Agrega `linkedin_member_id TEXT UNIQUE`, `photo_url TEXT` |
| `supabase/functions/linkedin-oauth-callback/index.ts` | CREAR | Edge Function principal |
| `src/hooks/useLinkedInOAuth.ts` | CREAR | Hook para iniciar el flujo OAuth |
| `src/app/routes/LinkedInCallback.tsx` | CREAR | Ruta callback (patrÃ³n idÃ©ntico a FigmaCallback.tsx) |
| `src/components/shared/FounderProfileTab.tsx` | MODIFICAR | BotÃ³n OAuth primario + URL input como fallback |
| `src/App.tsx` | MODIFICAR | Registrar ruta `/auth/linkedin/callback` |

---

## MigraciÃ³n SQL

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
{ "code": "AQT...", "redirect_uri": "https://validus.scouttech.lat/auth/linkedin/callback" }
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
â†’ { access_token, expires_in }

// Paso 2: Obtener perfil bÃ¡sico
GET https://api.linkedin.com/v2/me?projection=(
  id,vanityName,localizedHeadline,
  profilePicture(displayImage~:playableStreams)
)
Authorization: Bearer {access_token}
â†’ { id, vanityName, localizedHeadline, profilePicture }

// Paso 3: Proxycurl
GET https://nubela.co/proxycurl/api/v2/linkedin
  ?url=https://www.linkedin.com/in/{vanityName}
Authorization: Bearer {PROXYCURL_API_KEY}
â†’ { experiences, skills, education, summary, ... }

// Paso 4: Scores con LLM (gpt-4o-mini, response_format: json_object)
// Mismo patrÃ³n que extract-founder-profile/index.ts

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
**Error de URL invÃ¡lida:** `{ error }` (HTTP 422)

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

PatrÃ³n idÃ©ntico al existente `src/app/routes/FigmaCallback.tsx`:

```typescript
// LÃ³gica principal en useEffect:
const code  = params.get('code');
const state = params.get('state');

// 1. Validar CSRF
const saved = sessionStorage.getItem('linkedin_oauth_state');
if (state !== saved) { toast.error('Estado invÃ¡lido'); navigate('/validate'); return; }
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

// 3. En Ã©xito: guardar en store y navegar
const profile = await res.json();
setFounderProfile({ ...profile, id: session.user.id });
toast.success('Perfil de LinkedIn conectado');
navigate(returnTo, { replace: true });
```

---

## UI: FounderProfileTab â€” empty state actualizado

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚             [Icono perfil]                      â”‚
â”‚                                                 â”‚
â”‚      Enriquece tu Perfil de Fundador            â”‚
â”‚   Los inversores y CORFO ponderan el FMF        â”‚
â”‚                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚  in  Conectar con LinkedIn             â”‚    â”‚
â”‚  â”‚      Importa tu perfil automÃ¡ticamente â”‚    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â”‚              (botÃ³n azul #0077B5)               â”‚
â”‚                                                 â”‚
â”‚  â”€â”€â”€â”€â”€â”€â”€â”€ o ingresa tu URL manualmente â”€â”€â”€â”€â”€â”€   â”‚
â”‚                                                 â”‚
â”‚  [ https://linkedin.com/in/tu-perfil     ]      â”‚
â”‚  [ Analizar con IA ]  (botÃ³n secundario)        â”‚
â”‚                                                 â”‚
â”‚  Ley 21.719 Â· Solo tÃº accedes a estos datos     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
- Plan mÃ­nimo recomendado: Pay-as-you-go (sin suscripciÃ³n fija)
- Endpoint usado: `GET /api/v2/linkedin` (Person Profile Endpoint)

---

## Secuencia de ejecuciÃ³n (cuando estÃ© listo)

```
1. Usuario crea LinkedIn Company Page
2. Usuario crea LinkedIn Developer App y obtiene credentials
3. Ejecutar: npx supabase secrets set LINKEDIN_CLIENT_ID=... LINKEDIN_CLIENT_SECRET=... PROXYCURL_API_KEY=...
4. Agregar VITE_LINKEDIN_CLIENT_ID al .env y Vercel env vars
5. Claude ejecuta los 6 archivos del plan
6. npx supabase db push (migraciÃ³n 20260526)
7. npx supabase functions deploy linkedin-oauth-callback
8. Vercel redeploy (recoge VITE_LINKEDIN_CLIENT_ID)
9. Test: click "Conectar LinkedIn" â†’ flujo completo
```

---

## Referencia de cÃ³digo existente

Para acelerar la implementaciÃ³n, estos archivos son la base directa:

| Nuevo archivo | Basado en |
|---------------|-----------|
| `LinkedInCallback.tsx` | `src/app/routes/FigmaCallback.tsx` |
| `linkedin-oauth-callback/index.ts` | `supabase/functions/figma-oauth-handler/index.ts` + `extract-founder-profile/index.ts` |
| `useLinkedInOAuth.ts` | PatrÃ³n propio (simple, ~20 lÃ­neas) |

---

*Documento generado: 2026-05-25 â€” Validus Sprint 1.5-B*
