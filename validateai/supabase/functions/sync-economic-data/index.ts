import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const CMF_API_KEY = 'e2010e01e27a9d44779a8dc9a1bd2c00887227c7';
const SII_API_KEY = '6beb0b4a869028e8031f7862a039dede5f759bc8';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get parameters from request to know what to sync
    const { provider, indicator, param } = await req.json();

    let dataJson = {};
    let contextText = '';

    if (provider === 'CMF') {
      const url = `https://api.cmfchile.cl/api-sbifv3/recursos_api/${indicator}?apikey=${CMF_API_KEY}&formato=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CMF Error: ${res.statusText}`);
      dataJson = await res.json();
      contextText = `CMF data for ${indicator}: ` + JSON.stringify(dataJson);
    } 
    else if (provider === 'SII') {
      // SII API Gateway
      let endpointPath = '';
      if (indicator === 'uf_mes') {
        endpointPath = `/api/v2/sii/indicadores/uf/mensual/${param}`;
      } else if (indicator === 'uf_anio') {
        endpointPath = `/api/v2/sii/indicadores/uf/anual/${param}`;
      } else if (indicator === 'corr_monetaria') {
        endpointPath = `/api/v2/sii/indicadores/correccion_monetaria/anual/${param}`;
      }

      const url = `https://app.apigateway.cl${endpointPath}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Token ${SII_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`SII Error ${res.status}: ${text}`);
      }
      dataJson = await res.json();
      contextText = `SII API Gateway data for ${indicator} (${param}): ` + JSON.stringify(dataJson);
    } else {
      throw new Error('Unknown provider');
    }

    // UPSERT into economic_knowledge
    // To make it easy, we will first check if an entry for this provider and indicator exists.
    // If it does, we update it. If not, we insert it.
    
    // Create an identifier for the indicator. For SII it includes the param (e.g. uf_mes_2026-05)
    const fullIndicator = param ? `${indicator}_${param}` : indicator;

    const { data: existing, error: searchError } = await supabase
      .from('economic_knowledge')
      .select('id')
      .eq('provider', provider)
      .eq('indicator', fullIndicator)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      throw searchError;
    }

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('economic_knowledge')
        .update({
          data_json: dataJson,
          context_text: contextText,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('economic_knowledge')
        .insert({
          provider,
          indicator: fullIndicator,
          data_json: dataJson,
          context_text: contextText
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
