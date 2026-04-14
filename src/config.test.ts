import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when GITHUB_TOKEN is missing', () => {
    delete process.env.GITHUB_TOKEN;
    expect(() => loadConfig()).toThrow('GITHUB_TOKEN environment variable is required');
  });

  it('loads defaults when only GITHUB_TOKEN is set', () => {
    process.env.GITHUB_TOKEN = 'ghp_test123';
    const config = loadConfig();
    expect(config.githubToken).toBe('ghp_test123');
    expect(config.cacheTtlSeconds).toBe(3600);
    expect(config.fetchTimeoutMs).toBe(10000);
    expect(config.port).toBe(3000);
  });

  it('loads custom values from environment variables', () => {
    process.env.GITHUB_TOKEN = 'ghp_custom';
    process.env.CACHE_TTL_SECONDS = '7200';
    process.env.FETCH_TIMEOUT_MS = '5000';
    process.env.PORT = '8080';
    const config = loadConfig();
    expect(config.githubToken).toBe('ghp_custom');
    expect(config.cacheTtlSeconds).toBe(7200);
    expect(config.fetchTimeoutMs).toBe(5000);
    expect(config.port).toBe(8080);
  });

  it('throws for invalid CACHE_TTL_SECONDS', () => {
    process.env.GITHUB_TOKEN = 'ghp_test';
    process.env.CACHE_TTL_SECONDS = 'not-a-number';
    expect(() => loadConfig()).toThrow('CACHE_TTL_SECONDS must be a non-negative number');
  });

  it('throws for invalid PORT', () => {
    process.env.GITHUB_TOKEN = 'ghp_test';
    process.env.PORT = '99999';
    expect(() => loadConfig()).toThrow('PORT must be a number between 0 and 65535');
  });
});
