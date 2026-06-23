# Cashflow — Anexo de Arquitectura (esquema `cashflow` en producción)

> Estado: **EN PRODUCCIÓN** · Proyecto Supabase compartido con Validus
> (`fcdhcntyvsydnvjwopfe`). Última actualización: 2026-06-23.

## 1. Aislamiento de esquema

Cashflow opera **íntegramente bajo el esquema `cashflow`**, aislado de `public`
(donde vive Validus). La única superficie compartida es `auth.users` (para SSO
futuro). El cliente Supabase fija `db.schema = 'cashflow'`
(`createClient<Database, 'cashflow'>`), de modo que `supabase.from('…')` resuelve
contra `cashflow.*` sin `.schema()` por llamada. Las migraciones de cashflow
**nunca** tocan `public`.

> ⚠️ El tracking de migraciones de este proyecto está roto (ver memoria del
> equipo). **Nunca** `supabase db push`. Aplicar cada migración aislada vía SQL
> Editor o Management API query endpoint (una transacción) y registrar la versión
> en `supabase_migrations.schema_migrations`.

## 2. Modelo de seguridad — Flat RLS

Regla rectora (de `context.md`): **prohibido JOIN/subconsultas en políticas RLS**
(presupuesto <50ms). Reconciliación adoptada en todo el esquema:

- Se **desnormaliza `owner_id` (= `auth.uid()`)** en *todas* las tablas
  tenant-scoped. La política es plana y sin JOIN:
  ```sql
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()))
  ```
- `tenant_id` / `account_id` se conservan solo para integridad relacional
  (FK + `ON DELETE CASCADE`), no para autorización.
- `owner_id` referencia `auth.users(id) ON DELETE CASCADE` → borrar el usuario
  central purga todas sus filas (cumple privacidad + permite teardown atómico).
- En cada `INSERT` el cliente inyecta `owner_id` desde la sesión (lo exige el
  `WITH CHECK`); omitirlo hace que Postgres rechace la operación (error 42501).

## 3. Inventario de tablas

**Núcleo PRD (flujo de caja genérico):**
`tenant` (`owner_id`, `default_tax_rate`, `weekly_alerts_enabled`) → `bank_account`
(`current_balance`, mantenido por trigger) → `transaction` (IN/OUT) ; `tenant` →
`invoice` (AR/AP, `status`, `source_system`, `due_date`). Auxiliares:
`profiles`, `recurring_transaction` (IN/OUT), `pdf_usage` (cuota Beta).

**Lente SaaS / control interno (migración `20260704000000`, vivo desde 2026-06-23):**
- `partner_contributions` — aportes de socios (premisa: préstamo a la empresa).
- `expense` — gastos con fuente de fondeo (`funded_by` COMPANY/PARTNER) + desglose
  neto / IVA / total.
- `revenue` — ingresos SaaS multimoneda (USD→CLP, comisión de pasarela). El KPI de
  caja es `net_income_clp`; bruto y comisión quedan como desglose.

**IVA configurable (sin 19% rígido):** `expense` y `revenue` llevan
`vat_status` (`AFECTO` | `EXENTO`) + `vat_amount` editable. La integración con SII
se calendariza para Fase 2.

## 4. Edge Functions (Deno, JSON puro)

`cashflow-invoices`, `cashflow-recurring`, `cashflow-parse-pdf` (IA, Claude),
`cashflow-tenant-settings`, `cashflow-weekly-cron` (dormante), y
`cashflow-analytics` — agregación mensual: `GET ?tenant_id&period=YYYY-MM` →
`{ metrics, breakdown }`. Cada función valida la sesión (`getUser`) y opera con el
JWT del usuario, de modo que la RLS acota los datos.

> **Deuda técnica:** `cashflow-analytics` calcula `initial_balance` agregando el
> histórico al vuelo. Refactor a snapshots `pg_cron` atado a volumen futuro — ver
> `Flujos/tech-debt-pgcron-snapshots.md`.

## 5. Certificación

`launch/integration-test-saas.mjs` certifica el pipeline del lente SaaS de punta a
punta (insert vía RLS, rechazo de `owner_id` ajeno, contrato JSON de
`cashflow-analytics`, aislamiento cross-tenant) bajo protocolo de **cero huella**
(crea usuarios temporales y los borra; el cascade purga sus filas). Verde a
2026-06-23. Frontend del lente: ruta `/saas` (`pages/SaasCashflow.tsx`).
