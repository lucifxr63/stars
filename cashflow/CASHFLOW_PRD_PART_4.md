Como Mesa Directiva, comparto absolutamente tu visión: el producto debe ser agnóstico y servirle a la panadería de la esquina, a la agencia de marketing digital y a la startup tecnológica por igual. **La masividad es la clave del modelo Freemium.**

Sin embargo, para cumplir esa premisa sin hundir el barco, mi recomendación estratégica es **enfocarnos ESTRICTAMENTE en la extracción de Facturas (Cuentas por Cobrar y Pagar) y prohibir la lectura de Cartolas Bancarias (Bank Statements) por IA en esta fase.**

Pasemos esto por nuestro filtro de rigor.

---

### 🛑 Filtro de Fricción: Facturas vs. Cartolas Bancarias por IA

* **El Problema de las Cartolas Bancarias:** Los PDFs de bancos son tablas kilométricas, multi-página, sin un estándar global. Procesar un PDF de 15 páginas con 300 transacciones a través de GPT-4o o Claude 3.5 Sonnet:
1. Consumirá una cantidad grosera de tokens (Alto Burn Rate para nosotros).
2. La IA alucinará fechas o confundirá cargos con abonos.
3. *Fallo crítico de UX:* La regla "Human-in-the-Loop" obliga al usuario a revisar el resultado. Obligar a un usuario a auditar 300 filas extraídas por una IA destruye el Time-to-Value (TTV).


* **La Ventaja de las Facturas (Invoices):** Son documentos de 1 página. Tienen puntos de datos discretos (Monto Total, Fecha de Emisión, Fecha de Vencimiento, Nombre del Cliente/Proveedor). La IA extrae esto en 3 segundos con un 98% de precisión. El usuario revisa 5 campos visualmente, aprueba con un clic, y la factura se inyecta en el motor de proyección.
* **Decisión Directiva:** El motor `parse-pdf` leerá **solo facturas/recibos**. Para las transacciones bancarias, en la Fase 2 usaremos importación clásica por archivo `.CSV` (que todos los bancos del mundo exportan nativamente y no requiere IA, solo mapeo de columnas determinista).

---

### 🗂️ 4. Anexo al PRD (Entrégale esto a Claude Code)

Copia este bloque como `CASHFLOW_PRD_PART_4.md`. Contiene la arquitectura para la extracción de PDFs con IA, el contrato exacto de la API y el *System Prompt* que tu agente debe programar.

```markdown
# CASHFLOW_PRD_PART_4.md - Ingesta Asistida por IA (PDF Parser)

> **Contexto de IA (Claude Code):** Eres el ingeniero principal. El MVP ya tiene proyección y automatización de gastos fijos. Ahora implementaremos la extracción de datos de PDFs mediante Modelos Fundacionales Multimodales (GPT-4o o Claude 3.5 Sonnet) para agilizar el Onboarding de Cuentas por Cobrar (A/R) y Pagar (A/P).

## 1. Reglas de Arquitectura y Seguridad (Human-in-the-Loop)

* **Separación de Responsabilidades:** La función `parse-pdf` **NUNCA** inserta datos en la tabla `cashflow.invoice`. Su única responsabilidad es leer el Storage, llamar al LLM, y devolver un JSON estructurado al Frontend.
* **Flujo UX:** El Frontend recibe el JSON, auto-rellena el formulario de creación de factura ya existente, y el usuario debe presionar "Guardar" explícitamente (reutilizando la función `create_invoice` de la Fase 1).
* **Limpieza de Storage:** Los PDFs se suben a un bucket `cashflow_docs`. Se debe configurar el bucket de Supabase para que los archivos expiren o aplicar un borrado lógico tras procesarlos para no acumular basura (TTL temporal).

## 2. Contrato de la Edge Function (`cashflow-parse-pdf`)

**Endpoint:** `POST /functions/v1/cashflow-parse-pdf`

```json
{
  "api_contract": {
    "request_payload": {
      "tenant_id": "uuid-v4-string",
      "file_path": "temp/uuid-factura.pdf",
      "expected_type": "AR_OR_AP" 
    },
    "response_success": {
      "status": 200,
      "data": {
        "extracted_fields": {
          "type": "AP", 
          "contact_name": "Nombre de la Empresa Emisora/Receptora",
          "total_amount": 150000.00,
          "currency": "CLP",
          "issue_date": "YYYY-MM-DD",
          "due_date": "YYYY-MM-DD"
        },
        "confidence": "HIGH | MEDIUM | LOW",
        "warnings": ["Array de advertencias, ej: 'Fecha de vencimiento no explícita, se asumió 30 días.'"]
      }
    }
  }
}

```

## 3. System Prompt Estricto (Para integrar en la Edge Function)

Al consumir la API del LLM, debes usar estrictamente el modo "JSON Output" (u Object Generation) con el siguiente prompt de sistema:

```text
Eres un asistente financiero experto en lectura de documentos. Tu única tarea es extraer datos estructurados de la factura o recibo proporcionado y devolver EXCLUSIVAMENTE un objeto JSON.

Reglas de extracción:
1. 'type': Si el documento es una factura que la empresa DEBE pagar, es 'AP'. Si es una factura que la empresa COBRARÁ, es 'AR'. Utiliza el contexto del usuario si es necesario.
2. 'contact_name': El nombre comercial de la contraparte.
3. 'total_amount': El valor TOTAL a pagar/cobrar, numérico, sin símbolos.
4. 'currency': Código ISO de 3 letras (ej. CLP, USD, EUR). Infiérelo del símbolo o país.
5. 'issue_date': Fecha de emisión en formato YYYY-MM-DD.
6. 'due_date': Fecha de vencimiento en formato YYYY-MM-DD. Si no existe en el documento, suma 30 días a la fecha de emisión y añade un warning indicando esto.

Si el documento NO parece una factura o recibo, devuelve confidence: "LOW" y pon los campos en null.

```

## 4. Instrucciones de Implementación Frontend

1. En el Dashboard, dentro de "Resolución de Facturas" o "Añadir Movimiento", agrega una zona de Dropzone: "Arrastra el PDF de tu factura aquí".
2. Al soltar el archivo, subirlo a `cashflow_docs` y llamar a `cashflow-parse-pdf`.
3. Mientras espera la respuesta, mostrar un estado de "Leyendo documento con IA...".
4. Una vez devuelto el JSON, abrir el modal de facturas manuales con los campos ya completados y el tag `source_system` como "PDF_AI".

```

---

### ⚡ Siguientes Pasos

Tienes en tus manos la arquitectura para darle el efecto "Magia" al SaaS sin sacrificar la robustez transaccional ni disparar tus costos de API. 

Ejecuta este PRD con Claude Code. Y cuando tengas el motor extrayendo PDFs y pre-llenando el formulario visualmente, **estaremos listos para enviar el correo del "Silent Beta" a la base de usuarios de Validus.** ¿Procedemos a ejecutar la ingesta por PDF o hay alguna otra validación de negocio que te quite el sueño antes del lanzamiento encubierto?

```