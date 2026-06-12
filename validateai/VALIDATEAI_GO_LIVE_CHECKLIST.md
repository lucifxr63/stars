# Validus — Go-Live Checklist
**Fecha de emisión:** 2026-05-25  
**Auditor:** Sistema de Ingeniería Validus  
**Estado general:** 🟡 READY WITH CONDITIONS — 2 secretos de producción pendientes de configurar

---

## 1. Estado de los 6 Disyuntores (Circuit Breakers)

Todos los disyuntores usan `withCircuitBreaker<T>(sourceName, fn, timeoutMs)` con `Promise.race` contra un `setTimeout`. Si la fuente falla o supera el timeout, retorna `{ ok: false, reason }` sin propagar la excepción.

| # | Fuente | Timeout | Fail-safe | Estado |
|---|---|---|---|---|
| 1 | `knowledge_base` (pgvector RAG) | 10 s | Omite contexto regulatorio; continúa sin RAG | ✅ Operativo |
| 2 | `sii-proxy` (tributario) | 10 s | `[SII] Sin datos` en contexto Claude | ✅ Operativo |
| 3 | `inapi-fetch` (marcas) | 10 s | `[INAPI] Sin datos` en contexto Claude | ✅ Operativo |
| 4 | `fintoc` (Open Banking) | 10 s | `[Fintoc] Sin datos` en contexto Claude | ✅ Operativo (requiere secretos) |
| 5 | `pjud` (judicial) | 10 s | `[PJUD] Sin datos` en contexto Claude | ✅ Operativo (requiere secretos) |
| 6 | `cmf-best-fetch` (BEST CMF) | **15 s** | `[CMF BEST] Sin datos` en contexto Claude | ✅ Operativo (requiere `CMF_BEST_KEY`) |

**Comportamiento de fail-safe confirmado (Sprint 7 + Auditoría):**  
El system prompt de Claude ahora contiene regla explícita:
> *"Si una sección dice '[fuente] Sin datos — fuente no disponible', esa AUSENCIA no implica score 0. Score 0 se reserva ÚNICAMENTE para riesgos confirmados y verificados."*

Corrección aplicada en esta auditoría — antes de esta revisión, el system prompt no tenía esta garantía explícita. **GAP CERRADO.**

---

## 2. Validación de Schema de Salida Claude

### Antes de esta auditoría
`callClaude` hacía `JSON.parse(match[0])` sin verificación estructural. Un campo malformado o ausente causaba crash silencioso en el frontend.

### Después (implementado en esta auditoría)
Se agregó `validateDueDiligenceSchema(parsed)` que verifica:

| Campo | Validación | Acción si falla |
|---|---|---|
| `total` | `number`, rango 0-100 | `HTTP 500` con mensaje descriptivo |
| `dimensions.{financiero,legal,mercado,equipo,traccion}` | Objeto con `score: number` y `gaps: string[]` | `HTTP 500` |
| `investorReadiness` | enum `not_ready\|early\|developing\|ready` | `HTTP 500` |
| `topGaps` | `array` | `HTTP 500` |
| `verdict_summary` | `string` ≥ 20 chars | `HTTP 500` |

**GAP CERRADO.** El schema ahora falla rápido con mensajes de error específicos en lugar de propagar datos malformados al frontend.

---

## 3. Auditoría de Seguridad — OWASP LLM Top 10 (2025)

### LLM01 — Prompt Injection

| Vector | Mitigación | Estado |
|---|---|---|
| `anonymize-idea`: texto del fundador → Claude Haiku | 12 regex patterns + truncación 4.000 chars + bloqueo si >3 flags | ✅ Implementado (Sprint 6) |
| `assemble-mega-prompt`: campos de validación → Claude Sonnet | Los campos van al **USER turn** (no al system turn). Claude Sonnet tiene alta resistencia nativa a override de system prompt en el user turn. **Riesgo residual bajo pero presente.** | 🟡 Aceptable / pendiente hardening nivel 2 |
| Datos de CMF BEST → Claude | Fuente externa confiable (API oficial CMF), no controlada por el usuario. Sin riesgo de inyección. | ✅ Sin riesgo |

**Riesgo residual LLM01:** Un usuario malintencionado puede escribir `"ignore previous instructions"` en `idea_description`. Este texto llega al prompt de Claude en el USER turn. La consecuencia práctica es baja (Claude es resistente a este vector en el user turn cuando el system prompt está bien definido) pero no es cero. **Recomendación:** Sprint 8 — aplicar `sanitizeInput` de `anonymize-idea` también al construir el mega-prompt.

