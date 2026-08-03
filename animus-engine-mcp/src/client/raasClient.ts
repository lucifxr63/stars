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
      'Falta ANIMUS_API_KEY. Obtené una en https://bralidus.vercel.app y agregala ' +
        'al bloque "env" de tu configuración MCP:\n' +
        '  "env": { "ANIMUS_API_KEY": "tu_clave" }',
    );
  }
  return key.trim();
}

export function getBaseUrl(): string {
  return process.env.ANIMUS_GATEWAY_URL || DEFAULT_BASE_URL;
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

  // Siempre enviar apikey como fallback en query o header
  const apiKey = getApiKey();
  if (!url.searchParams.has('apikey')) {
    url.searchParams.set('apikey', apiKey);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'X-Client': 'Animus-Engine-MCP/1.0.0',
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Animus RaaS API Error (HTTP ${response.status}) on GET ${path}: ${errText}`);
  }

  return await response.json();
}

export async function raasPost(path: string, body?: Record<string, unknown>): Promise<any> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  if (!url.searchParams.has('apikey')) {
    url.searchParams.set('apikey', apiKey);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client': 'Animus-Engine-MCP/1.0.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Animus RaaS API Error (HTTP ${response.status}) on POST ${path}: ${errText}`);
  }

  return await response.json();
}
