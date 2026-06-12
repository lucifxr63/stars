# DIRECTIVA OPERATIVA: ESTADO "VIGILANCIA" & ARQUITECTURA DEMO100

## 📌 Contexto Estratégico Actualizado (Ground Truth)
La Mesa Directiva ha revaluado el riesgo financiero del embudo de adquisición. La premisa operativa actual es:
- **ToFu (Top of Funnel - `/demo`):** Es 100% estático (renderiza `@/data/exampleReport.ts`). El costo de cómputo generativo es **$0**. El *soft-wall* captura leads (identidad) de manera gratuita. La viralidad orgánica en LinkedIn no genera *burn rate*.
- **MoFu (Middle of Funnel - `/validate`):** Aquí radica el gasto real. Solo los usuarios registrados (leads convertidos) que ejecutan validaciones consumen tokens de Claude 3.5 Sonnet.
- **BoFu (Bottom of Funnel - `/pricing`):** Congelado por Legal. Tráfico desviado a un `WaitlistModal` para capturar *Deferred Revenue*.

## 🚦 Restricciones Operativas (CODE FREEZE)
Actualmente operamos bajo un esquema de **Vigilancia**.
- **NO** se autoriza la creación de nuevas tablas en Supabase.
- **NO** se autoriza la integración de pasarelas de pago alternativas (MercadoPago/Stripe) a menos que se cruce el *deadline* legal (19 de Junio) y la Mesa emita un "GO" explícito.
- **NO** alterar la UI/UX actual. El embudo de recolección está en producción y no debe ser interrumpido.

## 🎯 Vector de Dirección Técnica (Próximos Pasos Permitidos)
Claude Code debe enfocarse EXCLUSIVAMENTE en preparar (sin desplegar a producción) la infraestructura defensiva y de telemetría:

### 1. Preparación de Defensa Nivel 1 (Throttling)
- **Objetivo:** Mapear en la función `ai-validate` exactamente qué prompt utiliza qué modelo.
- **Acción (Solo lectura/mapeo):** Identificar los puntos de inyección para enrutar el flujo `quick`/`detailed` hacia modelos de menor costo (ej. Claude 3 Haiku o GPT-4o mini) y reservar Sonnet estrictamente para el flujo `premium`. No implementar el *switch* aún, solo dejar la arquitectura lista para un *downgrade* dinámico.

### 2. Segmentación de Telemetría (Data Engineering)
- **Objetivo:** Separar el costo de adquisición.
- **Acción:** Preparar las *queries* o la lógica para aislar:
  1. *CAC de Identidad:* Leads capturados en el *soft-wall* vs. Costo de infraestructura base.
  2. *Activation Burn:* Costo de API (Anthropic/OpenAI) consumido exclusivamente por usuarios que pasaron de `email_leads` a ejecutar el `StepGenerating` en `/validate`.

### 3. Contingencia BoFu (Standby)
- Mantener en memoria el patrón `create-checkout` para replicarlo rápidamente con MercadoPago si el 19 de Junio se activa el protocolo de emergencia.
