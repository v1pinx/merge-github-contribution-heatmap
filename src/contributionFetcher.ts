import fetch from 'node-fetch';
import { ContributionDay, FetchError } from './types';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

const CONTRIBUTIONS_QUERY = `
  query($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

/**
 * Extracts ContributionDay entries from a raw GitHub GraphQL response body.
 * Exported separately for independent testing (Property 2).
 */
export function extractContributionDays(responseBody: unknown): ContributionDay[] {
  const body = responseBody as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            weeks?: Array<{
              contributionDays?: Array<{
                date?: string;
                contributionCount?: number;
              }>;
            }>;
          };
        };
      };
    };
  };

  const weeks = body?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) {
    throw createFetchError('unknown', 'Invalid response structure: missing contribution weeks');
  }

  const days: ContributionDay[] = [];
  for (const week of weeks) {
    if (!Array.isArray(week.contributionDays)) continue;
    for (const day of week.contributionDays) {
      if (typeof day.date === 'string' && typeof day.contributionCount === 'number') {
        days.push({ date: day.date, count: day.contributionCount });
      }
    }
  }

  return days;
}

function createFetchError(username: string, message: string, cause?: string): FetchError {
  return { type: 'fetch', username, message, cause };
}

/**
 * Fetches contribution data for a single GitHub user via the GraphQL API.
 */
export async function fetchContributions(
  username: string,
  config: { githubToken: string; fetchTimeoutMs: number },
): Promise<ContributionDay[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.fetchTimeoutMs);

  try {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `bearer ${config.githubToken}`,
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: { username },
      }),
      signal: controller.signal as any,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw createFetchError(
        username,
        `GitHub API returned HTTP ${response.status}`,
        text || undefined,
      );
    }

    const json = await response.json();
    const body = json as {
      errors?: Array<{ message: string }>;
      data?: { user?: unknown };
    };

    if (body.errors && body.errors.length > 0) {
      throw createFetchError(
        username,
        `GitHub API error: ${body.errors[0].message}`,
        body.errors.map((e) => e.message).join('; '),
      );
    }

    if (!body.data?.user) {
      throw createFetchError(username, `User not found: ${username}`);
    }

    return extractContributionDays(json);
  } catch (err: unknown) {
    if ((err as FetchError).type === 'fetch') {
      throw err;
    }

    if (err instanceof Error && err.name === 'AbortError') {
      throw createFetchError(
        username,
        `Request timed out after ${config.fetchTimeoutMs}ms`,
        'AbortError',
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    throw createFetchError(username, `Failed to fetch contributions for ${username}`, message);
  } finally {
    clearTimeout(timeoutId);
  }
}
