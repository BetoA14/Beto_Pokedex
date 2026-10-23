interface CacheOptions {
  ttlMs: number
  maxEntries: number
  now?: () => number
}

// Each loader owns its cache. Only successful loads are stored.
export function createCachedLoader<T>(
  load: (key: string) => Promise<T>,
  { ttlMs, maxEntries, now = Date.now }: CacheOptions,
) {
  const cache = new Map<string, { value: T; expiresAt: number }>()
  const pending = new Map<string, Promise<T>>()

  return async function get(key: string): Promise<T> {
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now()) {
      return cached.value
    }
    cache.delete(key)

    const existingRequest = pending.get(key)
    if (existingRequest) return existingRequest

    // Defer loading until after registering the promise, even for synchronous throws.
    const request = Promise.resolve().then(() => load(key)).then((value) => {
      for (const [entryKey, entry] of cache) {
        if (entry.expiresAt <= now()) cache.delete(entryKey)
      }
      if (cache.size >= maxEntries) {
        const oldestKey = cache.keys().next().value
        if (oldestKey !== undefined) cache.delete(oldestKey)
      }
      cache.set(key, { value, expiresAt: now() + ttlMs })
      return value
    })

    pending.set(key, request)
    try {
      return await request
    } finally {
      pending.delete(key)
    }
  }
}
