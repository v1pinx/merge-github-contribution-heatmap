import { Router, Request, Response, NextFunction } from 'express';
import { parseUsernames } from './usernameParser';
import { fetchContributions } from './contributionFetcher';
import { mergeContributions } from './contributionMerger';
import { renderHeatmap } from './heatmapRenderer';
import { ImageCache, buildCacheKey, createImageCache } from './imageCache';
import { loadConfig } from './config';
import { ServiceConfig, ValidationError, FetchError, ErrorResponse, ContributionDay } from './types';

export function isValidationError(err: unknown): err is ValidationError {
  return typeof err === 'object' && err !== null && (err as ValidationError).type === 'validation';
}

export function isFetchError(err: unknown): err is FetchError {
  return typeof err === 'object' && err !== null && (err as FetchError).type === 'fetch';
}

/**
 * Express error-handling middleware (4-argument signature).
 * Catches any unhandled errors that slip past the route handler.
 */
export function errorHandlingMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isValidationError(err)) {
    const errorBody: ErrorResponse = { error: err.message };
    if (err.invalidUsernames && err.invalidUsernames.length > 0) {
      errorBody.details = err.invalidUsernames.map((u) => ({
        username: u,
        message: 'Invalid username',
      }));
    }
    res.status(400).json(errorBody);
    return;
  }

  if (isFetchError(err)) {
    const isTimeout = err.cause === 'AbortError' || err.message.includes('timed out');
    const errorBody: ErrorResponse = {
      error: isTimeout ? 'GitHub API timeout' : 'Failed to fetch contributions',
      details: [{ username: err.username, message: err.message }],
    };
    res.status(502).json(errorBody);
    return;
  }

  const errorBody: ErrorResponse = { error: 'Internal server error' };
  res.status(500).json(errorBody);
}

/**
 * Creates a heatmap router with injected dependencies for testability.
 */
export function createHeatmapRouter(config: ServiceConfig, cache: ImageCache): Router {
  const router = Router();

  router.get('/:usernames', async (req: Request, res: Response) => {
    try {
      // 1. Parse and validate usernames
      const usernamesParam = req.params.usernames;
      const usernames = parseUsernames(Array.isArray(usernamesParam) ? usernamesParam.join('+') : usernamesParam);

      // 2. Build cache key and check cache
      const cacheKey = buildCacheKey(usernames);
      const cached = cache.get(cacheKey);

      if (cached) {
        const remainingTtl = Math.max(0, config.cacheTtlSeconds);
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', `public, max-age=${remainingTtl}`);
        res.send(cached);
        return;
      }

      // 3. Fetch contributions concurrently using Promise.allSettled
      //    to aggregate multiple failures into a single 502 response
      const fetchPromises = usernames.map((username) =>
        fetchContributions(username, {
          githubToken: config.githubToken,
          fetchTimeoutMs: config.fetchTimeoutMs,
        }),
      );

      const results = await Promise.allSettled(fetchPromises);

      // Collect failures
      const failures: Array<{ username: string; message: string }> = [];
      const datasets: ContributionDay[][] = [];
      let hasTimeout = false;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          datasets.push(result.value);
        } else {
          const err = result.reason;
          if (isFetchError(err)) {
            if (err.cause === 'AbortError' || err.message.includes('timed out')) {
              hasTimeout = true;
            }
            failures.push({ username: err.username, message: err.message });
          } else {
            failures.push({
              username: usernames[i],
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (failures.length > 0) {
        const errorBody: ErrorResponse = {
          error: hasTimeout ? 'GitHub API timeout' : 'Failed to fetch contributions',
          details: failures,
        };
        res.status(502).json(errorBody);
        return;
      }

      // 4. Merge contributions
      const merged = mergeContributions(datasets);

      // 5. Render heatmap
      let pngBuffer: Buffer;
      try {
        pngBuffer = await renderHeatmap(merged);
      } catch {
        const errorBody: ErrorResponse = { error: 'Internal rendering error' };
        res.status(500).json(errorBody);
        return;
      }

      // 6. Cache the result
      cache.set(cacheKey, pngBuffer, config.cacheTtlSeconds);

      // 7. Respond with PNG
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', `public, max-age=${config.cacheTtlSeconds}`);
      res.send(pngBuffer);
    } catch (err: unknown) {
      if (isValidationError(err)) {
        const errorBody: ErrorResponse = { error: err.message };
        if (err.invalidUsernames && err.invalidUsernames.length > 0) {
          errorBody.details = err.invalidUsernames.map((u) => ({
            username: u,
            message: 'Invalid username',
          }));
        }
        res.status(400).json(errorBody);
        return;
      }

      if (isFetchError(err)) {
        const isTimeout = err.cause === 'AbortError' || err.message.includes('timed out');
        const errorBody: ErrorResponse = {
          error: isTimeout ? 'GitHub API timeout' : 'Failed to fetch contributions',
          details: [{ username: err.username, message: err.message }],
        };
        res.status(502).json(errorBody);
        return;
      }

      const errorBody: ErrorResponse = { error: 'Internal server error' };
      res.status(500).json(errorBody);
    }
  });

  // Attach error-handling middleware to the router
  router.use(errorHandlingMiddleware);

  return router;
}

/**
 * Creates a default heatmap router using environment-based config and a fresh cache.
 */
export function createDefaultHeatmapRouter(): Router {
  const config = loadConfig();
  const cache = createImageCache();
  return createHeatmapRouter(config, cache);
}
