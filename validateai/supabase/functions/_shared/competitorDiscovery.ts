// Descubrimiento de competidores vía SerpApi, con persistencia en `competitors`.
//
// POR QUÉ EXISTE
// -------------
// `competitive_analysis` decía apoyarse en RAG sobre la tabla `competitors`,
// que está VACÍA en producción. El prompt salía igual, sin un solo competidor
// real delante, y nadie se enteraba. Auditado el 2026-07-29: no existe corpus
// de competidores en ningún lado del ecosistema — ni en corpus/, ni en el
// knowledge-vault, ni en el grafo. No había qué ingerir: había que crear la
// fuente.
//
// CÓMO FUNCIONA
// -------------
// El corpus se construye SOLO, a partir del uso real:
//
//   1. Se consulta `competitors` (barato, sin red).
//   2. Si no hay match, se busca en Google vía SerpApi para ESA idea.
//   3. Lo encontrado se persiste con su embedding.
//   4. La próxima idea del mismo rubro ya pega en el corpus y no gasta búsqueda.
//
// QUÉ NO HACE — y es deliberado
// -----------------------------
// No pasa los resultados por un LLM para "enriquecerlos". Se guarda lo que
// SerpApi devuelve (nombre, url, descripción) y lo que se sabe de la idea
// (rubro, geografía). `strengths` y `weaknesses` quedan NULL: inferirlas de un
// snippet sería inventar hechos sobre empresas reales, que es exactamente el
// problema que este módulo viene a resolver. El LLM que consume el contexto
// puede razonar sobre ellas; la diferencia es que ahora tiene nombres y
// descripciones reales delante en vez de nada.
//
// Nunca lanza: si SerpApi falla o no está configurada, se devuelve lista vacía
// y `competitive_analysis` corre sin grounding — pero queda registrado en
// `input_data._rag` (ver ai-validate) en vez de degradar en silencio.

import type { StructuredIdea } from './types.ts';
import { generateEmbedding } from './rag.ts';

const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');

/** Cuántos resultados orgánicos se conservan por búsqueda. */
const MAX_RESULTADOS = 6;
/** SerpApi puede tardar; más que esto no vale la pena hacer esperar al usuario. */
const TIMEOUT_MS = 10_000;

export interface CompetidorDescubierto {
  name: string;
  url: string | null;
  description: string | null;
  market: string | null;
  industries: string[];
  geography: string[];
}

export interface ResultadoDescubrimiento {
  competitors: CompetidorDescubierto[];
  /** Motivo por el que no se descubrió nada — para la instrumentación. */
  reason?: string;
}

/** Dominios que nunca son un competidor: agregadores, redes, marketplaces de apps. */
const DOMINIOS_IGNORADOS = [
  'wikipedia.org', 'youtube.com', 'facebook.com', 'instagram.com', 'linkedin.com',
  'x.com', 'twitter.com', 'reddit.com', 'quora.com', 'medium.com',
  'play.google.com', 'apps.apple.com', 'amazon.com', 'mercadolibre.',
  'indeed.com', 'glassdoor.', 'crunchbase.com',
];

function esDominioUtil(url: string): boolean {
  const u = url.toLowerCase();
  return !DOMINIOS_IGNORADOS.some((d) => u.includes(d));
}

/** Nombre de empresa a partir del título del resultado: corta en el separador. */
function nombreDesdeTitulo(titulo: string): string {
  return (titulo.split(/[|\-–—:]/)[0] ?? titulo).trim().slice(0, 120);
}

function construirQuery(idea: StructuredIdea, pais?: string): string {
  // Se busca por SOLUCIÓN y no por problema: quien resuelve lo mismo es el
  // competidor. El problema devuelve artículos y foros, no empresas.
  const base = [idea.solution, idea.market].filter(Boolean).join(' ');
  const lugar = pais && pais.toLowerCase() !== 'global' ? ` ${pais}` : '';
  return `${base}${lugar} empresas alternativas competidores`.slice(0, 220);
}

async function buscarEnSerpApi(query: string, pais?: string): Promise<
  Array<{ title: string; link: string; snippet?: string }>
> {
  const esChile = !pais || /chile|cl/i.test(pais);
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: SERPAPI_KEY!,
    num: '10',
    hl: 'es',
    ...(esChile ? { gl: 'cl', location: 'Chile' } : {}),
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.organic_results) ? data.organic_results : [];
}

export async function discoverCompetitors(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  idea: StructuredIdea,
  opts: { industry?: string; country?: string } = {},
): Promise<ResultadoDescubrimiento> {
  if (!SERPAPI_KEY) return { competitors: [], reason: 'serpapi_no_configurada' };
  if (!idea.solution) return { competitors: [], reason: 'idea_sin_solucion' };

  let organicos: Array<{ title: string; link: string; snippet?: string }>;
  try {
    organicos = await buscarEnSerpApi(construirQuery(idea, opts.country), opts.country);
  } catch (err) {
    console.warn('[competitor-discovery] SerpApi falló:', err);
    return { competitors: [], reason: 'serpapi_error' };
  }

  const industrias = [opts.industry, idea.market].filter(Boolean) as string[];
  const geografia = [opts.country?.toLowerCase() ?? 'chile'];

  const encontrados: CompetidorDescubierto[] = [];
  const vistos = new Set<string>();

  for (const r of organicos) {
    if (encontrados.length >= MAX_RESULTADOS) break;
    if (!r.link || !esDominioUtil(r.link)) continue;

    let host: string;
    try { host = new URL(r.link).hostname.replace(/^www\./, ''); } catch { continue; }
    if (vistos.has(host)) continue; // un competidor por dominio
    vistos.add(host);

    encontrados.push({
      name: nombreDesdeTitulo(r.title ?? host),
      url: r.link,
      description: r.snippet?.slice(0, 600) ?? null,
      market: idea.market ?? null,
      industries: industrias,
      geography: geografia,
    });
  }

  if (encontrados.length === 0) {
    return { competitors: [], reason: 'sin_resultados_utiles' };
  }

  await persistir(supabase, encontrados);
  return { competitors: encontrados };
}

/**
 * Guarda lo descubierto para que la próxima idea similar pegue en el corpus.
 * No bloquea el análisis: si falla, se loguea y se sigue — el usuario ya tiene
 * sus competidores en memoria.
 */
async function persistir(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  competidores: CompetidorDescubierto[],
): Promise<void> {
  for (const c of competidores) {
    try {
      // El texto embebido debe parecerse al que usa `retrieveRelevantCompetitors`
      // para construir SU embedding (problema + solución + mercado + audiencia);
      // si no, el coseno no los acerca y el corpus nunca se usa.
      const embedding = await generateEmbedding(
        [c.name, c.description, c.market, ...c.industries].filter(Boolean).join(' '),
      );
      if (!embedding) continue;

      const { error } = await supabase
        .from('competitors')
        .upsert(
          {
            name: c.name,
            url: c.url,
            description: c.description,
            market: c.market,
            industries: c.industries,
            geography: c.geography,
            // strengths/weaknesses quedan NULL a propósito — ver cabecera.
            embedding,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'url' },
        );
      if (error) console.warn('[competitor-discovery] upsert falló:', error.message);
    } catch (err) {
      console.warn('[competitor-discovery] error al persistir:', err);
    }
  }
}
