import { ContributionDay, ContributionLevel } from './types';
/**
 * Maps a contribution count to a ContributionLevel.
 * Thresholds are based on quartiles of a typical contribution distribution.
 */
export declare function getContributionLevel(count: number): ContributionLevel;
/**
 * Computes the grid position (row, col) for a given date relative to a start date.
 * Row = day of week (0=Sunday, 6=Saturday)
 * Col = week offset from the start date's week
 */
export declare function getGridPosition(date: Date, startDate: Date): {
    row: number;
    col: number;
};
/**
 * Renders a GitHub-style contribution heatmap as a PNG buffer.
 */
export declare function renderHeatmap(contributions: ContributionDay[]): Promise<Buffer>;
//# sourceMappingURL=heatmapRenderer.d.ts.map