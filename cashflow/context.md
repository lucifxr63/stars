# Contexto y Directrices de Desarrollo: MVP Flujo de Caja (Esquema `cashflow`)

## 1. Dirección Estratégica y Contexto
Estás desarrollando el MVP de un SaaS independiente para la gestión de flujo de caja dirigido a PYMEs y startups. Este producto comparte el proyecto de Supabase con nuestro producto hermano (Validus) para facilitar un futuro Single Sign-On (SSO), pero opera bajo un esquema de base de datos estrictamente aislado llamado `cashflow`.

El patrón arquitectónico es **SPA + BaaS (Backend-as-a-Service)**. No hay servidor monolítico; la lógica vive entre el cliente y Supabase (Postgres + Edge Functions). Tu objetivo es maximizar la velocidad de salida al mercado (Time to Market) sin comprometer el aislamiento de datos (multi-tenant) ni el rendimiento.

---

## 2. Objetivos del Hito Actual
Establecer la fundación de datos para gestionar ingresos y egresos manuales. Debes generar las migraciones SQL necesarias para crear:
* **`cashflow.profiles`**: Extensión de la identidad del usuario.
* **`cashflow.categories`**: Clasificación de transacciones (ingreso/egreso).
* **`cashflow.transactions`**: Registro contable principal.

---

## 3. Directrices Estrictas de Ingeniería

### Aislamiento y Seguridad (RLS)
* **Desnormalización Controlada:** Para evitar cuellos de botella en las políticas RLS, inyecta la columna `auth_user_id` directamente en las tablas `categories` y `transactions`. 
* **Prohibición de subconsultas en RLS:** No utilices `JOIN` ni subconsultas (ej. `SELECT id FROM cashflow.profiles`) dentro de las políticas RLS. Las políticas deben ser planas y de alta velocidad: `auth_user_id = auth.uid()`.
* **Borrado en Cascada:** Todas las referencias a `auth_user_id` deben tener `ON DELETE CASCADE` para cumplir con normativas de privacidad si el usuario elimina su cuenta central.

### Integración de Identidad
* **Triggers:** Implementa un trigger en Postgres que escuche las inserciones en `public.auth.users` y cree automáticamente la fila correspondiente en `cashflow.profiles`.

### Calidad de Código y "Friction Check"
Antes de proponer o escribir cualquier feature o cambio arquitectónico, debes aplicar internamente un **Friction Check**:
1.  **Viabilidad Técnica:** ¿Introduce dependencias innecesarias?
2.  **Impacto UX:** ¿Bloquea la UI o aumenta el tiempo de carga?
3.  **Costo / Mantenibilidad:** ¿Es la solución más simple para validar el modelo de negocio?
Si la respuesta a cualquiera de estas preguntas representa un riesgo, propón una alternativa más ágil.

---

## 4. Resultados Esperados
Al ejecutar tus tareas, se espera la entrega de:

| Entregable | Criterio de Éxito |
| :--- | :--- |
| **Migración SQL** | Archivo versionado y ejecutable que cree el esquema, tablas, triggers y políticas RLS sin errores de sintaxis. |
| **Seguridad RLS** | Cero fugas de datos entre inquilinos (tenants); pruebas de lectura cruzada deben fallar. |
| **Rendimiento** | Consultas transaccionales deben resolverse en menos de 50ms (sin degradación por RLS pesado). |
| **Respuestas API** | Toda función edge o RPC debe devolver estrictamente formato JSON puro. |

> **Nota Crítica para la IA:** Mantén una postura analítica y directa. Si el usuario solicita una implementación que rompa el aislamiento del esquema o degrade el rendimiento, debes señalar el riesgo inmediatamente y negarte a implementarlo sin proponer la alternativa óptima detallada en este documento.