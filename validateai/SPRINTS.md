# ValidateAI — Roadmap de Sprints

> Documento vivo. Actualizar estado de cada caso al completarlo.
> Fecha de inicio: Mayo 2026 · Estado actual: MVP funcional en producción.

---

## Sprint 1 — Monetización base
**Objetivo:** Que alguien pueda pagar y subir de tier.
**Semana:** 1

| # | Caso | Detalle | Estado |
|---|------|---------|--------|
| 1 | Stripe Checkout | Crear productos en Stripe (Basic/Pro/Premium). Página `/pricing` con botón que llama `stripe.redirectToCheckout()` | ⬜ |
| 2 | Webhook Stripe → Supabase | Edge function `stripe-webhook` que recibe `checkout.session.completed` y hace `UPDATE profiles SET tier = ?` | ⬜ |
| 3 | Portal de cliente Stripe | Botón "Gestionar suscripción" → `stripe.createBillingPortalSession()` para cancelar/cambiar plan | ⬜ |
| 4 | Feedback de rate limit en UI | Cuando `ai-validate` devuelve 429, mostrar toast específico con CTA a `/pricing` en vez de error genérico | ⬜ |
| 5 | Badge de tier en Header | Mostrar `free / basic / pro / premium` junto al avatar. Clickeable → `/pricing` | ⬜ |
| 6 | PostHog setup | Instalar `posthog-js`, identificar usuario en login, trackear `wizard_step_completed`, `validation_completed`, `deliverable_viewed`, `upgrade_cta_clicked`, `wizard_abandoned` | ⬜ |
| 7 | Guard de tier en DeliverableTabs | Los 8 deliverables on-demand verifican tier antes de llamar AI, en vez de solo esconder la UI con `LockedSection` | ⬜ |
| 8 | Migración: `market_ai_insights.user_id` | La columna existe en el rate limit query pero puede no estar en la tabla — agregar con migración SQL | ⬜ |
| 9 | Migración: `training_data.user_id` | Mismo problema para `anonymize-idea` rate limit | ⬜ |
| 10 | Test manual end-to-end del checkout | Validar flujo completo con tarjeta de prueba Stripe: pago → webhook → tier actualizado → secciones desbloqueadas | ⬜ |

---

## Sprint 2 — Retención y producto
**Objetivo:** Que los usuarios vuelvan y completen el wizard.
**Semana:** 2

| # | Caso | Detalle | Estado |
|---|------|---------|--------|
| 1 | Email welcome (Resend) | Edge function `send-email` con plantilla de bienvenida. Trigger: `handle_new_user` en Supabase ya existe, agregar llamada a Resend | ⬜ |
| 2 | Email "validación lista" | Enviar email cuando `status = completed`. Trigger post-UPDATE en Supabase o llamada desde `StepGenerating` | ⬜ |
| 3 | Email "límite alcanzado" | Cuando el rate limit devuelve 429, enviar email con CTA a upgrade (una sola vez por día por usuario) | ⬜ |
| 4 | Dominio propio | Configurar dominio en Vercel + DNS. Prerequisito para que Resend envíe desde `@tudominio.com` | ⬜ |
| 5 | Wizard abandonment recovery | Si el store tiene `validationId` con `status=in_progress` al abrir `/validate`, mostrar modal "¿Continuás donde dejaste?" | ⬜ |
| 6 | Onboarding tooltip | Primer login → mostrar 3 tooltips guiados en el wizard (Shepherd.js o custom) | ⬜ |
| 7 | Compartir validación mejorado | La ruta `/shared/:token` muestra OG preview card con score y nombre (meta tags dinámicos) | ⬜ |
| 8 | Historial de uso en perfil | Página `/profile` con tokens usados hoy, tier actual, límites restantes y botón de upgrade | ⬜ |
| 9 | Admin: alertas de costo | En el panel admin, alertar si el costo estimado del día supera un umbral configurable | ⬜ |
| 10 | Feedback post-validación | Modal de 1 pregunta ("¿Qué tan útil fue este análisis? 1-5") guardado en tabla `feedback`. Fuente para iterar prompts | ⬜ |

---

## Sprint 3 — Escala y calidad
**Objetivo:** Que el producto aguante más usuarios y sea más confiable.
**Semana:** 3+

