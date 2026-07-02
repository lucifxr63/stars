# Validus — Plantilla de Pipeline Comercial (Pilotos)

> **Estado:** Plantilla operativa v0.1 · 2026-06-30
> **Uso interno.** Es una **plantilla vacía**: las filas de ejemplo son filas-guía, **no leads reales**. No registrar PII innecesaria; anonimizar al compartir fuera del equipo.

## Estados del pipeline

`Nuevo` → `Contactado` → `Demo agendada` → `Piloto activo` → `Feedback recibido` → `Interés en pago` → (`Cerrado` | `No califica`)

| Estado | Significado |
|---|---|
| **Nuevo** | Lead capturado (waitlist, CTA piloto, referido), sin contactar |
| **Contactado** | Primer contacto hecho; pendiente respuesta/calificación |
| **Demo agendada** | Sesión de demo/onboarding fijada |
| **Piloto activo** | Usando la plataforma; corriendo validación end-to-end |
| **Feedback recibido** | Entrevista/encuesta completada |
| **Interés en pago** | Expresó disposición concreta (plan + umbral) |
| **No califica** | Fuera de segmento / sin caso real / gap de producto bloqueante |
| **Cerrado** | Convertido (cuando haya cobro) o descartado, con motivo |

## Tipos y fuentes

- **Tipo:** Founder · Pre-seed/Seed · Aceleradora · Incubadora · Equipo de innovación · Mentor/Scout.
- **Fuente:** Waitlist Early Bird · CTA "Solicitar piloto" · Referido · LinkedIn/X · Evento · Aceleradora partner · Otro.

## Tabla de pipeline

> Reemplazar las filas de ejemplo por leads reales. Usar un alias/identificador, no datos personales completos, en este documento versionado.

| ID | Tipo | Fuente | Estado | Dolor principal | Plan sugerido | Próxima acción | Fecha contacto | Resultado | Riesgos | Notas |
|----|------|--------|--------|-----------------|---------------|----------------|----------------|-----------|---------|-------|
| _ej. L-001_ | _Founder_ | _Waitlist_ | _Nuevo_ | _Valida idea antes de construir_ | _Free→Pro_ | _Enviar acceso_ | _AAAA-MM-DD_ | _—_ | _Sólo busca gratis_ | _—_ |
| _ej. L-002_ | _Aceleradora_ | _Referido_ | _Contactado_ | _Diagnóstico de cohorte_ | _B2B (cohorte)_ | _Agendar demo_ | _AAAA-MM-DD_ | _—_ | _Ciclo largo_ | _Piloto de 8 proyectos_ |
| | | | | | | | | | | |
| | | | | | | | | | | |

## Resumen de embudo (actualizar manualmente)

| Etapa | Conteo | Fuente de dato |
|---|---|---|
| Leads (Nuevo+) | _0_ | `email_leads` / `checkout_waitlist_captured` |
| Contactados | _0_ | manual |
| Demos agendadas | _0_ | manual |
| Pilotos activos | _0_ | manual |
| Feedback recibido | _0_ | manual + encuesta |
| Interés en pago | _0_ | manual |
| Convertidos | _0_ | (pendiente: requiere cobro activo) |

> Pre-revenue: la fila "Convertidos" permanece en 0 hasta reactivar la pasarela de pago. No inventar conversiones.

> **Fase 1 pilotos (2026-07):** las solicitudes desde `/dashboard` ahora se **persisten en la tabla `pilots`** (estado inicial `nuevo`), en vez de existir solo como lead/evento. Los estados de `pilots.status` coinciden con los de esta plantilla.
>
> **Fase 2 pilotos (2026-07):** el pipeline ya **se gestiona desde la app**: `/admin` → tab **"Pilotos"** permite listar, filtrar por estado, **cambiar `status`** y **editar notas internas (`admin_notes`, solo admin)**. Esta plantilla Markdown pasa a ser respaldo/planificación; la fuente operativa es la tabla `pilots`. Notificación por email y multi-admin siguen pendientes.

## Higiene de datos

- **No** pegar emails/teléfonos/nombres completos en este documento versionado en git. Usar alias (`L-001`) y mantener el detalle de contacto en un lugar privado/seguro fuera del repo.
- Revisar el pipeline semanalmente; mover estados con fecha.
- Registrar **motivo** en `No califica`/`Cerrado` (aprendizaje, no solo descarte).

## Relación con la analítica (Fase 8)

Los conteos de leads/waitlist pueden contrastarse con PostHog (`waitlist_opened`, `checkout_waitlist_hit/captured`) y la tabla `email_leads`. Demos, pilotos y feedback se mantienen manualmente hasta que exista instrumentación dedicada. Ver [PILOT_PROGRAM.md](PILOT_PROGRAM.md) §6.
