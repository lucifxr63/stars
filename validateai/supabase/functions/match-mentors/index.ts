import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY       = Deno.env.get('OPENAI_API_KEY');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { ideaDescription, founderGaps = [] } = await req.json() as {
      ideaDescription: string;
      founderGaps?: string[];
    };

    if (!ideaDescription?.trim()) {
      return new Response(JSON.stringify([]), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Combinar idea + gaps del fundador para un matching más contextual
    const queryText = [
      ideaDescription,
      ...(founderGaps.length ? [`Gaps del fundador: ${founderGaps.join(', ')}`] : []),
    ].join('\n');

    let mentors: unknown[] = [];

    try {
      const embedding = await generateEmbedding(queryText);

      const { data, error } = await supabase.rpc('match_mentors', {
        query_embedding:  embedding,
        match_threshold:  0.60,
        match_count:      3,
      });

      if (!error && data?.length) {
        mentors = data;
      }
    } catch (embErr) {
      console.warn('[match-mentors] embedding failed, falling back to random:', embErr);
    }

    // Fallback: si no hay embeddings o OpenAI falla, devolver los primeros disponibles
    if (!mentors.length) {
      const { data: fallback } = await supabase
        .from('mentors')
        .select('id,name,bio,expertise,linkedin_url,calendly_url,availability,session_price_clp,languages,photo_url')
        .eq('availability', 'available')
        .limit(3);

      mentors = (fallback ?? []).map(m => ({ ...m, similarity: 0.5 }));
    }

    return new Response(JSON.stringify(mentors), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[match-mentors]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