| # | Caso | Detalle | Estado |
|---|------|---------|--------|
| 1 | Tests E2E del wizard | Playwright: flujo completo desde landing hasta `/results/:id`. Corre en CI antes de cada deploy | ⬜ |
| 2 | Tests de integración Stripe | Simular webhook con Stripe CLI, verificar que `profiles.tier` se actualiza correctamente | ⬜ |
| 3 | Refactor ai-validate: prompt modules | Mover cada grupo de prompts a archivos separados (`prompts/analysis.ts`, `prompts/deliverables.ts`, etc.) sin cambiar la interfaz HTTP | ⬜ |
| 4 | Generación asíncrona con Supabase Realtime | El cliente se suscribe a `validations:id=eq.X` y la edge function hace UPDATE al terminar. Elimina riesgo de timeout | ⬜ |
| 5 | Mentores: matching semántico real | Reemplazar threshold hardcodeado por RPC `search_mentors` con pgvector, igual que competidores | ⬜ |
| 6 | Admin paginación en métricas | Las queries de gráficos están sin límite. Usar RPCs o vistas materializadas para los agregados | ⬜ |
| 7 | Cache invalidation con TTL | `cached_analyses` no tiene TTL. Agregar `expires_at` con 30 días y filtrar en la query de cache hit | ⬜ |
| 8 | CSP headers en Vercel | Agregar `Content-Security-Policy` en `vercel.json` para bloquear scripts externos no autorizados | ⬜ |
| 9 | Error monitoring (Sentry) | Instalar Sentry en el frontend. Capturar errores de `useAI`, `StepGenerating` y edge functions | ⬜ |
| 10 | SEO / landing page copy | Reescribir H1, subtítulo y beneficios con copy orientado a conversión. Agregar `sitemap.xml` | ⬜ |

---

## Sprint 4 — Crecimiento orgánico
**Objetivo:** Adquirir usuarios sin paid ads.
**Semana:** 4–5

| # | Caso | Detalle | Estado |
|---|------|---------|--------|
| 1 | Blog / contenido SEO | Crear `/blog` con 3 artículos iniciales sobre validación de ideas para Chile/LATAM. Indexables por Google | ⬜ |
| 2 | Referral program | Sistema simple: usuario comparte link único, si alguien se registra con ese link ambos obtienen 5 análisis extra | ⬜ |
| 3 | Validación pública mejorada | `/shared/:token` muestra un reporte completo publico con CTA "Validá tu idea gratis" prominente | ⬜ |
| 4 | Product Hunt launch prep | Preparar assets, screenshots, video demo de 60s, copy para PH. Coordinar upvoters | ⬜ |
| 5 | Embedding en otras herramientas | Widget embebible (`<iframe>`) con el wizard de 4 pasos. Distribuible en blogs/foros de emprendimiento | ⬜ |
| 6 | Integración con LinkedIn | Permitir importar perfil de LinkedIn para autocompletar StepFounder (OAuth LinkedIn) | ⬜ |
| 7 | Leaderboard de ideas | Ranking público (con consentimiento) de las ideas con mayor score por industria. Genera tráfico orgánico | ⬜ |
| 8 | API pública (v1) | Endpoint documentado para que otras herramientas llamen `ai-validate` programáticamente. Con API key por usuario | ⬜ |
| 9 | Integración Notion | Exportar el reporte completo directamente a una página de Notion del usuario (OAuth Notion) | ⬜ |
| 10 | Afiliados / partners | Dashboard para mentores/consultoras que refieren clientes. Comisión del 20% en el primer pago | ⬜ |

---

## Sprint 5 — Producto pro
**Objetivo:** Justificar el tier Premium con features diferenciadas.
**Semana:** 5–6

