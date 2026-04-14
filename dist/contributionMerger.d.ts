import { ContributionDay } from './types';
/**
 * Merges multiple ContributionDay arrays (one per account) into a single array
 * covering the full past year. Contribution counts are summed per date across
 * all accounts. Missing dates in any account are treated as zero.
 */
export declare function mergeContributions(datasets: ContributionDay[][]): ContributionDay[];
//# sourceMappingURL=contributionMerger.d.ts.map