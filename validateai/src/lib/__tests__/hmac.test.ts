import { describe, it, expect } from 'vitest';
import { computeHmacSha256, verifyLsSignature } from '../hmac';

const SECRET = 'test-webhook-secret-1234';
const BODY   = '{"meta":{"event_name":"subscription_created"},"data":{"id":"sub_abc123"}}';

// ── computeHmacSha256 ─────────────────────────────────────────────────────────

describe('computeHmacSha256', () => {
  it('produce un hash hex de 64 caracteres (SHA-256 → 32 bytes)', async () => {
    const sig = await computeHmacSha256(SECRET, BODY);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it('es determinista — mismos inputs producen mismo hash', async () => {
    const sig1 = await computeHmacSha256(SECRET, BODY);
    const sig2 = await computeHmacSha256(SECRET, BODY);
    expect(sig1).toBe(sig2);
  });

  it('cambia si el secret cambia', async () => {
    const sig1 = await computeHmacSha256(SECRET, BODY);
    const sig2 = await computeHmacSha256('otro-secret', BODY);
    expect(sig1).not.toBe(sig2);
  });

  it('cambia si el body cambia', async () => {
    const sig1 = await computeHmacSha256(SECRET, BODY);
    const sig2 = await computeHmacSha256(SECRET, BODY + ' ');
    expect(sig1).not.toBe(sig2);
  });

  it('body vacío produce hash válido (no lanza)', async () => {
    const sig = await computeHmacSha256(SECRET, '');
    expect(sig).toHaveLength(64);
  });
});

// ── verifyLsSignature ─────────────────────────────────────────────────────────

describe('verifyLsSignature', () => {
  it('acepta la firma correcta', async () => {
    const sig = await computeHmacSha256(SECRET, BODY);
    const ok  = await verifyLsSignature(sig, BODY, SECRET);
    expect(ok).toBe(true);
  });

  it('rechaza firma null (header ausente)', async () => {
    const ok = await verifyLsSignature(null, BODY, SECRET);
    expect(ok).toBe(false);
  });

  it('rechaza firma vacía', async () => {
    const ok = await verifyLsSignature('', BODY, SECRET);
    expect(ok).toBe(false);
  });

  it('rechaza firma incorrecta', async () => {
    const ok = await verifyLsSignature('aaabbbccc', BODY, SECRET);
    expect(ok).toBe(false);
  });

  it('rechaza firma correcta con body alterado', async () => {
    const sig = await computeHmacSha256(SECRET, BODY);
    const ok  = await verifyLsSignature(sig, BODY + '!', SECRET);
    expect(ok).toBe(false);
  });

  it('rechaza firma correcta con secret diferente', async () => {
    const sigConOtroSecret = await computeHmacSha256('secret-falso', BODY);
    const ok = await verifyLsSignature(sigConOtroSecret, BODY, SECRET);
    expect(ok).toBe(false);
  });

  it('es sensible a mayúsculas en la firma (hex lowercase)', async () => {
    const sig = await computeHmacSha256(SECRET, BODY);
    // Las signaturas en uppercase no deberían matchear si el hash es lowercase
    const ok = await verifyLsSignature(sig.toUpperCase(), BODY, SECRET);
    expect(ok).toBe(false);
  });
});
