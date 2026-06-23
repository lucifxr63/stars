🛑 Filtro de Fricción: Vistas Temporales (Time Filters)
Vista Diaria: Altamente ruidosa. Los saldos saltan violentamente. Útil solo para el "micromanagement" de liquidez extrema (cuando quedan días de vida).

Vista Semanal: El punto dulce (Sweet Spot). Suaviza el ruido diario pero da suficiente precisión para saber en qué semana exacta del mes no habrá caja para pagar la nómina.

Vista Mensual: Fundamental para calcular el Runway a 6-12 meses y presentar a la junta directiva.

Decisión Directiva: Desarrollaremos los tres filtros, pero el default absoluto al hacer login será la Vista Semanal a 12 semanas (90 días). Esto ancla al usuario en la métrica operativa más accionable.

A continuación, te entrego el documento maestro estructurado. Cópialo exactamente como está y entrégaselo a Claude Code como CASHFLOW_PRD.md o añádelo al AI_CONTEXT.md actual. Este documento contiene directrices estrictas de arquitectura, contratos de API y reglas de negocio para que la IA no alucine y mantenga el alineamiento estratégico.

Markdown
# CASHFLOW_PRD.md - Producto de Flujo de Caja (MVP)

> **Contexto de IA (Claude Code):** Eres el ingeniero principal ejecutando el MVP de un nuevo SaaS independiente de gestión de flujo de caja para PYMEs y Startups.
> **Restricción Crítica de Infraestructura:** Este SaaS comparte el proyecto de Supabase con el producto "Validus". Por lo tanto, DEBES operar exclusivamente bajo un esquema de base de datos llamado `cashflow`. La única tabla compartida es `auth.users` (esquema `auth`) para habilitar un futuro Single Sign-On (SSO). NINGÚN dato de negocio de este producto debe mezclarse con el esquema `public` de Validus.

## 1. Reglas de Negocio Centrales y Resultados Esperados (KPIs)

* **Time-to-Value (TTV):** El usuario debe ver su *Runway* (meses de vida) y su *Burn Rate* en menos de 5 minutos desde el registro.
* **Modelo de Vencimientos Asimétrico (Motor de Proyección):**
    * **Cuentas por Pagar (A/P) Vencidas:** Se mueven automáticamente a la fecha de "Hoy" en el forecast (asume el peor escenario: quema de caja inmediata).
    * **Cuentas por Cobrar (A/R) Vencidas:** NO se suman al "Hoy". Quedan en el pasado y se agrupan en una UI llamada "Resolution Center" para que el usuario accione manualmente (Reprogramar, Marcar Incobrable, Pagado).
* **Vistas Temporales de UI (Filtros del Gráfico):**
    * El dashboard debe soportar agregación Diaria, Semanal y Mensual.
    * **Vista Default:** Semanal (Proyección a 12 semanas / 90 días).

## 2. Arquitectura de Base de Datos (Esquema: `cashflow`)

Implementar el siguiente modelo relacional utilizando Row Level Security (RLS) anclado al `tenant_id` derivado de `auth.users.id`.

```mermaid
erDiagram
    auth_users {
        uuid id PK
        string email
    }
    cashflow_tenant {
        uuid id PK
        string name
        uuid owner_id FK "References auth.users.id"
        timestamp created_at
    }
    cashflow_bank_account {
        uuid id PK
        uuid tenant_id FK
        string name
        string currency
        decimal current_balance
    }
    cashflow_transaction {
        uuid id PK
        uuid account_id FK
        date transaction_date
        decimal amount
        string type "IN / OUT"
        string category
    }
    cashflow_invoice {
        uuid id PK
        uuid tenant_id FK
        string type "AR (Cobrar) / AP (Pagar)"
        decimal total_amount
        string currency
        date issue_date
        date due_date
        string status "PENDING / PAID / CANCELLED"
        string source_system "MANUAL / SII / ODOO (Flag de escalabilidad)"
        string external_id "Nullable - ID externo"
    }

    auth_users ||--o{ cashflow_tenant : "Owns / SSO"
    cashflow_tenant ||--o{ cashflow_bank_account : "Has"
    cashflow_tenant ||--o{ cashflow_invoice : "Manages"
    cashflow_bank_account ||--o{ cashflow_transaction : "Contains"
3. Contrato Estricto de API (Supabase Edge Functions)
Para la Fase 1, la ingesta de facturas es estrictamente manual. Implementar la Edge Function create_invoice respetando exactamente este contrato JSON:

JSON
{
  "api_contract": {
    "endpoint": "POST /functions/v1/cashflow-invoices",
    "description": "Crea una nueva factura manual (Cuentas por Cobrar/Pagar).",
    "request_payload": {
      "tenant_id": "uuid-v4-string",
      "type": "AR",
      "total_amount": 1500000.00,
      "currency": "CLP",
      "issue_date": "YYYY-MM-DD",
      "due_date": "YYYY-MM-DD",
      "contact_name": "Nombre Cliente o Proveedor",
      "source_system": "MANUAL",
      "external_id": null
    },
    "response_success": {
      "status": 201,
      "data": {
        "id": "uuid-v4-string",
        "tenant_id": "uuid-v4-string",
        "type": "AR",
        "total_amount": 1500000.00,
        "status": "PENDING",
        "source_system": "MANUAL"
      }
    },
    "response_error": {
      "status": 400,
      "error_code": "INVALID_SOURCE_SYSTEM",
      "message": "En la Fase 1, el source_system solo puede ser 'MANUAL'."
    }
  }
}
4. Instrucciones de Implementación para el Agente (Claude)
Inicia creando el esquema cashflow y las migraciones SQL basadas en el diagrama Mermaid.

Aplica políticas RLS estrictas: un usuario solo puede leer/escribir en el cashflow_tenant donde su auth.users.id coincida con owner_id.

Desarrolla la Edge Function en Deno respetando el JSON provisto.

Desarrolla el componente UI del Dashboard asegurándote de usar una librería de gráficos (ej. Recharts) que acepte la agregación de datos por day, week (default) y month.

***

### ⚡ Siguientes Pasos

Con este documento, Claude Code tiene límites claros, no va a dañar la base de datos de tu producto principal (Validus) y sabe exactamente cómo modelar la proyección de las facturas vencidas.

Como Consultor Estratégico, mi siguiente pregunta es sobre el eslabón más débil de todo SaaS financiero en su inicio: **El Onboarding**. 

Cuando el usuario se registre, ¿vamos a exigirle que conecte su banco inmediatamente (