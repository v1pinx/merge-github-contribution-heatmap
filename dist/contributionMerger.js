"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeContributions = mergeContributions;
/**
 * Generates an array of ISO date strings covering the past year
 * (from today - 365 days through today, inclusive).
 * Accounts for leap years by always generating from exactly 365 days ago.
 */
function generatePastYearDates() {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1); // start from (today - 1 year + 1 day) to today inclusive
    const current = new Date(start);
    while (current <= today) {
        dates.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
/**
 * Merges multiple ContributionDay arrays (one per account) into a single array
 * covering the full past year. Contribution counts are summed per date across
 * all accounts. Missing dates in any account are treated as zero.
 */
function mergeContributions(datasets) {
    // Build a map of date -> summed count from all datasets
    const countMap = new Map();
    for (const dataset of datasets) {
        for (const day of dataset) {
            countMap.set(day.date, (countMap.get(day.date) ?? 0) + day.count);
        }
    }
    // Generate the full date range and produce the merged result
    const fullDates = generatePastYearDates();
    return fullDates.map((date) => ({
        date,
        count: countMap.get(date) ?? 0,
    }));
}
//# sourceMappingURL=contributionMerger.js.map