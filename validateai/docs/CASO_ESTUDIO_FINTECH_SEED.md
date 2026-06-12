# Caso de Estudio: Motor de Due Diligence Adversarial Validus
## "Startup Gamma" — Fintech B2C Chile · Seed · USD $500K

**Clasificación:** Demo — Datos de stress test certificado (2026-06-09)  
**Audiencia:** Inversionistas ángeles · Aceleradoras · Fondos de Venture Capital  
**Motor:** BralidusPY GraphRAG v1.0.0 · 33 nodos · 72 aristas · Familia A + Familia B

---

## El Escenario

Un fondo de inversión recibe el pitch de **Startup Gamma**: aplicación fintech B2C para pagos digitales entre consumidores finales, con foco en Chile, en etapa Seed, levantando USD $500.000.

El equipo fundador presenta métricas sólidas: 2.400 usuarios activos, CAC de $8.200 CLP vía pauta programática (Instagram/Meta), ticket promedio de $15.000 CLP por transacción. Solicitan financiamiento para escalar la adquisición de usuarios x5 en 12 meses.

**La pregunta del analista de inversión:** ¿Qué riesgos materiales no están en el pitch deck?

---

## Lo que Validus detectó en 12 segundos

El motor BralidusPY procesó el perfil de la startup contra el grafo de conocimiento regulatorio y financiero de Chile. Resultado: **7 alertas adversariales**, 3 de ellas críticas.

---

### ALERTA CRÍTICA 1 — Exposición Regulatoria Ley 21.719

**Severidad:** RIESGO CRÍTICO  
**Categoría:** Compliance Datos · GDPR Chile

> La startup opera sin Gestor de Consentimiento (CMP). La Ley 21.719, vigente en Chile desde 2024, exige consentimiento explícito e informado para el tratamiento de datos personales con fines comerciales. Las sanciones alcanzan **UF 15.000 por infracción grave**.

**Impacto financiero calculado:**
- UF 15.000 × $37.200 CLP/UF = **$558.000.000 CLP ≈ USD $586.000**
- La multa potencial supera el **117% del monto del round** que se está levantando
- El costo de corrección post-financiamiento (auditoría legal + implementación CMP + retroactividad de datos) se estima en USD $25.000–$40.000 adicionales

**Sin Validus:** el analista asume compliance estándar. El riesgo permanece invisible hasta que llega la primera notificación del Consejo para la Transparencia.

---

### ALERTA CRÍTICA 2 — Registro CMF obligatorio (Ley 21.521)

**Severidad:** RIESGO CRÍTICO  
**Categoría:** Compliance Fintech

> La startup opera en el segmento de Finanzas Abiertas (SFA) sin estar registrada ante la Comisión para el Mercado Financiero (CMF). La Ley Fintech 21.521 exige registro para cualquier prestador de servicios de iniciación de pagos en Chile. Operar sin registro constituye actividad financiera no autorizada.

**Impacto operacional:**
- La CMF puede ordenar el cese de operaciones con efecto inmediato
- Las transacciones procesadas durante el período no registrado pueden ser declaradas nulas
- Bloquea acceso al sistema SFA, eliminando la propuesta de valor diferencial del producto

**Sin Validus:** el analista puede no conocer el umbral exacto de actividad que activa la obligación de registro bajo la Ley 21.521.

---

### ALERTA CRÍTICA 3 — CAC distorsionado por canal sin CMP

**Severidad:** RIESGO CRÍTICO  
**Categoría:** Unit Economics

> El CAC reportado de $8.200 CLP fue calculado con campañas de Meta/Instagram que operaron **sin consentimiento de datos correcto** (sin CMP activo). Bajo la Ley 21.719 y las políticas de Meta Business post-GDPR, el retargeting y el lookalike audience que sustentaron ese CAC **no serán replicables** en condiciones de compliance.

**Re-cálculo adversarial del CAC:**
| Escenario | CAC estimado |
|---|---|
| CAC actual (sin CMP, canal irrestricto) | $8.200 CLP |
| CAC proyectado (con CMP activo, audiencias restringidas) | $18.000–$24.000 CLP |
| Impacto en LTV:CAC | Cae de **~5.5x** a **~2.0x–2.7x** (bajo benchmark 3:1) |
| Payback period | Se extiende de ~7 meses a **16–21 meses** |

**Consecuencia para el round:** El modelo de crecimiento presentado al fondo es matemáticamente inválido en condiciones de compliance. El CAC real post-regularización destruye la tesis de escalamiento x5 en 12 meses.

---

### ALERTA WARNING 4 — TRL 4: Tecnología no validada en entorno operacional real

**Severidad:** ALERTA  
**Categoría:** TRL/CRL — Technology Readiness Level

