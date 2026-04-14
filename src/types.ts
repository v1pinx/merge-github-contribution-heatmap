/** A single day's contribution count */
export interface ContributionDay {
  date: string;       // ISO 8601 date string, e.g. "2024-06-15"
  count: number;      // Total contribution count for this date (>= 0)
}

/** Error returned when username validation fails */
export interface ValidationError {
  type: 'validation';
  message: string;
  invalidUsernames?: string[];
}

/** Error returned when GitHub API fetch fails */
export interface FetchError {
  type: 'fetch';
  username: string;
  message: string;
  cause?: string;
}

/** Error response body for HTTP error responses */
export interface ErrorResponse {
  error: string;
  details?: Array<{
    username: string;
    message: string;
  }>;
}

/** Configuration for the service */
export interface ServiceConfig {
  githubToken: string;
  cacheTtlSeconds: number;   // default: 3600
  fetchTimeoutMs: number;    // default: 10000
  port: number;              // default: 3000
}

/** Color scale levels for heatmap rendering */
export enum ContributionLevel {
  None = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  VeryHigh = 4,
}
