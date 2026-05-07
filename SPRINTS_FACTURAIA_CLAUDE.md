# Plan de Ejecución de Sprints: FacturaIA (DataShield SpA)
**Contexto para Claude Code:** Eres un Ingeniero Full-Stack Senior y Arquitecto de Software. Tu objetivo es ejecutar este plan de sprints para construir el MVP de FacturaIA, una plataforma Fintech B2B2C para el mercado chileno. El sistema debe evaluar riesgo tributario con IA (simulando conexión al SII) y ofrecer liquidez a PYMEs con una comisión flat del 1.5%. Debes priorizar la seguridad, el cumplimiento de la Ley Fintec (Chile) y la Ley de Protección de Datos.

## Sprint 1: Arquitectura Base y Cumplimiento Normativo (Backend & Seguridad)
**Objetivo:** Establecer la base de datos segura y los esquemas de autenticación cumpliendo con normativas de privacidad de datos chilenas.
* **Tarea 1.1:** Configurar migraciones en `supabase/migrations/` para las tablas principales: `companies` (PYMEs), `invoices` (Facturas), `risk_assessments` (Evaluaciones).
* **Tarea 1.2:** Implementar Row Level Security (RLS) estricto en Supabase. Una PYME solo puede ver sus propios datos financieros y facturas. 
* **Tarea 1.3:** Crear el flujo de autenticación en el frontend (`src/app/routes/Login.tsx` y `AuthCallback.tsx`) asegurando el cifrado de datos en tránsito.
* **Tarea 1.4:** Preparar tabla `audit_logs` para registrar cada consulta de riesgo y transacción, requisito crítico para la CMF (Comisión para el Mercado Financiero).

## Sprint 2: Motor de Riesgo IA "SII-Simulated" (Edge Functions)
**Objetivo:** Desarrollar el core tecnológico que justifica la "aprobación en 10 minutos".
* **Tarea 2.1:** Crear una nueva Supabase Edge Function `supabase/functions/sii-risk-evaluator/`.
* **Tarea 2.2:** Integrar OpenAI/Claude en la Edge Function para analizar metadatos de facturas (Monto, RUT Emisor, RUT Receptor, Fecha) y generar un "Tax Risk Score" (0-100).
* **Tarea 2.3:** Implementar lógica de negocio: Si el pagador es "Gran Empresa" (RUTs pre-aprobados) y el riesgo es bajo, aprobar automáticamente.
* **Tarea 2.4:** Crear la interfaz de conexión en el frontend (`src/hooks/useRiskEvaluator.ts`) para llamar a esta función desde el dashboard del cliente.

## Sprint 3: Dashboard de Usuario y Flujo Financiero (Unit Economics Frontend)
**Objetivo:** Tangibilizar la propuesta de valor para la PYME (Transparencia y Rapidez).
* **Tarea 3.1:** Construir la vista `src/app/routes/Dashboard.tsx` donde la PYME pueda subir el XML/PDF de su factura.
* **Tarea 3.2:** Crear un componente de UI (Gráfico/Desglose) que muestre el cálculo transparente: Monto Factura - 1.5% (Comisión Flat) = Monto a Transferir.
* **Tarea 3.3:** Implementar el "Customer Journey" en `src/components/wizard/`: Paso 1 (Sube Factura) -> Paso 2 (Análisis IA en Segundos con UI de Skeleton/Loading) -> Paso 3 (Oferta de Liquidez) -> Paso 4 (Aceptar y Simular Transferencia).
* **Tarea 3.4:** Crear un panel de administración (`src/app/routes/Admin.tsx`) para la Mesa Directiva, mostrando el CAC, LTV estimado, NPL (Non-Performing Loans simulados) y Volumen Procesado.

## Sprint 4: Tracción y Generación de LOIs (Go-to-Market)
**Objetivo:** Conseguir a los 10 primeros "Design Partners" (Clientes Iniciales) para mitigar el riesgo de Ejecución (Score 70).
* **Tarea 4.1:** Desarrollar una Landing Page hiper-optimizada (`src/app/routes/Landing.tsx`) enfocada en el dolor: "Transforma tus facturas a 90 días en efectivo en 10 minutos por solo 1.5%".
* **Tarea 4.2:** Integrar un flujo de "Carta de Intención (LOI) Digital" embebido. En lugar de un registro simple, los primeros usuarios firman digitalmente un acuerdo de uso de la beta cerrada.
* **Tarea 4.3:** Añadir integraciones de analítica (PostHog/Google Analytics) para medir la conversión del embudo y optimizar el CAC.
* **Instrucción Final para Claude:** Al finalizar este sprint, debes generar un reporte técnico (`ESTADO_MVP.md`) detallando la deuda técnica y los próximos pasos para la integración real con bancos/pasarelas (ej. Kushki/Fintoc).
