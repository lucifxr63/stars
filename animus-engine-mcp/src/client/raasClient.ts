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

// Debe coincidir con la versión de package.json. Decía 1.0.0 mientras el paquete
// era 0.1.0, o sea que la telemetría del servidor atribuía el tráfico a una
// versión que no existe.
const VERSION_CLIENTE = '0.1.0';

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

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: cabeceras(),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Animus RaaS API Error (HTTP ${response.status}) on GET ${path}: ${errText}`);
  }

  return await response.json();
}

export async function raasPost(path: string, body?: Record<string, unknown>): Promise<any> {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: cabeceras({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Animus RaaS API Error (HTTP ${response.status}) on POST ${path}: ${errText}`);
  }

  return await response.json();
}
