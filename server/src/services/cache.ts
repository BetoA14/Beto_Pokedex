// ttlMs controls freshness; now can be replaced to test expiry without waiting.
interface CacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

// T is the loaded value's type. Each loader keeps its own successful results in memory.
export function createCachedLoader<T>(
  load: (key: string) => Promise<T>,
  { ttlMs, maxEntries, now = Date.now }: CacheOptions,
) {
  const cache = new Map<string, { value: T; expiresAt: number }>();
  // Share unfinished loads so simultaneous callers do not duplicate work.
  const pending = new Map<string, Promise<T>>();

  return async function get(key: string): Promise<T> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) {
      return cached.value;
    }
    // Expired entries must be reloaded before they can be returned.
    cache.delete(key);

    const existingRequest = pending.get(key);
    if (existingRequest) return existingRequest;

    // Defer loading until after registering the promise, even for synchronous throws.
    const request = Promise.resolve()
      .then(() => load(key))
      .then((value) => {
        // Remove expired values before deciding whether the cache needs room.
        for (const [entryKey, entry] of cache) {
          if (entry.expiresAt <= now()) cache.delete(entryKey);
        }
        if (cache.size >= maxEntries) {
          // Map preserves insertion order; evict the oldest stored value.
          const oldestKey = cache.keys().next().value;
          if (oldestKey !== undefined) cache.delete(oldestKey);
        }
        // Start the lifetime when loading succeeds, not when the request began.
        cache.set(key, { value, expiresAt: now() + ttlMs });
        return value;
      });

    pending.set(key, request);
    try {
      return await request;
    } finally {
      // Clear successful and failed loads so future requests can run when needed.
      pending.delete(key);
    }
  };
}
