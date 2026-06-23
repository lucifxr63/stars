# Silent Beta — Runbook de lanzamiento

> El **envío del correo es una acción manual tuya**. Estos archivos quedan listos,
> pero el blast a usuarios reales no se ejecuta automáticamente.

## Estado de la contención (✅ ya implementado en código)
- Modelo de extracción PDF: **claude-haiku-4-5** (el más barato con visión + JSON).
- Candado de tamaño: **2MB** (frontend + Edge Function).
- Solo se procesa la **primera página** (instrucción en el prompt).
- Cuota Beta: **10 PDFs/usuario/mes** (RPC atómica `cashflow.check_and_increment_pdf_usage`, 429 al exceder, contador visible en la UI).

## Pasos para enviar el Silent Beta
1. **Segmentar:** corre [silent-beta-segmentation.sql](./silent-beta-segmentation.sql) en el SQL Editor de Validus → lista de `email, name`.
   - A hoy: **2 usuarios** cumplen (execution o market > 70). El dataset actual tiene datos de prueba; el número real crecerá con usuarios productivos.
2. **Cargar el correo:** sube [silent-beta-email.html](./silent-beta-email.html) a Resend/SendGrid. Variable `{{name}}`. Asunto:
   `Acceso Anticipado: Proyecta el Runway de tu Startup (Beta Exclusiva)`
3. **Enviar.**

## 🚫 Bloqueadores ANTES de enviar (no lo hagas sin resolverlos)
- **El dominio `cashflow.scouttech.lat` no existe aún.** El frontend de Cashflow no está desplegado a producción — el CTA del correo daría 404. Hay que: build + deploy del frontend, apuntar el dominio, y añadir `https://cashflow.scouttech.lat/auth/callback` a la allowlist de Supabase Auth (lo puedo hacer por API cuando exista).
- **SSO real:** el correo promete "tu sesión ya está habilitada". Eso es cierto a nivel de proyecto (mismo `auth.users`), pero el usuario igual debe pasar por el login de Google una vez en el dominio de Cashflow. Verificar el flujo end-to-end en el dominio prod antes del envío.
- **Remitente/dominio verificado en Resend** (SPF/DKIM/DMARC sobre scouttech.lat) para no caer en spam.
