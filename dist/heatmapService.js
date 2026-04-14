"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidationError = isValidationError;
exports.isFetchError = isFetchError;
exports.errorHandlingMiddleware = errorHandlingMiddleware;
exports.createHeatmapRouter = createHeatmapRouter;
exports.createDefaultHeatmapRouter = createDefaultHeatmapRouter;
const express_1 = require("express");
const usernameParser_1 = require("./usernameParser");
const contributionFetcher_1 = require("./contributionFetcher");
const contributionMerger_1 = require("./contributionMerger");
const heatmapRenderer_1 = require("./heatmapRenderer");
const imageCache_1 = require("./imageCache");
const config_1 = require("./config");
function isValidationError(err) {
    return typeof err === 'object' && err !== null && err.type === 'validation';
}
function isFetchError(err) {
    return typeof err === 'object' && err !== null && err.type === 'fetch';
}
/**
 * Express error-handling middleware (4-argument signature).
 * Catches any unhandled errors that slip past the route handler.
 */
function errorHandlingMiddleware(err, _req, res, _next) {
    if (isValidationError(err)) {
        const errorBody = { error: err.message };
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
        const errorBody = {
            error: isTimeout ? 'GitHub API timeout' : 'Failed to fetch contributions',
            details: [{ username: err.username, message: err.message }],
        };
        res.status(502).json(errorBody);
        return;
    }
    const errorBody = { error: 'Internal server error' };
    res.status(500).json(errorBody);
}
/**
 * Creates a heatmap router with injected dependencies for testability.
 */
function createHeatmapRouter(config, cache) {
    const router = (0, express_1.Router)();
    router.get('/:usernames', async (req, res) => {
        try {
            // 1. Parse and validate usernames
            const usernamesParam = req.params.usernames;
            const usernames = (0, usernameParser_1.parseUsernames)(Array.isArray(usernamesParam) ? usernamesParam.join('+') : usernamesParam);
            // 2. Build cache key and check cache
            const cacheKey = (0, imageCache_1.buildCacheKey)(usernames);
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
            const fetchPromises = usernames.map((username) => (0, contributionFetcher_1.fetchContributions)(username, {
                githubToken: config.githubToken,
                fetchTimeoutMs: config.fetchTimeoutMs,
            }));
            const results = await Promise.allSettled(fetchPromises);
            // Collect failures
            const failures = [];
            const datasets = [];
            let hasTimeout = false;
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.status === 'fulfilled') {
                    datasets.push(result.value);
                }
                else {
                    const err = result.reason;
                    if (isFetchError(err)) {
                        if (err.cause === 'AbortError' || err.message.includes('timed out')) {
                            hasTimeout = true;
                        }
                        failures.push({ username: err.username, message: err.message });
                    }
                    else {
                        failures.push({
                            username: usernames[i],
                            message: err instanceof Error ? err.message : String(err),
                        });
                    }
                }
            }
            if (failures.length > 0) {
                const errorBody = {
                    error: hasTimeout ? 'GitHub API timeout' : 'Failed to fetch contributions',
                    details: failures,
                };
                res.status(502).json(errorBody);
                return;
            }
            // 4. Merge contributions
            const merged = (0, contributionMerger_1.mergeContributions)(datasets);
            // 5. Render heatmap
            let pngBuffer;
            try {
                pngBuffer = await (0, heatmapRenderer_1.renderHeatmap)(merged);
            }
            catch {
                const errorBody = { error: 'Internal rendering error' };
                res.status(500).json(errorBody);
                return;
            }
            // 6. Cache the result
            cache.set(cacheKey, pngBuffer, config.cacheTtlSeconds);
            // 7. Respond with PNG
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', `public, max-age=${config.cacheTtlSeconds}`);
            res.send(pngBuffer);
        }
        catch (err) {
            if (isValidationError(err)) {
                const errorBody = { error: err.message };
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
                const errorBody = {
                    error: isTimeout ? 'GitHub API timeout' : 'Failed to fetch contributions',
                    details: [{ username: err.username, message: err.message }],
                };
                res.status(502).json(errorBody);
                return;
            }
            const errorBody = { error: 'Internal server error' };
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
function createDefaultHeatmapRouter() {
    const config = (0, config_1.loadConfig)();
    const cache = (0, imageCache_1.createImageCache)();
    return createHeatmapRouter(config, cache);
}
//# sourceMappingURL=heatmapService.js.map