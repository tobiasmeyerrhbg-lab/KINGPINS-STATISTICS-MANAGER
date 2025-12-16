/**
 * Commit Display Formatter
 * 
 * Shared formatter function for commit count display across:
 * - SessionLiveScreenNew (Active Table)
 * - SessionTableScreen (View-only Table)
 * 
 * Format: "TOTAL_COUNT (COUNT × MULTIPLIER, COUNT × MULTIPLIER, ...)"
 * 
 * Rules:
 * - If total == 0: show "0"
 * - If all commits have multiplier == 1: show only total count
 * - Show breakdown ONLY if at least one commit has multiplier > 1
 * - Breakdown NEVER includes multiplier 1
 * - Separator: ", " (comma space)
 * - Order: ascending by multiplier
 */

export interface CommitDetail {
  total: number;
  byMultiplier: Record<number, number>;
}

/**
 * Format commit count with multiplier breakdown
 * @param detail - Object with total count and breakdown by multiplier
 * @returns Formatted string suitable for UI display
 */
export function formatCommitCountWithMultipliers(detail: CommitDetail | null): string {
  if (!detail || detail.total === 0) {
    return '0';
  }

  // Get all multipliers with non-zero counts
  const multKeys = Object.keys(detail.byMultiplier)
    .map(Number)
    .filter(k => detail.byMultiplier[k] !== 0)
    .sort((a, b) => a - b);

  if (multKeys.length === 0) {
    return String(detail.total);
  }

  // If only multiplier 1, show total only
  if (multKeys.length === 1 && multKeys[0] === 1) {
    return String(detail.total);
  }

  // Build breakdown of multipliers > 1
  const parts = multKeys
    .map(mult => {
      const count = detail.byMultiplier[mult];
      if (mult === 1) {
        return null; // Never show 1x in breakdown
      }
      return `${count} × ${mult}x`;
    })
    .filter((p): p is string => p !== null);

  if (parts.length === 0) {
    return String(detail.total);
  }

  return `${detail.total} (${parts.join(', ')})`;
}

/**
 * Format commit count from raw multiplier map (used in SessionLiveScreen)
 * @param total - Total commit count
 * @param byMultiplier - Map of multiplier -> count
 * @returns Formatted string suitable for UI display
 */
export function formatCommitCountFromMap(
  total: number,
  byMultiplier: Record<number, number>
): string {
  return formatCommitCountWithMultipliers({
    total,
    byMultiplier,
  });
}
