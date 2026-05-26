// Edge Function: survey-crud
// CRUD autenticado para formularios de Customer Development (survey_forms)
// GET  /survey-crud?id=<uuid>          — obtiene un formulario del usuario
// GET  /survey-crud                    — lista formularios del usuario
// POST /survey-crud                    — crea un formulario nuevo
// PUT  /survey-crud?id=<uuid>          — actualiza un formulario existente
// DELETE /survey-crud?id=<uuid>        — elimina un formulario

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
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  };
}

function json(data: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401, req);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Invalid session' }, 401, req);

  const url = new URL(req.url);
  const formId = url.searchParams.get('id');

  try {
    // ── GET ──────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (formId) {
        const { data, error } = await supabaseAdmin
          .from('survey_forms')
          .select('*')
          .eq('id', formId)
          .eq('client_id', user.id)
          .single();
        if (error) return json({ error: 'Form not found' }, 404, req);
        return json({ form: data }, 200, req);
      }

      const { data, error } = await supabaseAdmin
        .from('survey_forms')
        .select('id, title, description, is_published, unique_slug, created_at, updated_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return json({ forms: data }, 200, req);
    }

    // ── POST ─────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await req.json();
      const { title, description, schema_json, ui_schema, consent_text } = body;

      if (!title?.trim()) return json({ error: 'title is required' }, 400, req);

      // Generar slug único con reintento en caso de colisión
      let slug = generateSlug();
      let attempts = 0;
      while (attempts < 5) {
        const { data: existing } = await supabaseAdmin
          .from('survey_forms')
          .select('id')
          .eq('unique_slug', slug)
          .maybeSingle();
        if (!existing) break;
        slug = generateSlug();
        attempts++;
      }

      const { data, error } = await supabaseAdmin
        .from('survey_forms')
        .insert({
          client_id: user.id,
          title: title.trim(),
          description: description?.trim() ?? null,
          schema_json: schema_json ?? { version: '1.0', fields: [] },
          ui_schema: ui_schema ?? { order: [], layout: 'single-page', pages: [] },
          unique_slug: slug,
          consent_text: consent_text ?? undefined,
        })
        .select()
        .single();

      if (error) throw error;
      return json({ form: data }, 201, req);
    }

    // ── PUT ──────────────────────────────────────────────────
    if (req.method === 'PUT') {
      if (!formId) return json({ error: 'id param required' }, 400, req);

      const body = await req.json();
      const allowed = ['title', 'description', 'schema_json', 'ui_schema', 'consent_text', 'is_published'];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in body) updates[key] = body[key];
      }

      if (Object.keys(updates).length === 0) return json({ error: 'No updatable fields' }, 400, req);

      const { data, error } = await supabaseAdmin
        .from('survey_forms')
        .update(updates)
        .eq('id', formId)
        .eq('client_id', user.id)
        .select()
        .single();

      if (error) return json({ error: 'Form not found or not owned' }, 404, req);
      return json({ form: data }, 200, req);
    }

    // ── DELETE ───────────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!formId) return json({ error: 'id param required' }, 400, req);

      const { error } = await supabaseAdmin
        .from('survey_forms')
        .delete()
        .eq('id', formId)
        .eq('client_id', user.id);

      if (error) return json({ error: 'Delete failed' }, 500, req);
      return json({ ok: true }, 200, req);
    }

    return json({ error: 'Method not allowed' }, 405, req);

  } catch (err) {
    console.error('[survey-crud]', err);
    return json({ error: 'Internal server error' }, 500, req);
  }
});
