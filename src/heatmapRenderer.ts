import { createCanvas } from '@napi-rs/canvas';
import { ContributionDay, ContributionLevel } from './types';

/** 5-level color scale matching GitHub's contribution graph */
const COLOR_SCALE: Record<ContributionLevel, string> = {
  [ContributionLevel.None]: '#ebedf0',
  [ContributionLevel.Low]: '#9be9a8',
  [ContributionLevel.Medium]: '#40c463',
  [ContributionLevel.High]: '#30a14e',
  [ContributionLevel.VeryHigh]: '#216e39',
};

/** Cell size in pixels */
const CELL_SIZE = 11;
/** Gap between cells */
const CELL_GAP = 3;
/** Top margin for month labels */
const TOP_MARGIN = 20;
/** Left margin */
const LEFT_MARGIN = 10;
/** Bottom margin */
const BOTTOM_MARGIN = 10;
/** Right margin */
const RIGHT_MARGIN = 10;

/**
 * Maps a contribution count to a ContributionLevel.
 * Thresholds are based on quartiles of a typical contribution distribution.
 */
export function getContributionLevel(count: number): ContributionLevel {
  if (count <= 0) return ContributionLevel.None;
  if (count <= 3) return ContributionLevel.Low;
  if (count <= 6) return ContributionLevel.Medium;
  if (count <= 9) return ContributionLevel.High;
  return ContributionLevel.VeryHigh;
}

/**
 * Computes the grid position (row, col) for a given date relative to a start date.
 * Row = day of week (0=Sunday, 6=Saturday)
 * Col = week offset from the start date's week
 */
export function getGridPosition(date: Date, startDate: Date): { row: number; col: number } {
  const row = date.getUTCDay();

  // Calculate the Sunday of the start date's week
  const startDay = startDate.getUTCDay();
  const startWeekSunday = new Date(startDate);
  startWeekSunday.setUTCDate(startWeekSunday.getUTCDate() - startDay);
  startWeekSunday.setUTCHours(0, 0, 0, 0);

  // Calculate the Sunday of the given date's week
  const dateDay = date.getUTCDay();
  const dateWeekSunday = new Date(date);
  dateWeekSunday.setUTCDate(dateWeekSunday.getUTCDate() - dateDay);
  dateWeekSunday.setUTCHours(0, 0, 0, 0);

  const diffMs = dateWeekSunday.getTime() - startWeekSunday.getTime();
  const col = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  return { row, col };
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Computes month label positions for the heatmap grid.
 * Returns an array of { label, col } indicating where each month label should appear.
 */
function getMonthLabels(startDate: Date, totalWeeks: number): Array<{ label: string; col: number }> {
  const labels: Array<{ label: string; col: number }> = [];
  let lastMonth = -1;

  for (let col = 0; col < totalWeeks; col++) {
    // Find the date of the Sunday of this week column
    const startDay = startDate.getUTCDay();
    const weekSunday = new Date(startDate);
    weekSunday.setUTCDate(weekSunday.getUTCDate() - startDay + col * 7);

    // Check each day in this week to find the first day of a new month
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const d = new Date(weekSunday);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      const month = d.getUTCMonth();

      if (month !== lastMonth && d.getUTCDate() <= 7) {
        labels.push({ label: MONTH_LABELS[month], col });
        lastMonth = month;
        break;
      }
    }
  }

  return labels;
}

/**
 * Renders a GitHub-style contribution heatmap as a PNG buffer.
 */
export async function renderHeatmap(contributions: ContributionDay[]): Promise<Buffer> {
  if (contributions.length === 0) {
    // Return a minimal empty PNG
    const canvas = createCanvas(1, 1);
    return canvas.toBuffer('image/png');
  }

  // Sort contributions by date
  const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));

  const startDate = new Date(sorted[0].date + 'T00:00:00Z');
  const endDate = new Date(sorted[sorted.length - 1].date + 'T00:00:00Z');

  // Calculate total weeks needed
  const { col: lastCol } = getGridPosition(endDate, startDate);
  const totalWeeks = lastCol + 1;

  // Canvas dimensions
  const width = LEFT_MARGIN + totalWeeks * (CELL_SIZE + CELL_GAP) + RIGHT_MARGIN;
  const height = TOP_MARGIN + 7 * (CELL_SIZE + CELL_GAP) + BOTTOM_MARGIN;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw month labels
  ctx.fillStyle = '#767676';
  ctx.font = '10px sans-serif';
  const monthLabels = getMonthLabels(startDate, totalWeeks);
  for (const { label, col } of monthLabels) {
    const x = LEFT_MARGIN + col * (CELL_SIZE + CELL_GAP);
    ctx.fillText(label, x, TOP_MARGIN - 6);
  }

  // Build a date-to-count map for quick lookup
  const countMap = new Map<string, number>();
  for (const day of sorted) {
    countMap.set(day.date, day.count);
  }

  // Draw contribution cells
  for (const day of sorted) {
    const date = new Date(day.date + 'T00:00:00Z');
    const { row, col } = getGridPosition(date, startDate);
    const level = getContributionLevel(day.count);
    const color = COLOR_SCALE[level];

    const x = LEFT_MARGIN + col * (CELL_SIZE + CELL_GAP);
    const y = TOP_MARGIN + row * (CELL_SIZE + CELL_GAP);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 2);
    ctx.fill();
  }

  return canvas.toBuffer('image/png');
}
