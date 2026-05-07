# ESTADO_MVP.md — FacturaIA
**Reporte Técnico Post-Sprint | DataShield SpA**
Fecha: 2026-05-06

---

## ✅ Completado por Sprint

### Sprint 1: Arquitectura Base y Cumplimiento Normativo
| Tarea | Estado | Archivos |
|-------|--------|---------|
| Migraciones DB (companies, invoices, risk_assessments) | ✅ | `supabase/migrations/001_initial_schema.sql` |
| RLS estricto por PYME | ✅ | `supabase/migrations/002_rls_policies.sql` |
| Audit Logs CMF + gran_empresa_ruts | ✅ | `supabase/migrations/003_audit_logs.sql` |
| Auth (Login.tsx + AuthCallback.tsx) | ✅ | `src/app/routes/Login.tsx`, `AuthCallback.tsx` |
| Auth Store (Zustand) | ✅ | `src/store/authStore.ts` |
| Database Types (TypeScript) | ✅ | `src/lib/database.types.ts` |

### Sprint 2: Motor de Riesgo IA "SII-Simulated"
| Tarea | Estado | Archivos |
|-------|--------|---------|
| Edge Function `sii-risk-evaluator` | ✅ | `supabase/functions/sii-risk-evaluator/index.ts` |
| Integración Claude (claude-haiku-4-5) | ✅ | Dentro de la Edge Function |
| Lógica aprobación automática Gran Empresa | ✅ | Dentro de la Edge Function |
| Hook `useRiskEvaluator` | ✅ | `src/hooks/useRiskEvaluator.ts` |

### Sprint 3: Dashboard y Flujo Financiero
| Tarea | Estado | Archivos |
|-------|--------|---------|
| Dashboard.tsx con onboarding empresa | ✅ | `src/app/routes/Dashboard.tsx` |
| Wizard 4 pasos (Upload→IA→Oferta→Confirmado) | ✅ | `src/components/wizard/FacturaWizard.tsx` |
| Cálculo transparente 1.5% flat | ✅ | `src/lib/utils.ts` → `calcularLiquidez()` |
| Admin.tsx con CAC, LTV, NPL, Distribución Riesgo | ✅ | `src/app/routes/Admin.tsx` |
| Panel de cumplimiento normativo | ✅ | Dentro de Admin.tsx |

### Sprint 4: Tracción y LOIs
| Tarea | Estado | Archivos |
|-------|--------|---------|
| Landing.tsx hiper-optimizada | ✅ | `src/app/routes/Landing.tsx` |
| LOI Digital integrado (modal) | ✅ | Dentro de Landing.tsx → `LOIModal` |
| Tabla `loi_submissions` Supabase | ✅ | `supabase/migrations/004_loi_submissions.sql` |
| PostHog Analytics (lazy init) | ✅ | `src/hooks/useAnalytics.ts` |
| Comparativa precios vs factoring tradicional | ✅ | Dentro de Landing.tsx |

---

## ⚠️ Deuda Técnica Identificada

### Crítica (bloquea producción real)

1. **Conexión SII Real**: El motor actual simula la evaluación tributaria. Para producción necesita:
   - Integración con API SII (`/rcv`) para validar facturas en tiempo real
   - Certificado digital para firma electrónica (resolución SII)
   - Proveedor: **Acepta** o **Transbankcer** (APIs homologadas SII)

2. **KYC / AML**: La Ley Fintec exige identificación del cliente. Pendiente:
   - Integración **Fintoc** (open banking Chile) para verificación bancaria
   - Validación de identidad con documento (proveedor: **Truora** o **Identy**)
   - Proceso SAR/ROS para clientes sobre umbral ($800M CLP/año)

3. **Pasarela de Pagos / Desembolso Real**: La transferencia simulada en el MVP requiere:
   - Cuenta corriente bancaria corporativa (banco nacional)
   - Integración **Fintoc Transfer API** o **Transbank Pago a Cuenta**
   - Segregación de fondos (cuenta cliente vs cuenta operacional) — requisito CMF

4. **Registro CMF**: Pre-registro como Plataforma de Financiamiento Colectivo (PFC) bajo Ley 21.521 (Fintec). Timeline estimado: 6-12 meses.

### Alta (impacta experiencia en producción)

5. **Upload XML SII**: El MVP solo acepta ingreso manual. Para v1.1:
   - Parser XML para facturas electrónicas formato SII (DTE — Documento Tributario Electrónico)
   - Extracción automática de folio, montos, RUTs desde XML
   - Storage seguro en Supabase con cifrado AES-256

