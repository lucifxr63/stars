// Cliente HTTP canónico para Animus Engine / Bralidus RaaS API Gateway v1
// Conecta a https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1

const DEFAULT_BASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1';

export function getApiKey(): string {
  return (
    process.env.ANIMUS_API_KEY ||
    process.env.BRALIDUS_API_KEY ||
    'demo_public_key'
  );
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
