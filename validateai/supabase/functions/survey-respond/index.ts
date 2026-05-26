// Edge Function: survey-respond
// Endpoint PÚBLICO para recibir respuestas de encuestas.
// Valida el payload contra el schema_json del formulario en tiempo de ejecución.
// Requiere consentimiento explícito del encuestado (Ley 21.719).
// POST /survey-respond  body: { slug, response_data, consent_given, metadata? }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'https://validateai.cl',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey, x-client-info',
  };
}

function json(data: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ── Tipos del schema_json ─────────────────────────────────
type FieldType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'scale' | 'date' | 'select';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number };
  conditional?: { showIf?: { fieldId: string; value: unknown } };
}

interface FormSchema {
  version: string;
  fields: FormField[];
}

// ── Validador dinámico ────────────────────────────────────
function validateResponseData(
  responseData: Record<string, unknown>,
  schema: FormSchema,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of schema.fields) {
    // Evaluar visibilidad condicional
    if (field.conditional?.showIf) {
      const dep = field.conditional.showIf;
      if (responseData[dep.fieldId] !== dep.value) continue;
    }

    const value = responseData[field.id];
    const isEmpty = value === undefined || value === null || value === '';

    if (field.required && isEmpty) {
      errors.push(`Campo requerido: "${field.label}"`);
      continue;
    }
    if (isEmpty) continue;

    const v = field.validation;
    if (!v) continue;

    if (field.type === 'text' || field.type === 'textarea') {
      const str = String(value);
      if (v.minLength !== undefined && str.length < v.minLength)
        errors.push(`"${field.label}" debe tener al menos ${v.minLength} caracteres.`);
      if (v.maxLength !== undefined && str.length > v.maxLength)
        errors.push(`"${field.label}" no puede superar ${v.maxLength} caracteres.`);
    }

    if (field.type === 'scale') {
      const num = Number(value);
      if (isNaN(num)) { errors.push(`"${field.label}" debe ser un número.`); continue; }
      if (v.min !== undefined && num < v.min) errors.push(`"${field.label}" mínimo: ${v.min}`);
      if (v.max !== undefined && num > v.max) errors.push(`"${field.label}" máximo: ${v.max}`);
    }

    if (field.type === 'radio' || field.type === 'select') {
      if (field.options && !field.options.includes(String(value)))
        errors.push(`"${field.label}": opción inválida.`);
    }

    if (field.type === 'checkbox') {
      if (!Array.isArray(value)) { errors.push(`"${field.label}" debe ser un arreglo.`); continue; }
      if (field.options) {
        const invalid = (value as string[]).filter(v => !field.options!.includes(v));
        if (invalid.length) errors.push(`"${field.label}": opciones inválidas: ${invalid.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const { slug, response_data, consent_given, metadata = {} } = body;

    if (!slug) return json({ error: 'slug is required' }, 400, req);
    if (!response_data || typeof response_data !== 'object') return json({ error: 'response_data must be an object' }, 400, req);

    // Consentimiento explícito obligatorio — Ley 21.719
    if (!consent_given) {
      return json({
        error: 'Debes aceptar el consentimiento para enviar tus respuestas (Ley N° 21.719).',
        code: 'CONSENT_REQUIRED',
      }, 400, req);
    }

    // Obtener el formulario publicado
    const { data: form, error: formError } = await supabaseAdmin
      .from('survey_forms')
      .select('id, schema_json, is_published')
      .eq('unique_slug', slug)
      .eq('is_published', true)
      .single();

    if (formError || !form) {
      return json({ error: 'Formulario no encontrado o no publicado.' }, 404, req);
    }

    // Validar respuestas contra el schema dinámico
    const schema = form.schema_json as FormSchema;
    const { valid, errors } = validateResponseData(response_data as Record<string, unknown>, schema);
    if (!valid) {
      return json({ error: 'Datos inválidos.', validation_errors: errors }, 422, req);
    }

    // Sanitizar metadata: solo campos seguros
    const safeMetadata = {
      user_agent: String(metadata.user_agent ?? '').slice(0, 512),
      completed_at: new Date().toISOString(),
      referrer: String(metadata.referrer ?? '').slice(0, 512),
    };

    // Insertar respuesta
    const { data: submission, error: insertError } = await supabaseAdmin
      .from('survey_submissions')
      .insert({
        form_id: form.id,
        response_data,
        metadata: safeMetadata,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        anonymization_status: 'raw',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    console.log(`[survey-respond] Respuesta registrada: form=${form.id} submission=${submission.id}`);

    return json({ ok: true, submission_id: submission.id }, 201, req);

  } catch (err) {
    console.error('[survey-respond]', err);
    return json({ error: 'Internal server error' }, 500, req);
  }
});
