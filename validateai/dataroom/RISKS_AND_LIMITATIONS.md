# Validus — Riesgos y Limitaciones

> **Estado:** Borrador inicial · 2026-06-29
> Evaluación honesta de riesgos por categoría. Impacto y probabilidad son cualitativos (Alto/Medio/Bajo) y a criterio del equipo; revisar periódicamente.

**Leyenda de estado:** ✅ Mitigado · 🟡 Parcial · 🔴 Pendiente

| # | Categoría | Riesgo | Impacto | Prob. | Mitigación | Estado |
|---|-----------|--------|---------|-------|------------|--------|
| 1 | Producto | Generación síncrona bloquea la UI en prompts largos | Medio | Media | Migrar a generación asíncrona / colas | 🟡 Parcial |
| 2 | Producto | Trust Layer (fuente/supuesto/confianza por sección) incompleto | Medio | Media | Estandarizar indicadores; objetivo de roadmap | 🟡 Parcial |
| 3 | IA | Alucinación / afirmaciones imprecisas del modelo | Alto | Media | Estructura de prompts, datos con procedencia, etiquetado, supervisión humana | 🟡 Parcial |
| 4 | IA | Usuario interpreta el output como verdad/garantía | Alto | Media | Disclaimers, Política de Uso de IA, lenguaje "no es asesoría" | ✅ Mitigado |
| 5 | Datos | Dependencia de fuentes externas (APIs públicas, SerpApi) y de credenciales | Medio | Media | Degradación honesta: si no hay fuente, se etiqueta "no disponible" (no se inventa) | ✅ Mitigado |
| 6 | Datos | Calidad del input del usuario no verificada | Medio | Alta | Comunicar que el análisis depende del input; supuestos explícitos | 🟡 Parcial |
| 7 | Legal | Falta reconciliar sub-encargados en la política (menciona Stripe; pago real LemonSqueezy) | Medio | Alta | Actualizar política de privacidad y listado de sub-encargados | 🔴 Pendiente |
| 8 | Legal | Sin auditoría legal/contable formal del data room | Medio | Alta | Revisión con asesores antes de uso institucional | 🔴 Pendiente |
| 9 | Comercial | Pre-revenue: disposición a pagar y conversión no validadas | Alto | Alta | Pilotos, reactivar cobro, medir conversión | 🔴 Pendiente |
| 10 | Comercial | Cobro en pausa (pasarela dormante) → no se mide conversión real | Alto | Alta | Reactivar LemonSqueezy / pasarela; mientras, waitlist Early Bird | 🟡 Parcial |
| 11 | Mercado | Sustituto fuerte: IA generativa genérica ("uso ChatGPT gratis") | Alto | Alta | Diferenciar por metodología, datos locales y trazabilidad; educación de mercado | 🟡 Parcial |
| 12 | Mercado | Bajas barreras de entrada en software | Medio | Media | Defensa por motor de datos locales (Bralidus), marca y distribución | 🟡 Parcial |
| 13 | Seguridad | Sin certificaciones (ISO/SOC2) ni pentest externo | Medio | Media | RLS, TLS, hashing RUT, IP truncada; auditoría externa a futuro | 🟡 Parcial |
| 14 | Seguridad | Backups/DRP y respuesta a incidentes sin política propia documentada | Medio | Media | Formalizar política de backups y procedimiento de incidentes | 🔴 Pendiente |
| 15 | Escalabilidad | Costo variable de IA sensible a volumen y tipo de cambio CLP/USD | Medio | Media | Caché semántica, control de cuota por tier, colchón de FX en pricing | 🟡 Parcial |
| 16 | Escalabilidad | Cargas no paginadas en panel admin (deuda técnica) | Bajo | Media | Paginación (parcialmente implementada) | 🟡 Parcial |
| 17 | Marca | Incoherencia interna `validateai` (repo/keys) vs marca pública `Validus` | Bajo | Alta | Renombre por capas con migración segura (fase posterior) | 🔴 Pendiente |
| 18 | Marca | Registro de marca "Validus" sin confirmar | Medio | Media | Verificar/registrar en INAPI antes de invertir en branding | 🔴 Pendiente |
| 19 | Due diligence | Faltan métricas SaaS reales y modelo financiero auditado | Alto | Alta | Medir post-revenue; modelo financiero con asesor | 🔴 Pendiente |
| 20 | Due diligence | Datos societarios completos (razón social, representante) por consolidar | Bajo | Media | Completar para versión definitiva del data room | 🔴 Pendiente |

## Limitaciones generales

- **Pre-revenue:** sin métricas de venta medidas; las cifras económicas son estimaciones a validar.
- **Etapa temprana:** el producto es un MVP funcional; varias capacidades (Trust Layer, integraciones reales, generación asíncrona) están en curso.
- **No es asesoría profesional:** los outputs son orientativos; las decisiones relevantes requieren validación independiente.
- **Este data room es un borrador inicial:** no sustituye revisión legal, contable ni de seguridad profesional.

> Pendiente: asignar responsable y fecha de revisión a cada riesgo 🔴/🟡 en la próxima iteración.
