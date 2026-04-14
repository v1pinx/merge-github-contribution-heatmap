import NodeCache from 'node-cache';

/** Interface for caching rendered PNG images */
export interface ImageCache {
  get(key: string): Buffer | undefined;
  set(key: string, value: Buffer, ttlSeconds: number): void;
  has(key: string): boolean;
}

/**
 * Builds a normalized cache key from a list of usernames.
 * Sorts alphabetically, lowercases, and joins with `+`.
 */
export function buildCacheKey(usernames: string[]): string {
  return usernames
    .map((u) => u.toLowerCase())
    .sort()
    .join('+');
}

const DEFAULT_TTL_SECONDS = 3600;

/**
 * Creates an ImageCache backed by node-cache.
 * Default TTL is 3600s, overridable via CACHE_TTL_SECONDS env var.
 */
export function createImageCache(): ImageCache {
  const envTtl = process.env.CACHE_TTL_SECONDS;
  const defaultTtl = envTtl !== undefined ? parseInt(envTtl, 10) : DEFAULT_TTL_SECONDS;
  const ttl = isNaN(defaultTtl) || defaultTtl < 0 ? DEFAULT_TTL_SECONDS : defaultTtl;

  const cache = new NodeCache({ stdTTL: ttl, checkperiod: 120 });

  return {
    get(key: string): Buffer | undefined {
      return cache.get<Buffer>(key);
    },

    set(key: string, value: Buffer, ttlSeconds: number): void {
      cache.set(key, value, ttlSeconds);
    },

    has(key: string): boolean {
      return cache.has(key);
    },
  };
}
