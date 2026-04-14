"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractContributionDays = extractContributionDays;
exports.fetchContributions = fetchContributions;
const node_fetch_1 = __importDefault(require("node-fetch"));
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
function extractContributionDays(responseBody) {
    const body = responseBody;
    const weeks = body?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!Array.isArray(weeks)) {
        throw createFetchError('unknown', 'Invalid response structure: missing contribution weeks');
    }
    const days = [];
    for (const week of weeks) {
        if (!Array.isArray(week.contributionDays))
            continue;
        for (const day of week.contributionDays) {
            if (typeof day.date === 'string' && typeof day.contributionCount === 'number') {
                days.push({ date: day.date, count: day.contributionCount });
            }
        }
    }
    return days;
}
function createFetchError(username, message, cause) {
    return { type: 'fetch', username, message, cause };
}
/**
 * Fetches contribution data for a single GitHub user via the GraphQL API.
 */
async function fetchContributions(username, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
    try {
        const response = await (0, node_fetch_1.default)(GITHUB_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `bearer ${config.githubToken}`,
            },
            body: JSON.stringify({
                query: CONTRIBUTIONS_QUERY,
                variables: { username },
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw createFetchError(username, `GitHub API returned HTTP ${response.status}`, text || undefined);
        }
        const json = await response.json();
        const body = json;
        if (body.errors && body.errors.length > 0) {
            throw createFetchError(username, `GitHub API error: ${body.errors[0].message}`, body.errors.map((e) => e.message).join('; '));
        }
        if (!body.data?.user) {
            throw createFetchError(username, `User not found: ${username}`);
        }
        return extractContributionDays(json);
    }
    catch (err) {
        if (err.type === 'fetch') {
            throw err;
        }
        if (err instanceof Error && err.name === 'AbortError') {
            throw createFetchError(username, `Request timed out after ${config.fetchTimeoutMs}ms`, 'AbortError');
        }
        const message = err instanceof Error ? err.message : String(err);
        throw createFetchError(username, `Failed to fetch contributions for ${username}`, message);
    }
    finally {
        clearTimeout(timeoutId);
    }
}
//# sourceMappingURL=contributionFetcher.js.map