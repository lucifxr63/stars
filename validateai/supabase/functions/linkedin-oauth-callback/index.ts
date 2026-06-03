import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LINKEDIN_CLIENT_ID     = Deno.env.get('LINKEDIN_CLIENT_ID')!;
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET')!;
const OPENAI_API_KEY         = Deno.env.get('OPENAI_API_KEY')!;
const PROXYCURL_API_KEY      = Deno.env.get('PROXYCURL_API_KEY');
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
}

interface ProxycurlExperience {
  company: string;
  title: string;
  starts_at?: { year: number; month?: number };
  ends_at?: { year: number; month?: number } | null;
  description?: string;
}

interface ProxycurlProfile {
  full_name?: string;
  headline?: string;
  summary?: string;
  industry?: string;
  experiences?: ProxycurlExperience[];
  education?: Array<{
    school: string;
    degree_name?: string;
    field_of_study?: string;
    ends_at?: { year: number } | null;
  }>;
  skills?: string[];
}

interface CompetencyScores {
  visionComercial: number;
  capacidadTecnica: number;
  liderazgo: number;
  experienciaIndustria: number;
  resilienciaOperativa: number;
}

async function scoreWithLLM(
  name: string,
  headline: string,
  summary: string,
  experiences: ProxycurlExperience[],
  skills: string[],
): Promise<CompetencyScores> {
  const fallback: CompetencyScores = { visionComercial: 50, capacidadTecnica: 50, liderazgo: 50, experienciaIndustria: 50, resilienciaOperativa: 50 };

  const prompt = `Dado el siguiente perfil de un fundador, genera competency scores del 0 al 100. Devuelve SOLO JSON válido sin texto adicional.

Nombre: ${name}
Headline: ${headline || 'No disponible'}
Resumen: ${summary || 'No disponible'}
Experiencias: ${JSON.stringify(experiences.slice(0, 5))}
Skills: ${skills.slice(0, 20).join(', ') || 'No disponible'}

Responde con exactamente:
{"visionComercial": number, "capacidadTecnica": number, "liderazgo": number, "experienciaIndustria": number, "resilienciaOperativa": number}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as CompetencyScores;
  } catch {
    return fallback;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, cors);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401, cors);

    const { code, redirect_uri } = await req.json() as { code: string; redirect_uri: string };
    if (!code) return json({ error: 'Missing code' }, 400, cors);

    const redirectUri = redirect_uri ?? 'https://validus.scouttech.lat/auth/linkedin/callback';

    // 1. Exchange code → access_token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`LinkedIn token exchange failed: ${err}`);
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // 2. OIDC userinfo → sub, name, picture, email
    const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userinfoRes.ok) throw new Error(`LinkedIn userinfo failed: ${await userinfoRes.text()}`);
    const userInfo = await userinfoRes.json() as LinkedInUserInfo;

    // 3. Proxycurl enrichment (optional — sólo si existe linkedin_url guardada)
    let proxycurlData: ProxycurlProfile = {};
    const { data: existing } = await supabase
      .from('founder_profiles')
      .select('linkedin_url')
      .eq('id', user.id)
      .maybeSingle();

    if (PROXYCURL_API_KEY && existing?.linkedin_url) {
      const pcRes = await fetch(
        `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(existing.linkedin_url)}`,
        { headers: { Authorization: `Bearer ${PROXYCURL_API_KEY}` } }
      );
      if (pcRes.ok) proxycurlData = await pcRes.json() as ProxycurlProfile;
    }

    const fullName   = proxycurlData.full_name ?? userInfo.name ?? `${userInfo.given_name ?? ''} ${userInfo.family_name ?? ''}`.trim();
    const headline   = proxycurlData.headline ?? '';
    const summary    = proxycurlData.summary ?? '';
    const skills     = proxycurlData.skills ?? [];
    const experiences = proxycurlData.experiences ?? [];

    // 4. LLM competency scoring
    const competencyScores = await scoreWithLLM(fullName, headline, summary, experiences, skills);

    // 5. Map Proxycurl → DB schema
    const workExperience = experiences.map((e) => ({
      company:      e.company,
      title:        e.title,
      start_date:   e.starts_at ? `${e.starts_at.year}-${String(e.starts_at.month ?? 1).padStart(2, '0')}` : '',
      end_date:     e.ends_at ? `${e.ends_at.year}-${String(e.ends_at.month ?? 1).padStart(2, '0')}` : null,
      description:  e.description ?? '',
      is_leadership: /\b(ceo|cto|coo|cfo|co-?founder|director|head of|vp|president|chief)\b/i.test(e.title),
      industry:     proxycurlData.industry ?? '',
    }));

    const education = (proxycurlData.education ?? []).map((e) => ({
      institution: e.school,
      degree:      e.degree_name ?? '',
      field:       e.field_of_study ?? '',
      end_year:    e.ends_at?.year ?? null,
    }));

    // 6. Upsert founder_profiles
    const patch: Record<string, unknown> = {
      id:                 user.id,
      linkedin_member_id: userInfo.sub,
      photo_url:          userInfo.picture ?? null,
      full_name:          fullName || null,
      competency_scores:  competencyScores,
      extraction_status:  'done',
    };
    if (headline)               patch.headline = headline;
    if (summary)                patch.summary_bio = summary;
    if (skills.length > 0)      patch.skills = skills;
    if (workExperience.length)  patch.work_experience = workExperience;
    if (education.length)       patch.education = education;

    const { error: upsertErr } = await supabase
      .from('founder_profiles')
      .upsert(patch, { onConflict: 'id' });

    if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);

    return json({
      id:                  user.id,
      linkedin_member_id:  userInfo.sub,
      photo_url:           userInfo.picture ?? null,
      linkedin_url:        existing?.linkedin_url ?? null,
      full_name:           fullName || null,
      headline:            headline || null,
      summary_bio:         summary || null,
      industry_expertise_years: 0,
      skills,
      work_experience:     workExperience,
      education,
      competency_scores:   competencyScores,
      extraction_status:   'done',
      updated_at:          new Date().toISOString(),
    }, 200, cors);

  } catch (err) {
    console.error('[linkedin-oauth-callback]', err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500, cors);
  }
});