### LLM03 — Model Denial of Service

| Mecanismo | Límite | Scope | Estado |
|---|---|---|---|
| `anonymize-idea` rate limit | 5 requests/día por usuario | Por `user_id` en `training_data` | ✅ |
| `ai-validate` rate limit | Configurable por tier (mensual) | Por `user_id` | ✅ |
| `assemble-mega-prompt` rate limit | **Sin rate limit implementado** | N/A | ❌ GAP ABIERTO |
| Claude `max_tokens` | 1.200 tokens output (fijo) | Por request | ✅ |
| BEST API rate limit | 1.000 req/hora (del proveedor) | Por `CMF_BEST_KEY` | ✅ (externo) |

**GAP ABIERTO — LLM03:** `assemble-mega-prompt` no tiene rate limiting propio. Un usuario con sesión válida puede llamarlo repetidamente, consumiendo tokens de Claude Sonnet (~$0.015/request × llamadas ilimitadas). **Recomendación:** Implementar límite de 3 due diligences/día para tier Free, 10/día para Pro, antes del Go-Live.

### LLM06 — Sensitive Information Disclosure

| Riesgo | Estado |
|---|---|
| `anonymize-idea` no expone `flags` al cliente | ✅ Solo logea en server (`console.warn`) |
| `anonymize-idea` no expone patrones de detección | ✅ El cliente recibe solo `error: 'input_rejected'` |
| `cmf-best-fetch` no expone la `CMF_BEST_KEY` al cliente | ✅ Key solo en env Deno |
| `SUPABASE_SERVICE_ROLE_KEY` en headers de `callEdgeFunction` | 🟡 Se usa como Auth al llamar funciones internas. Es el patrón estándar de Supabase server-to-server pero implica que si una edge function loguea sus headers, expone el service key en los logs. Los logs de Supabase están protegidos por auth de admin. Riesgo bajo. |
| El `idea_description` del usuario no se loguea completo | ✅ Solo se loguea el `validation_id` |

---

## 4. Configuración de Secretos de Producción

### Estado actual de secretos

| Secret | `.env.local` | Supabase Secrets (prod) | Funciones que lo usan |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Configurado | Debe estar en prod | `ai-validate`, `assemble-mega-prompt`, `anonymize-idea` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Auto-inyectado por Supabase | Todas |
| `OPENAI_API_KEY` | ✅ | Debe estar en prod | `assemble-mega-prompt` (embeddings) |
| `SII_APIGATEWAY_KEY` | ✅ | Debe estar en prod | `sii-proxy` |
| `CMF_KEY` (SBIF legacy) | ✅ | Debe estar en prod | `sync-economic-data` |
| `CMF_BEST_KEY` | ✅ Configurado local | **⚠️ PENDIENTE** en prod | `cmf-best-fetch` |
| `FINTOC_SECRET_KEY` | ❌ No configurado | **⚠️ PENDIENTE** | `fintoc-link` |
| `FINTOC_WEBHOOK_SECRET` | ❌ No configurado | **⚠️ PENDIENTE** | `fintoc-webhook` |

### Protocolo de carga de secretos FINTOC (staging → prod)

```bash
# 1. STAGING — desplegar sin JWT verification para testing HMAC
supabase functions deploy fintoc-webhook --no-verify-jwt

# 2. Generar test payload y verificar firma HMAC-SHA256
# El webhook secret debe coincidir con el configurado en el dashboard de Fintoc
node -e "
const crypto = require('crypto');
const secret = 'TU_FINTOC_WEBHOOK_SECRET';
const body = JSON.stringify({ type: 'new_movements', data: { metadata: { validation_id: 'test', user_id: 'test' } } });
const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
console.log('X-Fintoc-Signature:', sig);
"

# 3. Test con curl
curl -X POST https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/fintoc-webhook \
  -H "Content-Type: application/json" \
  -H "X-Fintoc-Signature: <sig_del_paso_2>" \
  -d '{"type":"new_movements","data":{"metadata":{"validation_id":"test","user_id":"test"}}}'
# Respuesta esperada: {"received":true}

# 4. Si HMAC OK → cargar en Supabase Secrets
supabase secrets set FINTOC_SECRET_KEY=<key_del_dashboard_fintoc>
supabase secrets set FINTOC_WEBHOOK_SECRET=<secret_del_dashboard_fintoc>
supabase secrets set CMF_BEST_KEY=<key_de_apibest.cmfchile.cl>

# 5. Re-deploy con JWT verification activo
supabase functions deploy fintoc-webhook
supabase functions deploy fintoc-link
supabase functions deploy cmf-best-fetch
```

