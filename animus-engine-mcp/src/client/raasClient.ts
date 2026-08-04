// Cliente HTTP canónico para Animus Engine / Bralidus RaaS API Gateway v1
// Conecta a https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1

const DEFAULT_BASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1';

/**
 * API key del gateway. OBLIGATORIA — no hay valor por defecto.
 *
 * POR QUÉ NO HAY DEFAULT: hasta 0.1.0 el cliente caía a `demo_public_key`, así
 * que cualquiera que instalara el paquete consultaba el gateway sin traer nada
 * propio. Publicado en npm eso convierte una clave compartida en la clave de
 * facto de todos los usuarios: el consumo se mezcla, el rate limit lo gastan
 * terceros, y no hay forma de saber quién hizo qué.
 *
 * Falla temprano y con instrucciones. Un MCP que arranca y recién falla en la
 * primera herramienta deja al usuario mirando un error de red sin saber que le
 * falta configurar una variable.
 */
export function getApiKey(): string {
  const key = process.env.ANIMUS_API_KEY || process.env.BRALIDUS_API_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      'Falta ANIMUS_API_KEY. Obtené una en https://animus.scouttech.lat y agregala ' +
        'al bloque "env" de tu configuración MCP:\n' +
        '  "env": { "ANIMUS_API_KEY": "tu_clave" }',
    );
  }
  return key.trim();
}

export function getBaseUrl(): string {
  return process.env.ANIMUS_GATEWAY_URL || DEFAULT_BASE_URL;
}

/**
 * Única fuente de verdad de la versión, para el encabezado X-Client y para el
 * handshake MCP de `index.ts`.
 *
 * Estaba escrita a mano en dos lugares y los dos mentían: el cliente HTTP decía
 * 1.0.0 y el servidor MCP también, mientras el paquete publicado es 0.1.0. Un
 * número que nadie sincroniza deja de ser un dato: cuando alguien reporte "me
 * falla en la 1.0.0" no vamos a saber qué tiene instalado.
 *
 * El test de empaquetado verifica que coincida con package.json.
 */
export const VERSION = '0.1.1';
const VERSION_CLIENTE = VERSION;

/**
 * Cabeceras comunes. La API key va SÓLO acá, nunca en la query string.
 *
 * Antes se mandaba además como `?apikey=`, "como fallback". Era redundante —el
 * gateway lee Authorization primero— y bastante peor: las query strings quedan
 * escritas en los logs del servidor, en los de cualquier proxy intermedio y en
 * los historiales. Publicado en npm, eso significa filtrar la clave de cada
 * usuario a un registro de acceso que nadie va a auditar.
 */
function cabeceras(extra?: Record<string, string>): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Accept': 'application/json',
    'X-Client': `Animus-Engine-MCP/${VERSION_CLIENTE}`,
    ...extra,
  };
}

/**
 * Presupuesto por defecto de una petición, en milisegundos.
 *
 * POR QUÉ EXISTE: `fetch` sin `signal` NO tiene timeout. Si el gateway queda
 * colgado —Edge Function fría, Supabase degradado, la red del usuario— la
 * llamada no vuelve nunca: el cliente MCP gira indefinidamente sin mensaje
 * alguno, y para quien lo usa es indistinguible de que el modelo se colgó. Es el
 * único fallo de esta clase que no produce ni una línea de diagnóstico.
 *
 * Se puede subir con ANIMUS_TIMEOUT_MS para redes lentas.
 */
const TIMEOUT_POR_DEFECTO_MS = 30_000;

/** Las rutas que hacen trabajo de LLM tardan legítimamente más que un SELECT. */
const TIMEOUT_LARGO_MS = 90_000;
const RUTAS_LENTAS = ['/intel/query', '/rag/query', '/validate'];

function presupuesto(path: string): number {
  const configurado = Number(process.env.ANIMUS_TIMEOUT_MS);
  if (Number.isFinite(configurado) && configurado > 0) return configurado;
  return RUTAS_LENTAS.some((r) => path.startsWith(r)) ? TIMEOUT_LARGO_MS : TIMEOUT_POR_DEFECTO_MS;
}

/**
 * Traduce la respuesta de error del gateway a algo que el usuario pueda actuar.
 *
 * Antes se propagaba el cuerpo crudo: `Animus RaaS API Error (HTTP 401) on GET
 * /data/macro: {"error":"Invalid API key or session token"}`. Los dos errores
 * que un usuario nuevo GARANTIZADAMENTE va a encontrar —clave mal copiada y
 * cuota agotada— eran justamente los que quedaban ilegibles, aunque el gateway
 * ya emite códigos estructurados y encabezados de cuota que aquí se descartaban.
 */
