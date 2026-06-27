Como tu Consultor Estratégico, me encanta que estés anticipando este problema. Has tocado el talón de Aquiles de la mayoría de los SaaS financieros: obligar al usuario a hacer "micro-management" de su propia miseria (sus gastos).

Si obligamos a una PYME a ingresar su suscripción de AWS de $50 USD y el pago de la luz mensual como "facturas manuales", abandonarán la herramienta en el día 2. El "sangrado constante" (Burn Rate) necesita un Piloto Automático.

🛑 Filtro de Fricción: Estrategia para el Burn Rate Automático
Opción 1 (Ingreso Global Ciego): El usuario pone "Gasto $10,000 al mes en fijos" y el sistema resta $333 diarios en la proyección. Rechazado: Destruye la precisión del flujo de caja semanal. El pago de nómina ocurre un día específico y el arriendo otro, causando valles profundos en días específicos, no un desgaste lineal.

Opción 2 (Auto-generación de Facturas): Un cron job (Edge Function) que crea "Facturas AP" recurrentes cada mes. Rechazado: Ensucia la base de datos de facturas reales y confunde las métricas contables del usuario.

Decisión Directiva (El Piloto Automático de Proyección): Crearemos una entidad separada llamada Gastos Recurrentes (Recurring Expenses). No son facturas, son reglas matemáticas que el Frontend (projection.ts) leerá e inyectará "al vuelo" (on the fly) sobre el gráfico de proyección. Cero basura en la base de datos, 100% de precisión temporal.

Aquí tienes el archivo Markdown robustecido. Entrégale esto a Claude Code como CASHFLOW_PRD_PART_3.md para que ejecute la arquitectura, la API y la modificación del motor de proyección.

Markdown
# CASHFLOW_PRD_PART_3.md - Motor de Gastos Recurrentes (Burn Rate Autopilot)

> **Contexto de IA (Claude Code):** Eres el ingeniero principal. El MVP actual ya cuenta con base de datos, RLS plano (con `owner_id`), Edge Functions para facturas manuales y el motor de proyección `projection.ts`. 
> **Objetivo de este Sprint:** Implementar el "Burn Rate Autopilot" para evitar que el usuario deba cargar gastos fijos (nómina, arriendo, SaaS) como facturas manuales todos los meses. 

## 1. Reglas de Negocio Centrales

* **Separación de Conceptos:** Un "Gasto Recurrente" NO es una Factura (Invoice). Las facturas (A/R y A/P) son eventos únicos y reales. Los gastos recurrentes son reglas de proyección futura.
* **Inyección "On the Fly":** Los gastos recurrentes no generan transacciones ni facturas en la base de datos a futuro. Son interceptados por `projection.ts` en el Frontend, el cual evalúa si el gasto "cae" dentro del período a graficar y lo resta dinámicamente del balance proyectado.

## 2. Arquitectura de Base de Datos

Crear la siguiente tabla manteniendo la convención de RLS plano (desnormalizando `owner_id`) para consultas < 50ms.

```sql
-- Ejecutar como migración en el esquema `cashflow`
CREATE TABLE cashflow.recurring_expense (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES cashflow.tenant(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL, -- Para RLS Plano
    name VARCHAR(255) NOT NULL, -- Ej: "Nómina Mensual", "Arriendo", "Suscripción AWS"
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'CLP',
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
    next_date DATE NOT NULL, -- Fecha del próximo cobro
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS estricto
ALTER TABLE cashflow.recurring_expense ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own recurring expenses" 
    ON cashflow.recurring_expense 
    FOR ALL 
    USING (owner_id = auth.uid()) 
    WITH CHECK (owner_id = auth.uid());
3. Contrato Estricto de API (Supabase Edge Function)
Crear una nueva Edge Function (o actualizar un router central si usas Hono/Oak) para gestionar estos gastos.
Endpoint: POST /functions/v1/cashflow-recurring

JSON
{
  "api_contract": {
    "request_payload": {
      "tenant_id": "uuid-v4",
      "name": "Nómina Equipo Dev",
      "amount": 4500000.00,
      "currency": "CLP",
      "frequency": "MONTHLY",
      "next_date": "2026-06-30"
    },
    "response_success": {
      "status": 201,
      "data": { "id": "uuid", "name": "Nómina Equipo Dev", "next_date": "2026-06-30" }
    }
  }
}
4. Actualización del Motor Frontend (projection.ts)
Esta es la pieza más crítica. Modificar el algoritmo actual de projection.ts para que realice lo siguiente al momento de construir la curva de tiempo:

Fetch Inicial: Traer todas las Facturas (A/R, A/P) y todos los Gastos Recurrentes (recurring_expense) del usuario.

Generación de "Eventos Fantasma" (Phantom Events):

Iterar sobre cada recurring_expense.

En base a su frequency (ej. MONTHLY) y su next_date, proyectar eventos de gasto hacia el futuro hasta cubrir el horizonte de la gráfica (ej. 90 días).

Si next_date es 30-Jun, crear un evento fantasma para el 30-Jun, otro para el 30-Jul y otro para el 30-Ago.

Consolidación Cronológica:

Unir las Facturas Reales (respetando la regla asimétrica de facturas vencidas ya implementada) con estos "Eventos Fantasma" en un solo array ordenado por fecha.

Ejecutar la suma/resta acumulativa sobre el Saldo Bancario Actual para generar los puntos de la curva de Recharts.

5. UI: El Gestor de Piloto Automático
Agregar una pestaña o sección pequeña en el Dashboard llamada "Gastos Fijos / Burn Rate".

Mostrar una lista simple de los gastos recurrentes activos.

Añadir un botón para "Nuevo Gasto Fijo" que llame a la Edge Function.

***

### ⚡ Consulta Estratégica Final

Con este componente, el usuario carga su "Nómina" y su "Arriendo" una sola vez, y tu motor se encarga de estresar el flujo de caja a 90 días con una precisión letal.

Sin embargo, hay un borde de fricción (edge case) que debemos anticipar: **La Duplicación Táctica.**
Si el usuario conecta su banco en la Fase 2 (o sube un Excel ahora), el banco registrará el pago real de la nómina el día 30. Pero tu "Evento Fantasma" de la proyección también restará ese dinero el día 30.

Para este MVP, ¿le pedimos a Claude Code que asuma que **todo gasto recurrente proyectado