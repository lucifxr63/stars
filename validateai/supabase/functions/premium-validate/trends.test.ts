import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { trajectoryOf } from './trends.ts';

Deno.test('trajectoryOf: subida / bajada / estable / vacío', () => {
  assertEquals(trajectoryOf([1, 1, 1, 10, 10, 10]), 'upward');
  assertEquals(trajectoryOf([10, 10, 10, 1, 1, 1]), 'downward');
  assertEquals(trajectoryOf([5, 5, 5, 5, 5, 5]), 'stable');
  assertEquals(trajectoryOf([]), 'stable');
});