function traducirError(status: number, cuerpo: string, headers: Headers, metodo: string, path: string): Error {
  let codigo = '';
  let mensajeApi = '';
  try {
    const j = JSON.parse(cuerpo);
    codigo = j?.code ?? '';
    mensajeApi = j?.error ?? '';
  } catch { /* el gateway no siempre devuelve JSON (502 de la CDN, por ejemplo) */ }

  if (status === 401 || codigo === 'AUTH_REQUIRED') {
    return new Error(
      'Tu ANIMUS_API_KEY es inválida, fue revocada o no se está enviando. ' +
        'Revisa el bloque "env" de tu configuración MCP y genera una nueva en ' +
        'https://animus.scouttech.lat si hace falta. ' +
        'No existe una clave pública compartida.',
    );
  }

  if (status === 403 || codigo === 'TIER_INSUFFICIENT') {
    return new Error(
      `Tu plan no habilita este endpoint (${path}). ${mensajeApi} ` +
        'Puedes revisar o subir tu plan en https://animus.scouttech.lat',
    );
  }

  if (status === 429) {
    const limite = headers.get('x-ratelimit-limit-credits');
    const restante = headers.get('x-ratelimit-remaining-credits');
    const tier = headers.get('x-ratelimit-tier');
    if (codigo === 'RATE_LIMIT_BURST') {
      const espera = (() => { try { return JSON.parse(cuerpo)?.retry_after_seconds; } catch { return null; } })();
      return new Error(
        `Superaste el límite por minuto de tu plan${tier ? ` (${tier})` : ''}. ` +
          `Espera ${espera ?? 60} segundos y reintenta.`,
      );
    }
    return new Error(
      `Agotaste la cuota mensual de créditos${tier ? ` del plan ${tier}` : ''}` +
        `${limite ? ` (${restante ?? 0} de ${limite} disponibles)` : ''}. ` +
        'Se reinicia el día 1 del próximo mes. Puedes subir de plan en https://animus.scouttech.lat',
    );
  }

  if (status === 503 || codigo === 'SOURCE_UNAVAILABLE') {
    return new Error(
      `La fuente de datos de ${path} no está respondiendo ahora mismo. ` +
        'El gateway devuelve 503 en vez de inventar registros, así que esto es ' +
        'una caída temporal de la fuente y no un error de tu consulta. Reintenta en unos minutos.',
    );
  }

  if (status >= 500) {
    return new Error(
      `El gateway falló con HTTP ${status} en ${metodo} ${path}. Es un problema del ` +
        `servidor, no de tu consulta. ${mensajeApi || cuerpo.slice(0, 200)}`,
    );
  }

  return new Error(
    `Animus RaaS API Error (HTTP ${status}) en ${metodo} ${path}: ${mensajeApi || cuerpo.slice(0, 300)}`,
  );
}

async function pedir(metodo: 'GET' | 'POST', path: string, init: RequestInit, url: string): Promise<any> {
  const ms = presupuesto(path);
  const control = new AbortController();
  const alarma = setTimeout(() => control.abort(), ms);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: control.signal });
  } catch (err: any) {
    // `abort` no distingue por sí solo un timeout de una cancelación del
    // usuario; acá el único que aborta es el temporizador de arriba.
    if (err?.name === 'AbortError') {
      // Se muestra en ms por debajo del segundo: con ANIMUS_TIMEOUT_MS mal
      // puesto, `Math.round(ms/1000)` decía "superó el límite de 0 s", que
      // parece un bug del servidor en vez de una configuración del usuario.
      const legible = ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;
      throw new Error(
        `La petición a ${path} superó el límite de ${legible} y se canceló. ` +
          'Puede ser una caída del gateway o una red lenta. ' +
          'Súbelo con la variable de entorno ANIMUS_TIMEOUT_MS si tu conexión lo necesita.',
      );
    }
    throw new Error(`No se pudo contactar el gateway de Animus en ${path}: ${err?.message ?? err}`);
  } finally {
    clearTimeout(alarma);
  }

  if (!response.ok) {
    const cuerpo = await response.text().catch(() => '');
    throw traducirError(response.status, cuerpo, response.headers, metodo, path);
  }

  return await response.json();
}

export async function raasGet(path: string, queryParams?: Record<string, string | number>): Promise<any> {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  if (queryParams) {
    for (const [key, val] of Object.entries(queryParams)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    }
  }

  return pedir('GET', path, { method: 'GET', headers: cabeceras() }, url.toString());
}

export async function raasPost(path: string, body?: Record<string, unknown>): Promise<any> {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  return pedir(
    'POST',
    path,
    {
      method: 'POST',
      headers: cabeceras({ 'Content-Type': 'application/json' }),
      body: body ? JSON.stringify(body) : undefined,
    },
    url.toString(),
  );
}