6. **Notificaciones**: El PYME no recibe confirmación por email/SMS.
   - Integrar **SendGrid** o **Resend** para emails transaccionales
   - Implementar webhooks de Supabase para triggers automáticos

7. **Tests automatizados**: Cero cobertura de tests en el MVP.
   - Unit tests para `useRiskEvaluator` y `calcularLiquidez`
   - Integration tests para la Edge Function con Deno Test
   - E2E con Playwright para el wizard de 4 pasos

8. **Rate Limiting**: La Edge Function no tiene protección contra abuso.
   - Implementar rate limiting con Supabase Edge Runtime
   - Límite sugerido: 10 evaluaciones/hora por usuario

### Media (mejoras para escala)

9. **Caché de Gran Empresa RUTs**: La tabla `gran_empresa_ruts` se consulta en cada evaluación.
   - Implementar caché Redis/Upstash en la Edge Function (TTL: 1 hora)

10. **Score Model v2**: El modelo actual es basado en reglas + LLM. Para escalar:
    - Dataset histórico de morosidad por sector en Chile (SII publica esto)
    - Fine-tuning o embeddings para mejorar precisión del `ai_score`

11. **Dashboard Admin Real-time**: Los datos del Admin son simulados + queries básicos.
    - Implementar Supabase Realtime subscriptions
    - Materializar vistas de métricas con `pg_cron` cada hora

---

## 🚀 Próximos Pasos — Hoja de Ruta

### Semana 1-2: Validación con Design Partners
- [ ] Desplegar en Vercel (frontend) + Supabase (backend)
- [ ] Ejecutar `supabase db push` para aplicar las 4 migraciones
- [ ] Configurar variable `ANTHROPIC_API_KEY` en Supabase Secrets
- [ ] Activar los 10 primeros LOIs firmados
- [ ] Procesar 3 facturas reales en modo beta (manual interno)

### Semana 3-4: Integración Real
- [ ] Contratar API Fintoc para open banking
- [ ] Abrir cuenta Banco Estado empresarial para desembolsos
- [ ] Implementar parser XML DTE (facturas electrónicas SII)
- [ ] Integrar Resend para emails transaccionales

### Mes 2: Cumplimiento CMF
- [ ] Contrato con estudio jurídico especializado en Fintec
- [ ] Pre-registro CMF como PFC
- [ ] Auditoría externa de seguridad (penetration testing)
- [ ] Implementar KYC básico con Truora

### Mes 3+: Escalamiento
- [ ] Fintoc Transfer API para desembolsos automáticos
- [ ] Score model v2 con datos históricos SII
- [ ] App móvil (React Native o PWA)
- [ ] Integración ERP: Bsale, Siigo, Nubox

---

## 📐 Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Vite + Tailwind CSS 4)                │
│  Vercel Edge Network                                         │
│                                                             │
│  /              → Landing.tsx (LOI + Marketing)             │
│  /login         → Login.tsx (Supabase Auth)                 │
│  /dashboard     → Dashboard.tsx + FacturaWizard             │
│  /admin         → Admin.tsx (Mesa Directiva)                │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS / Supabase JS SDK
┌─────────────────▼───────────────────────────────────────────┐
│  Supabase (Backend as a Service)                            │
│                                                             │
│  Auth          → JWT + OAuth (Google)                        │
│  Database      → PostgreSQL + RLS                            │
│  Storage       → Cifrado AES-256 (XMLs facturas)            │
│  Edge Functions → sii-risk-evaluator (Deno)                 │
│                     └── Claude API (Haiku) → Tax Score      │
│  Audit         → audit_logs (append-only)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Estado de Seguridad

| Capa | Estado |
|------|--------|
| Autenticación | ✅ Supabase Auth + JWT |
| Autorización | ✅ RLS por `user_id` en todas las tablas |
| Cifrado en tránsito | ✅ TLS 1.3 (Supabase/Vercel) |
| Cifrado en reposo | ✅ AES-256 (Supabase) |
| Audit trail CMF | ✅ `audit_logs` append-only |
| Protección CSRF | ✅ SameSite cookies (Supabase Auth) |
| XSS Protection | ✅ React DOM escaping por defecto |
| SQL Injection | ✅ Supabase SDK (queries parametrizadas) |
| Rate Limiting Edge Function | ❌ Pendiente |
| KYC/AML | ❌ Pendiente (Fintoc) |

---

*Documento generado automáticamente al finalizar Sprint 4 del MVP de FacturaIA.*
*Próxima revisión: tras integración real con SII y Fintoc.*
