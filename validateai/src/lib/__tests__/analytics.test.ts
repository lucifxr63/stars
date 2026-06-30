import { describe, it, expect } from 'vitest';
import { sanitizeProps } from '@/lib/analytics';

/**
 * Fase 8 — garantía de privacidad de la analítica de embudo.
 * sanitizeProps es la red de seguridad que aplica trackEvent antes de enviar a
 * PostHog: si esto pasa, ningún evento del embudo puede filtrar PII por accidente.
 * Si se cambia la denylist o el corte de strings, actualizar estos tests.
 */
describe('analytics · sanitizeProps (garantía de no-PII)', () => {
  it('descarta claves con PII conocidas (case-insensitive)', () => {
    const out = sanitizeProps({
      email: 'a@b.com',
      RUT: '12.345.678-9',
      idea: 'mi gran idea secreta',
      idea_name: 'Validus',
      description: 'descripción del negocio',
      name: 'Juan Pérez',
      full_name: 'Juan Pérez',
      prompt: 'system prompt...',
      output: 'texto generado por IA',
      phone: '+56 9 1234 5678',
      password: 'hunter2',
    });
    expect(out).toEqual({});
  });

  it('conserva las propiedades permitidas del embudo', () => {
    const props = {
      source: 'landing',
      target: 'login',
      plan: 'pro',
      tier: 'premium',
      mode: 'detailed',
      method: 'email',
      page: 'pricing',
      step: 2,
      is_authenticated: true,
      has_evidence: false,
      source_status: 'reddit:success/trends:error',
      reason: 'monthly_limit',
      limit_type: 'expensive',
    };
    expect(sanitizeProps(props)).toEqual(props);
  });

  it('descarta strings largos (probable contenido libre)', () => {
    const longText = 'x'.repeat(121);
    const out = sanitizeProps({ source: 'ok', blob: longText });
    expect(out).toEqual({ source: 'ok' });
  });

  it('conserva strings de longitud razonable (<= 120)', () => {
    const ok = 'x'.repeat(120);
    expect(sanitizeProps({ note: ok })).toEqual({ note: ok });
  });

  it('descarta valores undefined', () => {
    expect(sanitizeProps({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('no muta el objeto de entrada', () => {
    const input = { email: 'a@b.com', source: 'x' };
    const snapshot = { ...input };
    sanitizeProps(input);
    expect(input).toEqual(snapshot);
  });

  it('mezcla: deja pasar solo lo seguro', () => {
    const out = sanitizeProps({ tier: 'free', email: 'a@b.com', idea_description: 'secreto', step: 1 });
    expect(out).toEqual({ tier: 'free', step: 1 });
  });
});
