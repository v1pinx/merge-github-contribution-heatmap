import { ContributionDay } from './types';
/**
 * Extracts ContributionDay entries from a raw GitHub GraphQL response body.
 * Exported separately for independent testing (Property 2).
 */
export declare function extractContributionDays(responseBody: unknown): ContributionDay[];
/**
 * Fetches contribution data for a single GitHub user via the GraphQL API.
 */
export declare function fetchContributions(username: string, config: {
    githubToken: string;
    fetchTimeoutMs: number;
}): Promise<ContributionDay[]>;
//# sourceMappingURL=contributionFetcher.d.ts.map