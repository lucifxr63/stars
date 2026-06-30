# Validus — Programa de Pilotos Comerciales

> **Estado:** Borrador operativo v0.1 · 2026-06-30
> **Naturaleza:** Documento interno de operación de ventas. **No** es material de inversión ni implica pilotos activos, clientes ni acuerdos firmados.
> **Etapa:** Pre-revenue. El cobro está en pausa (waitlist Early Bird); los pilotos buscan **validar valor y disposición a pagar**, no facturar todavía.

## 1. Objetivo del piloto

Pasar de "producto preparado" a **producto validado comercialmente** con un grupo pequeño y controlado de usuarios reales, para responder con evidencia (no opinión):

- ¿Qué parte del dossier genera valor real y accionable?
- ¿Qué secciones no se entienden o no se confían?
- ¿Hay disposición a pagar, y a qué precio/plan?
- ¿Qué falta para que lo usen "en serio" (no como demo)?

> No es objetivo del piloto: generar revenue, inflar métricas, ni conseguir testimonios anticipados.

## 2. Perfil de usuarios piloto (segmentos)

| Segmento | Por qué | Qué valida |
|---|---|---|
| **Founders early-stage** | Dolor inmediato, ciclo corto | Claridad, ahorro de tiempo, "ordenar antes de construir" |
| **Startups pre-seed / seed** | Necesitan evidencia para su ronda | Profundidad, credibilidad ante inversionistas |
| **Aceleradoras / incubadoras** | Canal de alto apalancamiento (cohortes) | Estandarización del diagnóstico, comparabilidad |
| **Equipos de innovación corporativa** | Ticket mayor, ciclo más largo | Evaluación de oportunidades antes de invertir presupuesto |
| **Mentores / scouts** | Pre-screening de deal flow | Velocidad de lectura, banderas rojas |

## 3. Criterios de selección

Incluir cuando el candidato:
- Tiene un caso **real y en curso** (no hipotético) que quiere validar.
- Está dispuesto a **dar feedback estructurado** (entrevista + encuesta corta).
- Pertenece a uno de los segmentos objetivo (Chile / LatAm prioritario).
- Acepta las condiciones de privacidad (Ley 21.719) y el carácter orientativo del análisis.

Excluir / despriorizar cuando:
- Solo busca una herramienta gratis sin intención de feedback.
- El caso es demasiado genérico para evaluar valor.
- Requiere features no implementadas como condición (anotar como "no califica — gap de producto").

## 4. Duración sugerida

- **Piloto individual (founder/startup):** 1–2 semanas (1 validación end-to-end + entrevista).
- **Piloto de cohorte (aceleradora):** 3–4 semanas (N proyectos + sesión de cierre).
- **Equipo de innovación:** 2–4 semanas según número de oportunidades a evaluar.

## 5. Flujo de onboarding del piloto

1. **Captación:** waitlist Early Bird, CTA "Solicitar piloto", o contacto directo.
2. **Calificación:** chequeo rápido contra §3 (segmento, caso real, disposición a feedback).
3. **Alta:** acceso a la plataforma (plan acordado para el piloto).
4. **Uso guiado:** el usuario corre al menos **1 validación end-to-end** (wizard → dossier).
5. **Discovery:** entrevista con el guion de [PILOT_INTERVIEW_SCRIPT.md](PILOT_INTERVIEW_SCRIPT.md).
6. **Feedback:** encuesta corta + registro en [SALES_PIPELINE_TEMPLATE.md](SALES_PIPELINE_TEMPLATE.md).
7. **Cierre:** síntesis de aprendizajes + decisión (interés de pago / no califica / iterar).

## 6. Qué se mide (referencia a la analítica existente, Fase 8)

| Métrica | Fuente |
|---|---|
| Leads capturados | `checkout_waitlist_captured` (PostHog) + tabla `email_leads` |
| Waitlist abierto | `waitlist_opened` |
| Inicio de registro | `signup_started` |
| Wizard iniciado | `wizard_started` |
| Generación iniciada/completada | `validation_generation_started` / `validation_completed` |
| Dossier visto | `validation_result_viewed` |
| Trust Layer / evidencia | `trust_layer_opened`, `evidence_wall_viewed` |
| Paywall / intención de pago | `paywall_hit`, `checkout_waitlist_hit` |

> Demos agendadas, pilotos iniciados/completados y feedback se llevan **manualmente** en el pipeline (no hay evento dedicado todavía).

## 7. Qué feedback se recopila

- **Cuantitativo (encuesta corta, 1–5):** utilidad del dossier, confianza en el análisis, claridad, probabilidad de recomendar.
- **Cualitativo (entrevista):** qué sección aportó más/menos valor, qué no se entendió, disposición y umbral de pago, qué falta para uso real.

## 8. Criterios de éxito del programa

> Definir umbrales con el equipo antes de arrancar. Sugeridos (a calibrar):
- ≥ X% de pilotos completan una validación end-to-end.
- ≥ X% reportan utilidad ≥ 4/5.
- ≥ X candidatos expresan **disposición de pago** concreta (plan + precio).
- Al menos 1 aceleradora/incubadora interesada en un piloto de cohorte.

> Pendiente: fijar los valores de X con el equipo (no inventar).

## 9. Riesgos

- **Sesgo de complacencia:** los pilotos tienden a ser amables → usar preguntas no inductivas ([PILOT_INTERVIEW_SCRIPT.md](PILOT_INTERVIEW_SCRIPT.md)).
- **Falsos positivos de valor:** "me gusta" ≠ "pagaría". Medir disposición real.
- **Gaps de producto** que bloquean uso real → registrar, no improvisar features.
- **Cobro en pausa:** no se puede medir conversión real a pago hasta reactivar la pasarela; se mide **intención**.
- **Privacidad:** no recopilar PII innecesaria; respetar Ley 21.719.

## 10. Cómo convertir piloto → pago

1. Confirmar valor (utilidad + caso resuelto).
2. Confirmar disposición y plan adecuado (Free→Premium / B2B para cohortes).
3. Registrar "Interés en pago" en el pipeline.
4. **Cuando el cobro esté activo** (LemonSqueezy reactivado): enviar link de pago Early Bird con el descuento prometido.
5. Para aceleradoras/equipos: proponer licencia por cohorte/asientos (packaging B2B — pendiente de definir).

## 11. Qué NO prometer

- No prometer levantamiento de inversión ni éxito comercial.
- No llamar "clientes" a usuarios tempranos o leads.
- No afirmar pilotos activos, acuerdos firmados ni revenue que no existan.
- No prometer features no implementadas ni fechas que no se puedan cumplir.
- No presentar como "asesoría" lo que es análisis orientativo.

---

## Pendientes operativos (requieren producto/infra — fuera de alcance de esta fase)

- **Captura de lead enriquecida:** hoy la waitlist persiste **solo el email** (`email_leads`); el **plan de interés, la fuente y el segmento** viven solo en PostHog, no unidos al lead. Para gestionar pilotos a escala convendría persistirlos → requiere tocar la Edge Function `send-quick-lead` y el schema de `email_leads` (decisión aparte).
- **Estados de piloto en sistema:** hoy se gestionan en el pipeline Markdown; a futuro, un CRM ligero o tabla dedicada.
- **Reactivación de cobro** (LemonSqueezy) para medir conversión real.
