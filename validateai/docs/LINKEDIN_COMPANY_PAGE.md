# LinkedIn OAuth — Pasos para crear la Company Page

Documento de desbloqueo para el Sprint 1.5-B (LinkedIn OAuth Integration).
Hasta que no exista la Company Page, la app no puede pasar por la revisión de LinkedIn.

---

## Por qué se necesita la Company Page

LinkedIn **exige** que toda aplicación OAuth que use `w_member_social` o `r_organization_social`
pertenezca a un Developer Portal con una Company Page verificada. Sin ella:

- El flujo OAuth funciona en modo **sandbox** (solo cuenta propia, no usuarios externos).
- La app no puede pasar a **producción** (LinkedIn la mantiene en estado "In Review" indefinidamente).
- El botón "Conectar con LinkedIn" solo sirve para tu propio perfil de prueba.

---

## Pasos exactos

### 1. Crear la Company Page en LinkedIn (5–10 min)

1. Inicia sesión en LinkedIn con la cuenta de la organización (o tu cuenta personal si es una empresa unipersonal).
2. Ve a: `https://www.linkedin.com/company/setup/new/`
3. Rellena:
   - **Nombre de la empresa**: `Validus` (o `Scouttech` si se publica bajo esa marca)
   - **LinkedIn Public URL**: `linkedin.com/company/validateai-cl` (o el slug que esté disponible)
   - **Industria**: Technology, Information and Internet
   - **Tamaño**: 1–10 empleados
   - **Tipo**: Startup / Privately Held
   - **Website**: `https://validateai.cl` (o `https://validus.scouttech.lat` si se prefiere la marca Validus)
4. Sube el logo (PNG, mínimo 300×300px, sin fondo blanco).
5. Haz click en **Publicar página**.

> La página queda activa inmediatamente. No requiere verificación previa para crear.

---

### 2. Vincular la Company Page al Developer App de LinkedIn

1. Ve a `https://developer.linkedin.com/` → Apps.
2. Selecciona la app de Validus (o crea una nueva con el botón **Create App**).
3. En la sección **App Settings**, en el campo **LinkedIn Page**, busca y selecciona la página recién creada.
4. LinkedIn te pedirá que **verifiques** que eres admin de esa página. Haz click en "Verify" — te llegará una notificación en LinkedIn o deberás confirmar con tu cuenta.

---

### 3. Solicitar los permisos necesarios

En el Developer App, tab **Products**, solicita:

| Producto | Permisos que incluye | Por qué lo necesitamos |
|----------|---------------------|------------------------|
| **Sign In with LinkedIn using OpenID Connect** | `openid`, `profile`, `email` | Login OAuth básico ✓ ya habilitado en sandbox |
| **Share on LinkedIn** | `w_member_social` | Para que el founder pueda compartir resultados |
| **Marketing Developer Platform** (opcional, futuro) | `r_organization_social` | Para leer datos de la empresa del founder |

Para **Sign In with LinkedIn**, la aprobación es casi inmediata (< 24h).
Para `w_member_social`, LinkedIn pide una descripción del caso de uso — usar:

> "Validus permite a founders chilenos validar sus startups. Usamos LinkedIn OAuth para
> autenticar la identidad profesional del founder y obtener su experiencia laboral y educación,
> que alimentan el score de founder fit. No publicamos contenido sin acción explícita del usuario."

---

### 4. Configurar Redirect URIs en el Developer App

Asegúrate de que estas URIs estén en la lista de **Authorized Redirect URLs**:

```
https://validateai.cl/auth/callback
https://validus.scouttech.lat/auth/callback
http://localhost:5173/auth/callback    ← solo para desarrollo
```

---

### 5. Variables de entorno a configurar en Supabase

Una vez aprobados los permisos:

| Variable | Dónde conseguirla | Dónde configurarla |
|----------|------------------|-------------------|
| `LINKEDIN_CLIENT_ID` | Developer App → Auth → Client ID | Supabase Dashboard → Auth → Providers → LinkedIn |
| `LINKEDIN_CLIENT_SECRET` | Developer App → Auth → Primary Client Secret | Ídem |

En Supabase Auth también activar el toggle de LinkedIn como provider.

---

### 6. Verificar en producción

```bash
# Desde el browser, iniciar el flujo:
GET https://tu-supabase-url/auth/v1/authorize?provider=linkedin_oidc&redirect_to=https://validateai.cl/auth/callback

# Debe redirigir a linkedin.com/oauth/v2/authorization con:
# - client_id correcto
# - scope: openid profile email
# - redirect_uri: tu URL registrada
```

Si responde `invalid_redirect_uri` → revisar paso 4.
Si responde `unauthorized_scope` → el producto no está aprobado aún (paso 3).

---

## Estado actual del código

El código está listo en:
- `validateai/supabase/functions/extract-founder-profile/index.ts` — extrae datos del token LinkedIn
- `validateai/src/app/stores/founderProfileStore.ts` — store Zustand del perfil
- `validateai/src/app/components/FounderProfileTab.tsx` — UI del tab

Solo falta la Company Page + aprobación de LinkedIn para activar en producción.

---

## Tiempo estimado

| Paso | Tiempo |
|------|--------|
| Crear Company Page | 10 min |
| Vincular al Developer App | 5 min |
| Solicitar Sign In with LinkedIn | < 24h (aprobación automática) |
| Configurar env vars en Supabase | 5 min |
| Test en producción | 15 min |

**Total: 1 día hábil** (dominado por el tiempo de aprobación de LinkedIn).
