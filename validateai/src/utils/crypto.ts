/**
 * Generates a secure random API key.
 * Format: val_live_[32 random hex characters]
 */
export function generateApiKey(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `val_live_${hex}`;
}

/**
 * Computes the SHA-256 hash of an API key using the Web Crypto API.
 * @param apiKey The plain text API key
 * @returns The SHA-256 hash in hexadecimal format
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
