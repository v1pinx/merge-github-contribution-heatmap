import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHeatmapRouter, errorHandlingMiddleware } from './heatmapService';
import { ServiceConfig, FetchError, ValidationError } from './types';
import { ImageCache } from './imageCache';

// Mock dependencies
vi.mock('./contributionFetcher', () => ({
  fetchContributions: vi.fn(),
}));

vi.mock('./contributionMerger', () => ({
  mergeContributions: vi.fn(),
}));

vi.mock('./heatmapRenderer', () => ({
  renderHeatmap: vi.fn(),
}));

import { fetchContributions } from './contributionFetcher';
import { mergeContributions } from './contributionMerger';
import { renderHeatmap } from './heatmapRenderer';

const mockFetch = vi.mocked(fetchContributions);
const mockMerge = vi.mocked(mergeContributions);
const mockRender = vi.mocked(renderHeatmap);

function createTestConfig(): ServiceConfig {
  return {
    githubToken: 'test-token',
    cacheTtlSeconds: 3600,
    fetchTimeoutMs: 10000,
    port: 3000,
  };
}

function createTestCache(): ImageCache {
  const store = new Map<string, Buffer>();
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: Buffer, _ttl: number) => { store.set(key, value); },
    has: (key: string) => store.has(key),
  };
}

function createApp(config?: ServiceConfig, cache?: ImageCache) {
  const app = express();
  const router = createHeatmapRouter(config ?? createTestConfig(), cache ?? createTestCache());
  app.use(router);
  return app;
}

describe('Error handling - validation errors (Req 5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for empty username list', async () => {
    const app = createApp();
    // An empty path segment won't match /:usernames, so we test with a space-like invalid input
    // Actually, express won't route to /:usernames with empty string. Let's test via the parser.
    // The parser throws for empty strings, but express routing means '' won't match.
    // We can test with a username that's just '+' which splits to empty strings.
    const res = await request(app).get('/+');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 with details for invalid characters in username', async () => {
    const app = createApp();
    const res = await request(app).get('/valid+inv@lid');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Invalid username');
    expect(res.body.details).toBeDefined();
    expect(res.body.details.length).toBeGreaterThan(0);
    expect(res.body.details[0]).toHaveProperty('username', 'inv@lid');
  });
});

describe('Error handling - GitHub API errors (Req 5.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 502 when a single fetch fails', async () => {
    const fetchErr: FetchError = {
      type: 'fetch',
      username: 'baduser',
      message: 'User not found: baduser',
    };
    mockFetch.mockRejectedValueOnce(fetchErr);

    const app = createApp();
    const res = await request(app).get('/baduser');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Failed to fetch contributions');
    expect(res.body.details).toEqual([
      { username: 'baduser', message: 'User not found: baduser' },
    ]);
  });

  it('aggregates multiple fetch failures into a single 502 response', async () => {
    const err1: FetchError = {
      type: 'fetch',
      username: 'user1',
      message: 'User not found: user1',
    };
    const err2: FetchError = {
      type: 'fetch',
      username: 'user2',
      message: 'GitHub API returned HTTP 403',
    };
    mockFetch.mockRejectedValueOnce(err1);
    mockFetch.mockRejectedValueOnce(err2);

    const app = createApp();
    const res = await request(app).get('/user1+user2');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Failed to fetch contributions');
    expect(res.body.details).toHaveLength(2);
    expect(res.body.details).toEqual([
      { username: 'user1', message: 'User not found: user1' },
      { username: 'user2', message: 'GitHub API returned HTTP 403' },
    ]);
  });

  it('returns 502 with timeout error message for timeout failures', async () => {
    const timeoutErr: FetchError = {
      type: 'fetch',
      username: 'slowuser',
      message: 'Request timed out after 10000ms',
      cause: 'AbortError',
    };
    mockFetch.mockRejectedValueOnce(timeoutErr);

    const app = createApp();
    const res = await request(app).get('/slowuser');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('GitHub API timeout');
    expect(res.body.details).toEqual([
      { username: 'slowuser', message: 'Request timed out after 10000ms' },
    ]);
  });

  it('aggregates mixed failures: some succeed, some fail', async () => {
    mockFetch.mockResolvedValueOnce([{ date: '2024-01-01', count: 5 }]);
    const err: FetchError = {
      type: 'fetch',
      username: 'failuser',
      message: 'User not found: failuser',
    };
    mockFetch.mockRejectedValueOnce(err);

    const app = createApp();
    const res = await request(app).get('/gooduser+failuser');
    expect(res.status).toBe(502);
    expect(res.body.details).toHaveLength(1);
    expect(res.body.details[0].username).toBe('failuser');
  });
});

describe('Error handling - internal rendering errors (Req 5.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 500 for internal rendering error', async () => {
    mockFetch.mockResolvedValueOnce([{ date: '2024-01-01', count: 1 }]);
    mockMerge.mockReturnValueOnce([{ date: '2024-01-01', count: 1 }]);
    mockRender.mockRejectedValueOnce(new Error('Canvas failed'));

    const app = createApp();
    const res = await request(app).get('/someuser');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal rendering error' });
  });
});

describe('errorHandlingMiddleware', () => {
  it('handles ValidationError with 400', () => {
    const err: ValidationError = {
      type: 'validation',
      message: 'Invalid username(s): b@d',
      invalidUsernames: ['b@d'],
    };
    const req = {} as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    errorHandlingMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid username(s): b@d',
      details: [{ username: 'b@d', message: 'Invalid username' }],
    });
  });

  it('handles FetchError with 502', () => {
    const err: FetchError = {
      type: 'fetch',
      username: 'testuser',
      message: 'User not found: testuser',
    };
    const req = {} as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    errorHandlingMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to fetch contributions',
      details: [{ username: 'testuser', message: 'User not found: testuser' }],
    });
  });

  it('handles unknown errors with 500', () => {
    const err = new Error('something broke');
    const req = {} as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    errorHandlingMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
