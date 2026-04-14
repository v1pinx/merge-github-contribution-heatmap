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
export declare function buildCacheKey(usernames: string[]): string;
/**
 * Creates an ImageCache backed by node-cache.
 * Default TTL is 3600s, overridable via CACHE_TTL_SECONDS env var.
 */
export declare function createImageCache(): ImageCache;
//# sourceMappingURL=imageCache.d.ts.map