# Validus — Seguridad y Privacidad

> **Estado:** Borrador inicial · 2026-06-29
> **Importante:** No se reclaman certificaciones (ISO, SOC 2, etc.). Validus **no** cuenta con esas certificaciones a la fecha. Este documento describe prácticas implementadas y pendientes, no compliance certificado.

## Autenticación

- Autenticación gestionada por **Supabase Auth** con flujo **PKCE**.
- **Google OAuth** disponible como método de acceso.
- Las rutas protegidas se controlan mediante un layout que verifica el estado de sesión.
- Tokens de sesión con expiración.

## Manejo y almacenamiento de datos

- **Base de datos:** Supabase (Postgres). Control de acceso a nivel de fila (**RLS**) en las tablas de datos de usuario.
- **Cifrado:** en tránsito (TLS) y en reposo a nivel de proveedor.
- Las ideas de negocio del usuario se procesan para generar el análisis y **no se comparten** con otros usuarios.

## Privacidad (Ley 21.719 — Chile)

La política de privacidad publicada del producto se redactó conforme a la **Ley 21.719** de Protección de Datos Personales de Chile e incluye, entre otros: responsable del tratamiento (ScoutTech SpA), datos recopilados, finalidad, base legal, derechos ARCO+, conservación y sub-encargados.

Medidas de privacidad implementadas (de iniciativas internas verificadas):
- **Hashing de RUT** en un vault separado.
- **Truncado de IP** (se eliminan los últimos bits antes de almacenar).
- **Separación de auditoría** para accesos a datos sensibles.
- Uso de datos anonimizados para mejora del modelo **solo con consentimiento explícito y revocable**.

> Pendiente: reconciliar un punto de la política publicada — menciona "Stripe" como procesador de pagos, mientras que el cobro real previsto es vía **LemonSqueezy** (hoy en pausa). Debe alinearse el listado de sub-encargados antes de la versión definitiva.

## Procesamiento por IA

Las ideas se procesan mediante modelos de **Anthropic (Claude)** vía API, con el único fin de generar la respuesta solicitada. El almacenamiento de versiones anonimizadas para entrenamiento/mejora es **opcional** y revocable por el usuario.

## Sub-encargados (proveedores)

Proveedores de infraestructura y servicios (según la política publicada y la arquitectura del proyecto): **Supabase** (datos/auth), **Vercel** (hosting/CDN), **Anthropic** (IA). Para datos externos/analítica pueden intervenir servicios adicionales (p. ej. analítica de producto, envío de correo, fuentes de datos de mercado).

> Pendiente: publicar el listado de sub-encargados **definitivo y exacto** (incluyendo procesador de pagos real y servicios de datos externos) y sus ubicaciones de procesamiento.

## Logs y auditoría

- Existe separación de auditoría para accesos a datos sensibles.
- Analítica de producto (eventos de uso) de forma seudonimizada.

> Pendiente: documentar política formal de retención de logs y procedimiento de respuesta ante incidentes.

## Backups y continuidad

> Pendiente: documentar política de backups, RPO/RTO y plan de recuperación ante desastres. A la fecha se depende de las capacidades del proveedor (Supabase); falta formalizar y documentar una política propia.

## Riesgos de seguridad pendientes

- **Sub-encargados:** listado por reconciliar y publicar (ver arriba).
- **Backups/DRP:** política propia por formalizar.
- **Respuesta a incidentes:** procedimiento por documentar.
- **Hardening / pentest:** no se ha realizado una revisión de seguridad externa formal *(pendiente)*.
- **Secretos y accesos:** gestión de secretos en Supabase/Vercel; falta documentar rotación y principio de mínimo privilegio.

> Nota honesta: Validus aplica medidas de seguridad y privacidad razonables para su etapa (RLS, TLS, hashing de RUT, IP truncada, consentimiento revocable), pero **no** tiene certificaciones de seguridad ni una auditoría externa a la fecha. Las brechas anteriores son explícitas y forman parte del roadmap.