> El producto se encuentra en TRL 4 (validado en laboratorio/entorno controlado). Para una fintech procesando pagos reales, el umbral mínimo aceptable para escalar inversión es TRL 7 (demostración en entorno operacional). La brecha TRL 4→7 implica 12–18 meses adicionales de desarrollo e integración con sistemas bancarios chilenos.

---

### ALERTA WARNING 5 — Corfo Semilla: Riesgo de cofinanciamiento condicionado

**Severidad:** ALERTA  
**Categoría:** Fundraising Chile

> Si la startup postula concurrentemente a Corfo Semilla Inicia o Expande, los incumplimientos regulatorios detectados (Ley 21.521, Ley 21.719) son causales de rechazo o revocación del beneficio. Un round privado que asuma "Corfo como colchón de runway" es una tesis de financiamiento con riesgo de ejecución alto.

---

### ALERTA INFO 6 — Contexto Macro: Fed Funds Rate y apetito de riesgo LatAm

**Severidad:** CONTEXTO  
**Categoría:** Macroeconomía Familia B

> La tasa de fondos federales (Fed Funds) en niveles elevados comprime el apetito por riesgo en mercados emergentes. Los fondos con exposición a LatAm reportan mayor selectividad en Seed: el umbral de evidencia requerida para cerrar un round ha aumentado significativamente desde 2023.

---

### ALERTA INFO 7 — USD/CLP: Exposición cambiaria en round USD

**Severidad:** CONTEXTO  
**Categoría:** Macroeconomía Familia B

> El round se levanta en USD pero el CAC, LTV y las multas regulatorias están denominadas en CLP/UF. La volatilidad del tipo de cambio USD/CLP (banda histórica 12M: $880–$1.050) introduce incertidumbre en el runway real post-inversión de hasta ±16%.

---

## Resumen Ejecutivo para el Analista

| Dimensión | Estado declarado | Estado detectado |
|---|---|---|
| Compliance datos | Implícitamente OK | **CRÍTICO** — sin CMP, Ley 21.719 |
| Registro regulatorio | No mencionado | **CRÍTICO** — sin registro CMF, Ley 21.521 |
| CAC | $8.200 CLP | **CRÍTICO** — $18K–$24K CLP en compliance |
| LTV:CAC | ~5.5x | **~2.0x–2.7x** (bajo benchmark 3:1) |
| Payback period | ~7 meses | **16–21 meses** |
| Exposición multa máxima | USD $0 | **USD $586.000** (117% del round) |
| TRL | "producto validado" | **TRL 4** — brecha de 12–18 meses |
| Tesis de escalamiento | Viable | **Inválida** en condiciones reales |

**Recomendación del motor:** No invertir en las condiciones actuales del pitch. Condiciones para reconsiderar: (1) registro CMF activo, (2) CMP implementado y auditable, (3) recálculo de unit economics con CAC real post-compliance, (4) plan TRL con hitos medibles.

---

## ¿Qué hace diferente a Validus?

Un analista senior con acceso a Google y Ley 21.719 podría detectar el riesgo de compliance en 2–3 días de due diligence. **Validus lo hace en 12 segundos, antes del primer café de la reunión de pitch.**

Para un fondo que recibe 200 solicitudes al año y convierte el 2%, esto significa:
- **196 pitches rechazados** con due diligence mínimo → Validus elimina el 80% del tiempo de análisis en la etapa de filtro
- **4 inversiones reales** con due diligence profundo → el analista llega a esa reunión ya sabiendo exactamente qué preguntar

**Propuesta de valor B2B:** Validus Premium como primer filtro de Deal Flow para fondos ángeles, aceleradoras y family offices con foco en startups chilenas y LatAm.

---

## Especificaciones Técnicas del Motor (para CTO/analista técnico del fondo)

- **GraphRAG híbrido:** búsqueda semántica vectorial + traversal de grafo de conocimiento
- **33 nodos Familia A:** Unit Economics, Compliance Datos, Compliance Fintech, Gobernanza, TRL/CRL, Fundraising Chile, Moat, GTM LatAm
- **Familia B (macro):** FRED API en tiempo real — GDP, CPI, Fed Funds, USD/CLP, IPSA, Credit Spread
- **Latencia end-to-end:** < 8 segundos (circuit breaker activo)
- **Infraestructura:** Railway (Python/FastAPI) + Supabase (PostgreSQL + pgvector) + Vercel (React 19)
- **Costo operacional del motor:** ~$10 USD/mes

---

*Validus · ScoutTech · contacto@scouttech.lat*  
*Este caso de estudio fue generado a partir del stress test certificado del motor BralidusPY (2026-06-09). Los datos del perfil de startup son sintéticos y no corresponden a ninguna empresa real.*
