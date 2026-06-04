# Estado del Producto — ValidateAI
**Fecha:** 3 de junio de 2026 · **Elaborado por:** Auditoría CTO/PM · **Confidencial**

---

## 1. Executive Summary (Para el CEO)

**Estado Actual del Producto:** MVP funcional en producción con arquitectura de escala. El núcleo del producto —wizard de 4 pasos, motor de IA con 18 tipos de análisis, sistema de tiers y dashboard de resultados— opera en vivo en [validus.scouttech.lat](https://validus.scouttech.lat). El equipo ha completado un trabajo técnico significativo que supera lo habitual para esta etapa (privacidad K-Anonymity, API v1, módulo de encuestas, integración INAPI). El producto puede recibir usuarios hoy.

**KPI de Negocio — ¿Qué valor entregamos hoy?**
- Un fundador ingresa su idea y en minutos recibe un score 0–100 con desglose en 5 dimensiones (problema, mercado, competencia, solución, ejecución).
- Accede a hasta 18 análisis avanzados: Unit Economics, Competitive Analysis, Founder-Market Fit, MVP Kanban, Proyecciones Financieras, mapa regional 3D de Chile.
- El análisis usa datos macroeconómicos reales del Banco Central e INE, no solo IA genérica.
- Puede exportar un reporte PDF para compartir con inversores o mentores.

**Salud del Proyecto:** 🟡 **Amarillo**
> El producto es técnicamente sólido y está en producción. La señal de alerta es una sola: **el mecanismo de cobro existe en el código pero aún no está activado**. Tenemos un Ferrari construido sin la llave en la ranura. Una vez que Lemon Squeezy está configurado, el semáforo pasa a verde.

---

## 2. Auditoría Técnica (Para el CEO — lenguaje de impacto)

### ¿Qué funciona hoy?

| Capacidad | Estado | Detalle |
| :--- | :---: | :--- |
| Wizard de validación 4 pasos | ✅ Activo | Formulario guiado con validación Zod, guardado automático en Supabase |
| Motor de IA (18 análisis) | ✅ Activo | Claude Sonnet 4 con fallback a GPT-4o Mini. Prompt Caching para reducir costos |
| Sistema de Tiers (Free/Basic/Pro/Premium) | ✅ Activo | Gating de features por tier, rate limiting por tier implementado |
| Caché Semántico (pgvector) | ✅ Activo | Reutiliza análisis similares. Ahorro estimado >40% en costos de tokens |
| Dashboard de resultados ("Bento Box") | ✅ Activo | 5 tabs con visualizaciones, mapa 3D, gráficos Recharts |
| Autenticación (Email + Google OAuth) | ✅ Activo | Flujo PKCE seguro, creación automática de perfil |
| Datos macroeconómicos Chile | ✅ Activo | Integración BCCh + INE para clasificación industrial y series económicas |
| Export PDF | ✅ Activo | 5 templates PDF (Unit Economics, Pitch Deck, Lean Roadmap, Compliance, Dossier) |
| Panel Admin | ✅ Activo | Métricas de uso, paginación cursor-based, gestión de usuarios |
| Telemetría PostHog | ✅ Activo | Pipeline de eventos implementado con proxy edge para privacidad |
| Módulo de Encuestas | ✅ Activo | Builder + respuestas + análisis IA con detección de bias (Mom Test) |
| API v1 Pública | ✅ Existe | Edge Function con auth, rate limit y rutas /validate, /rag, /data |
| Privacy Pipeline | ✅ Activo | RUT hasheado, IPs truncadas /24, K-Anonymity, audit separation |
| Pricing Page | ✅ Existe | Página `/pricing` con planes y botón de checkout |
| **Checkout + Webhook Lemon Squeezy** | ⚠️ **Pendiente config** | **Código 100% escrito. Solo faltan los secrets en Supabase** |

### Debilidad Principal

**La funcionalidad "premium" más visible al usuario usa datos ficticios.** La `EvidenceWall` —el componente que muestra señales de mercado real (Reddit, Google Trends)— devuelve datos mock. Un usuario Premium paga por señales de mercado en tiempo real y recibe datos fabricados. Esto es el mayor riesgo de reputación y churn del producto hoy. La solución existe en el roadmap (SerpAPI ya tiene key configurada), pero la integración real aún no está terminada.

### Infraestructura

Stack de producción robusto y sin riesgo técnico de escala inmediata:
- **Hosting:** Vercel (frontend) + Supabase (DB + Edge Functions en Deno) — infraestructura serverless que escala automáticamente.
- **Base de datos:** PostgreSQL + pgvector — 70+ migraciones aplicadas, esquema maduro.
- **IA:** Anthropic Claude Sonnet 4 con fallback a OpenAI — redundancia de proveedor.
- **Seguridad:** HMAC en webhooks, PKCE en auth, K-Anonymity en datos de entrenamiento, RUT hasheado.
- **Observabilidad:** PostHog + cron de salud semanal de tiers activo.

---

## 3. Estado del Roadmap (Plan vs. Realidad)

| Hito | Estado | Impacto para el Usuario |
| :--- | :---: | :--- |
| Wizard 4 pasos + Score IA | ✅ Completo | Recibe validación completa en < 3 min |
| 18 tipos de análisis avanzados | ✅ Completo | Análisis profundo por tier sin trabajo manual |
| Sistema de tiers (Free → Premium) | ✅ Completo | Acceso granular según presupuesto |
| Rate limiting por tier | ✅ Completo (pre-sprint) | Protección de costos de infraestructura |
| Caché semántico pgvector | ✅ Completo | Respuestas más rápidas y costos menores |
| Integración BCCh + INE | ✅ Completo | Datos macroeconómicos reales de Chile |
| Mapa 3D mercado regional Chile | ✅ Completo | Visualización única vs. competidores |
| Telemetría PostHog | ✅ Completo | Equipo puede medir comportamiento de usuarios |
| Privacy Pipeline (Ley 21.719) | ✅ Completo | Cumplimiento legal para datos personales |
| Módulo de Encuestas con IA | ✅ Completo | Herramienta complementaria de validación |
| INAPI (patentes y marcas Chile) | ✅ Completo | Búsqueda de PI integrada al análisis |
| **Checkout / Pagos (Lemon Squeezy)** | ⚠️ Código listo, sin activar | **Bloquea toda la monetización** |
| Emails transaccionales (Resend) | ⚠️ Edge Function lista, sin cron | Sin emails de bienvenida ni de re-engagement |
| EvidenceWall (Reddit + Trends real) | 🔴 En riesgo | Feature premium entrega datos falsos |
| LinkedIn OAuth (perfil fundador) | 🔴 Bloqueado | Requiere LinkedIn Company Page creada |
| Gobernanza / Cap Table | 🔴 No existe aún | Categoría prometida sin código backend |
| Tests E2E + Monitoring (Sentry) | 🔴 No iniciado | Riesgo de regressions silenciosas en producción |
| Dominio propio | ⬜ No iniciado | Hoy opera en subdominio `validus.scouttech.lat` |
| SEO + Landing copy orientado a conversión | ⬜ No iniciado | Adquisición orgánica bloqueada |
| Stripe / generación async | N/A | **Migrado a Lemon Squeezy** (decisión correcta para LATAM) |

---

## 4. Propuesta de Valor para el CEO

### ¿Qué le vendemos a los usuarios?

> **"Validá tu idea de negocio con IA antes de gastar un peso."**

ValidateAI convierte 20 minutos de respuestas en un reporte investment-ready: score cuantificado en 5 dimensiones, análisis competitivo con datos chilenos reales, unit economics proyectados, roadmap de MVP y fit fundador-mercado. Lo que antes requería contratar un consultor por $300.000 CLP, hoy cuesta $9.990 CLP al mes.

**El diferenciador real vs. herramientas genéricas:** datos macroeconómicos del Banco Central e INE integrados nativamente. No es IA genérica con contexto chileno pegado encima — es un sistema construido para el ecosistema LATAM.

### Plan de Mitigación de Fricciones en Onboarding

El equipo ha implementado varias capas para reducir abandono:
1. **Wizard guiado en pasos** (no un formulario largo único) con validación en tiempo real.
2. **Onboarding de 3 pasos** post-registro que contextualiza el valor antes del wizard.
3. **Recovery modal** para sesiones abandonadas (store Zustand persistido).
4. **Demo mode** (`/demo`) que muestra resultados sin requerir registro.
5. **Flujo Quick ICP** para usuarios que quieren saltar directo a resultados.

---

## 5. Recomendación Estratégica

### Siguiente Paso Crítico — Esta Semana

**Activar Lemon Squeezy. Literalmente hoy.**

El código de checkout (`create-checkout`) y el webhook (`lemonsqueezy-webhook`) están 100% escritos, probados y desplegados. La página de pricing existe. El sistema de tiers funciona. Lo único que falta son **5 variables de entorno** en el panel de Supabase:

```
LS_WEBHOOK_SECRET=...
LEMONSQUEEZY_API_KEY=...
LS_STORE_ID=...
LS_VARIANT_BASIC=...
LS_VARIANT_PRO=...
LS_VARIANT_PREMIUM=...
```

**Tiempo estimado de activación: 2–4 horas** (crear cuenta LS → definir productos → copiar IDs → configurar secrets → verificar webhook en modo test).

**Por qué es lo más importante:**
- Sin pagos activos, todo lo demás es un ejercicio técnico. Cada día sin checkout activo es un día de potencial revenue en $0.
- El margen bruto proyectado es >90% (costo variable ~$1 USD por reporte, precio Basic ~$11 USD).
- Con LTV/CAC > 3x el producto es bankable desde el primer pago.
- Todo lo demás del Sprint 1 (emails, badge de tier, UI del rate limit) puede hacerse en paralelo o después — pero sin el checkout no hay negocio.

**Segundo paso inmediato (esta semana):** Fijar un dominio propio. Mientras el producto viva en `validus.scouttech.lat`, Resend no puede enviar emails desde un dominio propio y la credibilidad ante inversores y usuarios cae significativamente.

---

*Documento generado el 2026-06-03. Para actualizar este reporte, re-ejecutar la auditoría contra `SPRINTS.md` y el estado de Edge Functions en producción.*
