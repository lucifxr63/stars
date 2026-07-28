// CORS compartido para las Edge Functions. Extraído de ai-validate/index.ts
// como primer paso del seam modular (#5): el monolito tenía esta lógica inline.
// Reutilizable por cualquier función que necesite los mismos orígenes permitidos.

export const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'https://animus.scouttech.lat',
  'https://cashflow.scouttech.lat',
  'https://cashflow-phi-nine.vercel.app',
  'https://denarius.scouttech.lat',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (origin || ALLOWED_ORIGINS[0]);
  const reqHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type, x-validus-signature, x-bralidus-key';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': reqHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}
