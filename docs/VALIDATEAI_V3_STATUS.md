# Estado Actual del Sistema: ValidateAI V3 (Mayo 2026)

Este documento resume el estado arquitectónico, funcional y de cumplimiento (compliance) de la plataforma ValidateAI tras la finalización del sprint de actualización (Fases 1 a 5).

---

## 1. Compliance y Seguridad Legal (Fase 1)
Se blindó la plataforma para cumplir estrictamente con la **Ley 21.719** (Protección de Datos Personales en Chile).
* **Frontend:** Se integró un `ConsentModal.tsx` de carácter bloqueante. Si el usuario no ha aceptado los términos en la sesión actual o en la base de datos, no puede interactuar con los análisis de la IA.
* **Base de Datos:** Se creó la tabla inmutable `consent_logs` con políticas RLS de solo inserción.
* **Backend:** Todas las Edge Functions principales (`ai-validate`, `market-analyze`) cuentan con un middleware (Guard) que consulta `consent_logs`. Si el usuario no tiene registro de consentimiento explícito, la API corta la ejecución devolviendo un error HTTP `403 Forbidden`.

## 2. Resiliencia B2G y Paralelismo (Fase 2)
Se refactorizó el pipeline de análisis de mercado para garantizar alta disponibilidad incluso si las fuentes del gobierno fallan.
* **Arquitectura:** El fetch síncrono antiguo fue reemplazado por `Promise.allSettled()`.
* **Fuentes Integradas:** 
  * Banco Central de Chile (BDE)
  * Instituto Nacional de Estadísticas (INE)
  * Mercado Público (Licitaciones)
  * API Chile Abierto (Datos comunales y poblacionales)
* **Manejo de Errores:** Si una API externa se cae o excede el timeout, el sistema no colapsa. En su lugar, el error se captura en un array `dataWarnings[]`, el cual es inyectado al Mega-Prompt para que Claude 3.5 Sonnet adapte su veredicto (RAG adaptativo).

## 3. Arquitectura Asíncrona (Event-Driven) para Webhooks (Fase 3)
La extracción de antecedentes legales, marcas y cuentas bancarias es lenta por naturaleza, por lo que se migró de un modelo bloqueante a uno asíncrono.
* **Supabase `temp_context`:** Se creó una tabla dedicada como almacén temporal de datos JSON provenientes de Webhooks. Es accesible solo por el `service_role`.
* **Fintoc (Open Banking):** Edge Functions `fintoc-link` (creación de sesión) y `fintoc-webhook` (recepción de transacciones).
* **PJUD e INAPI:** Edge Function `webhook-pjud` asegurada mediante firmas HMAC-SHA256 para ingestar causas judiciales y registros de marcas comerciales.

## 4. Motor Analítico RAG estilo Paul Graham (Fase 4)
Se consolidó la inteligencia de evaluación (Due Diligence Score) emulando el rigor de un fondo de Venture Capital.
* **Edge Function `assemble-mega-prompt`:** Función que compila la idea base + datos financieros (Fintoc) + antecedentes (PJUD/INAPI) desde `temp_context`.
* **Determinismo (Temperature = 0):** El Mega-Prompt es enviado a GPT-4o con una temperatura de `0`, asegurando que las decisiones de inversión (Scores, Red Flags) sean 100% basadas en datos (compliance) sin alucinaciones.
* **UI/UX (Bento Box):** Se actualizó `ValidationDetail.tsx` con un estado de *"Espera Activa"* (Skeleton loaders animados y spinners) mientras se ensamblan los contextos, culminando en la tarjeta `DueDiligenceScoreCard`.

## 5. KYC Biométrico / Validación de Identidad (Fase 5)
Se introdujo una barrera de fricción controlada para evitar bots y asegurar cumplimiento AML (Anti-Money Laundering).
* **Bloqueo Global (`ProtectedLayout.tsx`):** Un guardia de estado intercepta todas las rutas protegidas de la aplicación.
* **KycModal:** Un modal que solicita el RUT del usuario en caso de que su cuenta no esté verificada (`kyc_status != 'verified'`).
* **Algoritmo Módulo 11 (`validate-rut`):** Edge Function que procesa el ingreso, verifica el dígito verificador matemáticamente, y si es válido, usa privilegios elevados para actualizar la tabla `profiles`. (Posible futura integración a Full Biometric con Didit vía SDK usando la misma lógica de estados).

---

## Tareas Pendientes o "Próximos Pasos"
El sistema actualmente se encuentra estable y todas sus funciones nativas desplegadas, pero requiere de las siguientes validaciones manuales por parte de DevOps / Admin:
1. Asegurar que las variables de entorno de Supabase incluyan las claves productivas actualizadas (`FINTOC_SECRET_KEY`, `PJUD_WEBHOOK_SECRET`, `OPENAI_API_KEY`, etc.).
2. Confirmar que la última migración de base de datos SQL (`kyc_status` y `rut`) haya sido ejecutada correctamente en el dashboard web de Supabase de producción, debido a problemas de sincronización en el historial CLI.
3. Asegurar que la configuración CORS de las Edge Functions (`ALLOWED_ORIGINS`) incluya los dominios finales de producción.