| # | Caso | Detalle | Estado |
|---|------|---------|--------|
| 1 | Comparador de ideas | Usuario puede comparar 2 validaciones lado a lado (scores, mercado, competencia) | ⬜ |
| 2 | Modo equipo | Workspace compartido: varios usuarios pueden ver y comentar la misma validación | ⬜ |
| 3 | Chat con la validación | Interface de chat donde el usuario puede hacer preguntas sobre su reporte ("¿qué pasa si cambio el precio?") usando RAG sobre su validación | ⬜ |
| 4 | Validación continua | Cron semanal que re-corre `market_signals` y `competitive_analysis` y notifica si cambió algo relevante | ⬜ |
| 5 | Pitch deck autogenerado | A partir del `pitch_letter` + datos de la validación, generar un deck de 10 slides en PDF con layout profesional | ⬜ |
| 6 | Integración con aceleradoras | Pre-llenar formularios de postulación a StartupChile, Platanus, YC con los datos de la validación | ⬜ |
| 7 | Score histórico | Gráfico de evolución del score a través de los pivotes/versiones de la idea | ⬜ |
| 8 | Modo benchmark | Comparar el score y unit economics de la idea contra el promedio de la industria en la plataforma | ⬜ |
| 9 | Validación por voz | Permitir describir la idea por audio (Whisper transcription) en vez de texto | ⬜ |
| 10 | Custom AI persona | El usuario puede elegir el "rol" del mentor AI (ex-YC partner, inversor ángel LATAM, product manager senior) | ⬜ |

---

## Sprint 6 — Operaciones y compliance
**Objetivo:** Preparar el negocio para escalar con confianza legal y operativa.
**Semana:** 6–8

| # | Caso | Detalle | Estado |
|---|------|---------|--------|
| 1 | Términos de servicio y privacidad | Redactar ToS y Privacy Policy conformes a la Ley 19.628 (Chile) y GDPR básico. Publicar en `/legal` | ⬜ |
| 2 | Consentimiento explícito de cookies | Banner de cookies con aceptar/rechazar. Integrado con PostHog para no trackear sin consentimiento | ⬜ |
| 3 | Derecho al olvido | Endpoint `/api/delete-account` que borra todos los datos del usuario (GDPR Art. 17) | ⬜ |
| 4 | Backup automático de DB | Configurar backups diarios automáticos en Supabase + retención de 30 días | ⬜ |
| 5 | Monitoreo de uptime | Configurar Better Uptime o UptimeRobot para alertar si producción cae | ⬜ |
| 6 | Rotación de API keys | Proceso documentado para rotar `ANTHROPIC_API_KEY` y `OPENAI_API_KEY` sin downtime | ⬜ |
| 7 | Multi-idioma (i18n) base | Extraer todos los strings hardcodeados a archivos de traducción `es.json` / `en.json` con `i18next` | ⬜ |
| 8 | Soporte en la app | Widget de soporte (Crisp o Intercom free tier) para que usuarios reporten bugs sin salir de la app | ⬜ |
| 9 | Auditoría de accesibilidad | Revisar contraste, navegación por teclado y ARIA labels. Apuntar a WCAG AA básico | ⬜ |
| 10 | Dashboard de facturación interna | Vista admin con MRR, churn mensual, LTV promedio por tier y proyección a 90 días | ⬜ |

---

## Estado global

| Sprint | Objetivo | Casos completados | Estado |
|--------|----------|-------------------|--------|
| 1 | Monetización base | 0 / 10 | ⬜ No iniciado |
| 2 | Retención y producto | 0 / 10 | ⬜ No iniciado |
| 3 | Escala y calidad | 0 / 10 | ⬜ No iniciado |
| 4 | Crecimiento orgánico | 0 / 10 | ⬜ No iniciado |
| 5 | Producto pro | 0 / 10 | ⬜ No iniciado |
| 6 | Operaciones y compliance | 0 / 10 | ⬜ No iniciado |

---

## Fixes aplicados (pre-sprint)

Los siguientes gaps se resolvieron antes de iniciar los sprints formales:

| Fix | Archivo | Commit |
|-----|---------|--------|
| Rate limiting por tier en `ai-validate` (free 5/basic 20/pro 50/premium 200) | `supabase/functions/ai-validate/index.ts` | `94dcabb` |
| Guard `idea_name` / `idea_industry` nulos en `StepGenerating` | `src/components/wizard/StepGenerating.tsx` | `94dcabb` |
| Abort concurrente en `useAI` (Set de AbortControllers) | `src/hooks/useAI.ts` | `94dcabb` |
| Migración `ai_interactions.user_id` + índice | `supabase/migrations/20260504_ai_interactions_user_id.sql` | `94dcabb` |
| Admin: paginación cursor-based (25 rows/page) | `src/app/routes/Admin.tsx` | `b754edb` |
| Auth JWT en `market-analyze` + rate limit 10/día | `supabase/functions/market-analyze/index.ts` | `b754edb` |
| Auth JWT en `anonymize-idea` + rate limit 5/día | `supabase/functions/anonymize-idea/index.ts` | `b754edb` |
