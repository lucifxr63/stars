import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// â”€â”€ Env â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const OPENAI_API_KEY     = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SCRAPER_API_URL    = Deno.env.get('SCRAPER_API_URL');   // opcional: proxy externo

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

function cors(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// â”€â”€ Tipos internos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface WorkEntry {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  description: string;
  is_leadership: boolean;
  industry: string;
}

interface EduEntry {
  institution: string;
  degree: string;
  field: string;
  end_year: number | null;
}

interface StructuredProfile {
  full_name: string;
  headline: string;
  summary_bio: string;
  industry_expertise_years: number;
  skills: string[];
  work_experience: WorkEntry[];
  education: EduEntry[];
  competency_scores: {
    visionComercial: number;
    capacidadTecnica: number;
    liderazgo: number;
    experienciaIndustria: number;
    resilienciaOperativa: number;
  };
}

// â”€â”€ Scraper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function scrapeLinkedIn(linkedinUrl: string): Promise<string> {
  if (!SCRAPER_API_URL) {
    // Sin proxy configurado: devolvemos texto mÃ­nimo para que el LLM trabaje con la URL
    return `LinkedIn URL: ${linkedinUrl}\n[Scraper proxy no configurado â€” inferir perfil a partir de la URL y datos disponibles]`;
  }
  const res = await fetch(SCRAPER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: linkedinUrl }),
  });
  if (!res.ok) throw new Error(`Scraper error ${res.status}`);
  const data = await res.json();
  return typeof data.text === 'string' ? data.text : JSON.stringify(data);
}

// â”€â”€ LLM: Structured Outputs vÃ­a gpt-4o-mini â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SYSTEM_PROMPT = `Eres un extractor de perfiles profesionales. Dado el texto crudo de un perfil LinkedIn en espaÃ±ol, extrae la informaciÃ³n relevante y devuelve SOLO JSON vÃ¡lido, sin markdown, con la siguiente estructura exacta:
{
  "full_name": "string",
  "headline": "string (cargo/descripciÃ³n corta)",
  "summary_bio": "string (resumen profesional, mÃ¡x 300 chars)",
  "industry_expertise_years": number,
  "skills": ["string", ...],
  "work_experience": [
    {
      "company": "string",
      "title": "string",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM o null si es actual",
      "description": "string (1-2 lÃ­neas)",
      "is_leadership": boolean,
      "industry": "string"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "end_year": number | null
    }
  ],
  "competency_scores": {
    "visionComercial": number (0-100),
    "capacidadTecnica": number (0-100),
    "liderazgo": number (0-100),
    "experienciaIndustria": number (0-100),
    "resilienciaOperativa": number (0-100)
  }
}
Si algÃºn campo no estÃ¡ disponible, usa valores razonables por defecto (strings vacÃ­os, 0, arrays vacÃ­os).
IMPORTANTE: Responde SOLO con JSON, sin texto adicional.`;

async function structureWithLLM(rawText: string): Promise<StructuredProfile> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: rawText },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(text) as StructuredProfile;
}

// â”€â”€ Handler principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
serve(async (req) => {
  const corsHeaders = cors(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cuerpo del request
    const body = await req.json();
    const linkedinUrl: string = body.linkedin_url ?? '';

    if (!linkedinUrl || !linkedinUrl.includes('linkedin.com')) {
      return new Response(JSON.stringify({ error: 'URL de LinkedIn invÃ¡lida' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Marcar como processing
    await supabase
      .from('founder_profiles')
      .upsert({ id: user.id, linkedin_url: linkedinUrl, extraction_status: 'processing' }, { onConflict: 'id' });

    // Scraping
    const rawText = await scrapeLinkedIn(linkedinUrl);

    // EstructuraciÃ³n con LLM
    const structured = await structureWithLLM(rawText);

    // Persistir en DB
    const { error: upsertErr } = await supabase
      .from('founder_profiles')
      .upsert({
        id:                      user.id,
        linkedin_url:            linkedinUrl,
        full_name:               structured.full_name,
        headline:                structured.headline,
        summary_bio:             structured.summary_bio,
        industry_expertise_years: structured.industry_expertise_years,
        skills:                  structured.skills,
        work_experience:         structured.work_experience,
        education:               structured.education,
        competency_scores:       structured.competency_scores,
        raw_scraped_data:        { text: rawText },
        ai_inference_metadata:   structured,
        extraction_status:       'done',
      }, { onConflict: 'id' });

    if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);

    return new Response(JSON.stringify({ ...structured, extraction_status: 'done' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[extract-founder-profile]', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
