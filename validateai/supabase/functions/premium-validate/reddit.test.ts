import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { inferSentiment } from './reddit.ts';

Deno.test('inferSentiment clasifica por keywords y score', () => {
  assertEquals(inferSentiment('I hate this problem, so frustrated', 10), 'frustration');
  assertEquals(inferSentiment('How to solve X best way', 10), 'question');
  assertEquals(inferSentiment('I love this, amazing success', 10), 'positive');
  assertEquals(inferSentiment('Neutral title', 250), 'high_interest');
  assertEquals(inferSentiment('Neutral title', 5), 'discussion');
});
