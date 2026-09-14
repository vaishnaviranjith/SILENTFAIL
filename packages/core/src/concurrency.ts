/**
 * Runs an async mapper over items with a fixed worker count while keeping the
 * output in input order. Order stability matters: mutation reports must look the
 * same on every run, whatever the machine's scheduling does.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index] as T;
      results[index] = await mapper(item, index);
    }
  });
  await Promise.all(workers);
  return results;
}
