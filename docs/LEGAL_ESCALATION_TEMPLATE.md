# Escalación a Legal — Desbloqueo Pasarela de Pagos (LemonSqueezy)

> Registro histórico de decisión de compliance. Creado: 2026-06-12.
> Estado: BoFu bloqueado por Legal. Disparado por la Mesa Directiva el 2026-06-12.
> Regla de contingencia: si no hay ETA viable en **7 días** (deadline 2026-06-19),
> se levanta el Code Freeze **exclusivamente** para el ticket del bypass de pago
> (MercadoPago/Stripe link manual para leads Premium).

---

## Mensaje de escalación

**Asunto: [URGENTE] ETA firme para destrabar pasarela de pagos — bloqueando ingresos**

Equipo, necesito por escrito el estado exacto del bloqueo de LemonSqueezy. El código
de monetización está listo y desplegado; lo único entre nosotros y el primer peso es
el desbloqueo legal/compliance.

Necesito respuesta a 3 preguntas concretas, **hoy**:

1. ¿El nudo es **constitución de la SpA**, **cumplimiento tributario SII**, o los
   **ToS de LemonSqueezy** (Merchant of Record)?
2. ¿Cuál es el **ETA firme** (fecha, no "pronto")?
3. ¿Qué necesitan **de mí** para acelerarlo?

Contexto de negocio: cada día sin pasarela subsidiamos el 100% del costo de cómputo
(tokens Claude) a cambio de un email. Es burn rate puro. **Si el ETA supera 7 días,
activo un bypass manual (MercadoPago/Stripe link) para leads Premium** — necesito que
validen esa ruta como contingencia.

---

## Contingencia: bypass de pago (solo si ETA > 7 días)

- **Trigger:** Legal no entrega ETA viable antes del 2026-06-19.
- **Alcance:** link de pago manual (MercadoPago o Stripe local) para leads Premium.
  Es una feature nueva → el Code Freeze se levanta SOLO para este ticket.
- **Estimación:** ~1 día de implementación.
- **No tocar hasta el trigger.**
