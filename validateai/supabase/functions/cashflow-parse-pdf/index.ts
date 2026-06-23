// Edge Function: cashflow-parse-pdf
// Ingesta asistida por IA (CASHFLOW_PRD_PART_4). Lee un PDF de factura/recibo
// desde Storage, lo extrae con Claude (multimodal, salida JSON estructurada) y
// devuelve los campos al frontend. HUMAN-IN-THE-LOOP: NUNCA inserta en
// cashflow.invoice — esa responsabilidad es del usuario vía create_invoice.
//
// Modelo: claude-haiku-4-5 — el más barato con visión + salida JSON estructurada
// (fracciones de centavo por factura). Decisión de optimización de costos (nuevo.md):
// "usar Sonnet para leer una factura es como un Ferrari para comprar pan".

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import Anthropic from 'npm:@anthropic-ai/sdk@0.69.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const MODEL = 'claude-haiku-4-5';
const MAX_BYTES = 2 * 1024 * 1024; // 2MB — las facturas pesan KB; rechazamos reportes pesados
const PDF_MONTHLY_LIMIT = 10; // cuota Beta por usuario/mes

const SYSTEM_PROMPT = `Eres un auditor financiero implacable. Tu tarea es extraer datos estructurados del documento proporcionado y devolver EXCLUSIVAMENTE un objeto JSON. Procesa ÚNICAMENTE la primera página.

REGLA DE BLOQUEO CRÍTICA:
Analiza primero la naturaleza del documento. Si es una "Cotización", "Presupuesto", "Proforma", "Nota de Venta" u "Orden de Compra sin valor tributario", DEBES detener la extracción financiera: devuelve is_valid_invoice=false, todos los campos financieros en null, y un rejection_reason del estilo: "El documento detectado es una propuesta comercial (Cotización/Presupuesto), no una factura. El motor de proyección requiere obligaciones de pago reales para no alterar falsamente tu Runway." Si no puedes determinar con seguridad que es una factura/recibo vinculante, trátalo también como inválido.

Si el documento SÍ es una factura o recibo válido y vinculante, devuelve is_valid_invoice=true, rejection_reason=null y extrae:
- 'type': 'AP' si la empresa DEBE pagarla; 'AR' si la COBRARÁ.
- 'contact_name': nombre comercial de la contraparte.
- 'total_amount': valor TOTAL, numérico, sin símbolos.
- 'currency': código ISO de 3 letras (CLP, USD, EUR), inferido del símbolo o país.
- 'issue_date': fecha de emisión en formato YYYY-MM-DD.
- 'due_date': fecha de vencimiento en formato YYYY-MM-DD. Si no existe, suma 30 días a la emisión y añade un warning indicándolo.`;

// Esquema de salida estructurada (output_config.format).
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_valid_invoice: { type: 'boolean' },
    rejection_reason: { type: ['string', 'null'] },
    type: { anyOf: [{ type: 'string', enum: ['AR', 'AP'] }, { type: 'null' }] },
    contact_name: { type: ['string', 'null'] },
    total_amount: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] },
    issue_date: { type: ['string', 'null'] },
    due_date: { type: ['string', 'null'] },
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['is_valid_invoice', 'rejection_reason', 'type', 'contact_name', 'total_amount', 'currency', 'issue_date', 'due_date', 'confidence', 'warnings'],
};

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return json(405, { error_code: 'METHOD_NOT_ALLOWED', message: 'Usa POST.' }, cors);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: 'cashflow' },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return json(401, { error_code: 'UNAUTHORIZED', message: 'Sesión inválida.' }, cors);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error_code: 'INVALID_JSON', message: 'Body inválido.' }, cors);
  }

  const { tenant_id, file_path } = payload as Record<string, unknown>;
  if (typeof tenant_id !== 'string' || typeof file_path !== 'string') {
    return json(400, { error_code: 'MISSING_FIELDS', message: 'tenant_id y file_path son requeridos.' }, cors);
  }

  // El tenant debe pertenecer al usuario.
  const { data: tenant } = await supabase.from('tenant').select('id').eq('id', tenant_id).maybeSingle();
  if (!tenant) {
    return json(403, { error_code: 'TENANT_NOT_OWNED', message: 'El tenant no te pertenece.' }, cors);
  }

  // Descarga el PDF (RLS exige que el path empiece con {auth.uid()}/).
  const { data: file, error: dlErr } = await supabase.storage.from('cashflow_docs').download(file_path);
  if (dlErr || !file) {
    return json(404, { error_code: 'FILE_NOT_FOUND', message: 'No se pudo leer el PDF.' }, cors);
  }

  // Candado de tamaño: 2MB. Las facturas pesan KB; un PDF pesado es otra cosa.
  if (file.size > MAX_BYTES) {
    await supabase.storage.from('cashflow_docs').remove([file_path]);
    return json(413, { error_code: 'FILE_TOO_LARGE', message: 'El archivo supera los 2MB. Sube solo la factura (no reportes pesados).' }, cors);
  }

  // Cuota mensual (Beta): 10 PDFs/usuario/mes. Se verifica ANTES del LLM para no
  // gastar tokens si ya excedió. Atómico vía RPC SECURITY DEFINER.
  const { data: quota, error: quotaErr } = await supabase.rpc('check_and_increment_pdf_usage', { p_limit: PDF_MONTHLY_LIMIT });
  if (quotaErr) {
    await supabase.storage.from('cashflow_docs').remove([file_path]);
    return json(500, { error_code: 'QUOTA_CHECK_FAILED', message: quotaErr.message }, cors);
  }
  if (quota && quota.allowed === false) {
    await supabase.storage.from('cashflow_docs').remove([file_path]);
    return json(429, {
      error_code: 'PDF_QUOTA_EXCEEDED',
      message: `Alcanzaste el límite Beta de ${PDF_MONTHLY_LIMIT} lecturas de PDF este mes.`,
      used: quota.used,
      limit: quota.limit,
    }, cors);
  }

  let extracted;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const b64 = encodeBase64(bytes);

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
            { type: 'text', text: 'Extrae los datos de esta factura/recibo según las reglas.' },
          ],
        },
      ],
    // deno-lint-ignore no-explicit-any
    } as any);

    const textBlock = message.content.find((b: { type: string }) => b.type === 'text');
    extracted = JSON.parse((textBlock as { text: string }).text);
  } catch (e) {
    return json(502, { error_code: 'PARSE_FAILED', message: e instanceof Error ? e.message : 'Error de extracción.' }, cors);
  } finally {
    // Limpieza: borra el PDF temporal tras procesarlo (TTL/no acumular basura).
    await supabase.storage.from('cashflow_docs').remove([file_path]);
  }

  return json(200, {
    data: {
      // Escudo anti-basura: solo facturas/recibos vinculantes pasan.
      is_valid_invoice: extracted.is_valid_invoice === true,
      rejection_reason: extracted.rejection_reason ?? null,
      extracted_fields: {
        type: extracted.type,
        contact_name: extracted.contact_name,
        total_amount: extracted.total_amount,
        currency: extracted.currency,
        issue_date: extracted.issue_date,
        due_date: extracted.due_date,
      },
      confidence: extracted.confidence,
      warnings: extracted.warnings ?? [],
    },
  }, cors);
});
