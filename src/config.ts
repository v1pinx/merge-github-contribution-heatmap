import { ServiceConfig } from './types';

export function loadConfig(): ServiceConfig {
  const githubToken = process.env.GITHUB_TOKEN ?? '';
  const cacheTtlSeconds = parseInt(process.env.CACHE_TTL_SECONDS ?? '3600', 10);
  const fetchTimeoutMs = parseInt(process.env.FETCH_TIMEOUT_MS ?? '10000', 10);
  const port = parseInt(process.env.PORT ?? '3000', 10);

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  if (isNaN(cacheTtlSeconds) || cacheTtlSeconds < 0) {
    throw new Error('CACHE_TTL_SECONDS must be a non-negative number');
  }

  if (isNaN(fetchTimeoutMs) || fetchTimeoutMs < 0) {
    throw new Error('FETCH_TIMEOUT_MS must be a non-negative number');
  }

  if (isNaN(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be a number between 0 and 65535');
  }

  return {
    githubToken,
    cacheTtlSeconds,
    fetchTimeoutMs,
    port,
  };
}