---

## 5. Plan de Despliegue Progresivo — Beta 50 usuarios

El riesgo principal en Go-Live es de **costo por tokens de Claude** (no de disponibilidad, ya cubierta por circuit breakers). La estrategia usa gates por tier para controlar el volumen de due diligences generados.

### Fase 1: Semana 1 — Beta Cerrada (0-10 usuarios)

**Configuración inicial:**
- Activar solo `cmf-best-fetch` + `inapi-fetch` + `sii-proxy` (fuentes con menor latencia)
- **Fintoc y PJUD:** mantenidos en modo `pending` hasta validar HMAC en staging
- `assemble-mega-prompt` habilitado solo para tier `admin` (tú + testers internos)
- Target: 2-3 due diligences reales → validar que `DueDiligenceScore` renderiza correctamente

**Métricas de éxito Fase 1:**
```
✓ 0 crashes en DueDiligenceScoreCard (schema validator cumple su rol)
✓ CMF BEST data aparece en al menos 80% de los reports chilenos
✓ Circuit breaker abre y cierra correctamente en al menos 1 fuente
✓ Latencia total assemble-mega-prompt < 35 segundos (promedio)
```

### Fase 2: Semana 2 — Beta Ampliada (10-25 usuarios)

**Configuración:**
- Abrir tier `pro` para due diligence
- Activar Fintoc en producción si test HMAC pasó en Fase 1
- Implementar rate limit de `assemble-mega-prompt`: 3/día (free), 10/día (pro)
- Monitorear `data_warnings` en Supabase → Si SII falla >30% del tiempo, revisar `SII_APIGATEWAY_KEY`

**Gate de avance:** Costo real/due diligence < $0.025 USD (Claude + OpenAI embeddings combinados)

### Fase 3: Semanas 3-4 — Apertura General (25-50 usuarios)

**Configuración:**
- Tier `free` puede generar 1 due diligence/semana (no 0 — el freemium necesita mostrar valor)
- Activar PJUD si el contrato con el proveedor de datos judiciales está firmado
- Configurar alertas de costo: si spend mensual Claude Sonnet > $50 USD → revisar tier distribution
- Publicar en ecosistema: StartupChile, Corfo Seed community, ASECH

**Presupuesto estimado para 50 usuarios activos (1 due diligence/semana por usuario):**
```
50 usuarios × 4 semanas × 1 DD/semana = 200 due diligences/mes
Claude Sonnet input/output: ~$0.012/DD
OpenAI embeddings (cache + RAG): ~$0.002/DD
BEST API: $0 (incluido en el plan)
SII Gateway: $0 (incluido hasta cuota)
Total estimado: ~$2.80 USD/mes → costo marginal seguro para Beta
```

---

## 6. Resumen Ejecutivo — Decisión Go-Live

| Criterio | Estado | Notas |
|---|---|---|
| 6 circuit breakers operativos | ✅ | Todos con fail-safe explícito |
| Schema validation de Claude output | ✅ | Implementado en esta auditoría |
| "No disponible" vs "Cero" en Claude | ✅ | System prompt actualizado en esta auditoría |
| LLM01 Prompt Injection (anonymize-idea) | ✅ | 12 patterns, Sprint 6 |
| LLM01 Prompt Injection (assemble-mega-prompt) | 🟡 | User turn — riesgo bajo, Sprint 8 |
| LLM03 Rate limiting assemble-mega-prompt | ❌ | **GAP ABIERTO — implementar antes de Fase 2** |
| LLM06 No data leakage | ✅ | Keys y flags no expuestos al cliente |
| CMF BEST Key en producción | ⚠️ | Pendiente `supabase secrets set CMF_BEST_KEY=...` |
| Fintoc en producción | ⚠️ | Pendiente validación HMAC en staging |
| PJUD en producción | ⚠️ | Pendiente contrato con proveedor |

### Decisión recomendada

**✅ PROCEDER con Fase 1 (10 usuarios beta).**  
**❌ NO PROCEDER con apertura general hasta:**
1. Implementar rate limiting en `assemble-mega-prompt` (evita exposición de costo ilimitado)
2. Cargar `CMF_BEST_KEY` en Supabase Secrets de producción
3. Validar HMAC de Fintoc en staging

---

*Documento generado por el sistema de ingeniería Validus — auditoría Sprint 7 + Go-Live.*
