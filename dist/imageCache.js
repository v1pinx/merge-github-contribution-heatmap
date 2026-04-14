"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCacheKey = buildCacheKey;
exports.createImageCache = createImageCache;
const node_cache_1 = __importDefault(require("node-cache"));
/**
 * Builds a normalized cache key from a list of usernames.
 * Sorts alphabetically, lowercases, and joins with `+`.
 */
function buildCacheKey(usernames) {
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
function createImageCache() {
    const envTtl = process.env.CACHE_TTL_SECONDS;
    const defaultTtl = envTtl !== undefined ? parseInt(envTtl, 10) : DEFAULT_TTL_SECONDS;
    const ttl = isNaN(defaultTtl) || defaultTtl < 0 ? DEFAULT_TTL_SECONDS : defaultTtl;
    const cache = new node_cache_1.default({ stdTTL: ttl, checkperiod: 120 });
    return {
        get(key) {
            return cache.get(key);
        },
        set(key, value, ttlSeconds) {
            cache.set(key, value, ttlSeconds);
        },
        has(key) {
            return cache.has(key);
        },
    };
}
//# sourceMappingURL=imageCache.js.map