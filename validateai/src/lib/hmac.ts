/**
 * HMAC-SHA256 utilities — isomorfos entre Node (>=18) y Deno (Web Crypto API).
 * Extraído del webhook lemonsqueezy para poder testearse en Vitest.
 */

/**
 * Computa la firma HMAC-SHA256 de un mensaje usando la clave dada.
 * Devuelve la firma en formato hex lowercase.
 */
export async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifica que el header X-Signature coincide con el HMAC del body.
 * Replica la lógica de verifySignature en lemonsqueezy-webhook/index.ts.
 */
export async function verifyLsSignature(
  signature: string | null,
  body: string,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await computeHmacSha256(secret, body);
  return signature === expected;
}
