/**
 * Runs an array of async task factories sequentially with a delay between each.
 * Prevents concurrent API rate limit errors (429) from services like Anthropic.
 */
export async function runThrottled<T>(
  factories: Array<() => Promise<T>>,
  delayMs = 600,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < factories.length; i++) {
    try {
      results.push({ status: 'fulfilled', value: await factories[i]() });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
    if (delayMs > 0 && i < factories.length - 1) {
      await new Promise<void>(r => setTimeout(r, delayMs));
    }
  }
  return results;
}
