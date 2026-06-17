import { describe, it, expect } from 'vitest';
import { getUserSections, ALL_SECTIONS } from '@/hooks/useUserTier';

/**
 * Contrato de gating por tier (#10): qué secciones ve cada plan. Es lógica
 * money-adjacent — una regresión acá expone features de pago a free o esconde
 * lo que el free debería ver. Bloqueamos el contrato con tests.
 */
describe('getUserSections — gating por tier', () => {
  it('free ve exactamente las 4 secciones base', () => {
    expect(getUserSections('free').sort()).toEqual(
      ['breakdown', 'nextSteps', 'questions', 'score'],
    );
  });

  it('free NO incluye análisis de pago', () => {
    const free = getUserSections('free');
    for (const paid of ['competitiveAnalysis', 'marketSizing', 'unitEconomics', 'founderFit', 'governance', 'fundraising']) {
      expect(free).not.toContain(paid);
    }
  });

  it('basic añade competitiveAnalysis/valueProposition/client sobre free', () => {
    const basic = getUserSections('basic');
    expect(basic).toEqual(expect.arrayContaining(['competitiveAnalysis', 'valueProposition', 'client']));
    // pero sigue sin las secciones Pro
    expect(basic).not.toContain('unitEconomics');
    expect(basic).not.toContain('marketSizing');
  });

  it('pro, premium y admin ven TODAS las secciones', () => {
    for (const tier of ['pro', 'premium', 'admin'] as const) {
      expect(getUserSections(tier)).toEqual(ALL_SECTIONS);
    }
  });

  it('cada sección de free es subconjunto de las de basic (gating monótono)', () => {
    const free = getUserSections('free');
    const basic = getUserSections('basic');
    for (const s of free) expect(basic).toContain(s);
  });
});
