import { Router, Request, Response, NextFunction } from 'express';
import { ImageCache } from './imageCache';
import { ServiceConfig, ValidationError, FetchError } from './types';
export declare function isValidationError(err: unknown): err is ValidationError;
export declare function isFetchError(err: unknown): err is FetchError;
/**
 * Express error-handling middleware (4-argument signature).
 * Catches any unhandled errors that slip past the route handler.
 */
export declare function errorHandlingMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void;
/**
 * Creates a heatmap router with injected dependencies for testability.
 */
export declare function createHeatmapRouter(config: ServiceConfig, cache: ImageCache): Router;
/**
 * Creates a default heatmap router using environment-based config and a fresh cache.
 */
export declare function createDefaultHeatmapRouter(): Router;
//# sourceMappingURL=heatmapService.d.ts.map