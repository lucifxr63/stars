// Invariantes de la lógica pura de ruteo de modelo (#5 W3). Las funciones con red
// (callAnthropic/OpenAI/AI, preprocessIdea) se validan byte-identical (golden hash)
// + smoke del endpoint desplegado. Correr con: deno test --allow-env
import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { usesWebSearch, selectModel } from './aiProvider.ts';

Deno.test('usesWebSearch: true solo para los prompts con búsqueda web', () => {
  for (const t of ['competitive_analysis', 'market_sizing', 'market_signals'] as const) {
    assert(usesWebSearch(t), `${t} debería usar web_search`);
  }
  for (const t of ['summary', 'questions', 'unit_economics', 'playbook_analysis'] as const) {
    assert(!usesWebSearch(t), `${t} NO debería usar web_search`);
  }
});

Deno.test('selectModel: free siempre Haiku (coste)', () => {
  assert(selectModel('summary', 'free').includes('haiku'));
  assert(selectModel('competitive_analysis', 'free').includes('haiku'));
});

Deno.test('selectModel: summary_quick siempre Haiku, sin importar tier', () => {
  assert(selectModel('summary_quick', 'pro').includes('haiku'));
});

Deno.test('selectModel: pro estándar (sin throttle) usa Sonnet', () => {
  // THROTTLE_MODE no seteado en el test → 'off'.
  assert(selectModel('summary', 'pro').includes('sonnet'));
  assert(selectModel('competitive_analysis', 'pro').includes('sonnet'));
});
