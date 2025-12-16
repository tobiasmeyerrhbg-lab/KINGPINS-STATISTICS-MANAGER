/**
 * Statistics Export Service
 * 
 * Provides local export functionality for statistics tables (CSV)
 * Exports are saved to device storage in /PenaltyPro/StatisticsExports/
 */

import { ClubLevelStats, MemberStats } from './allTimeStatisticsService';
import * as Sharing from 'expo-sharing';

const EXPORT_DIR = 'PenaltyPro/StatisticsExports';

/**
 * Export club-level statistics to CSV
 * @param clubStats - Club-level statistics
 * @param penaltyMap - Map of penaltyId to penalty name
 * @returns CSV content string
 */
export function generateClubStatisticsCSV(
  clubStats: ClubLevelStats,
  penaltyMap: Record<string, string>
): string {
  let csv = 'Club-Level All-Time Statistics\n\n';

  // Summary section
  csv += 'Summary\n';
  csv += `Total Amount,${clubStats.currency}${clubStats.totalAmount.toFixed(2)}\n`;
  csv += `Total Playtime (seconds),${clubStats.totalPlaytime}\n`;
  csv += `Total Playtime (formatted),${formatPlaytime(clubStats.totalPlaytime)}\n\n`;

  // Commits by penalty
  csv += 'Commits by Penalty\n';
  csv += 'Penalty Name,Count\n';
  clubStats.commitsByPenalty.forEach((p) => {
    csv += `${p.penaltyName},${p.totalCommits}\n`;
  });

  csv += '\n';

  // Top winners
  if (clubStats.topWinnersByPenalty.length > 0) {
    csv += 'Top Winners by Penalty\n';
    csv += 'Penalty Name,Rank,Member Name,Wins\n';
    clubStats.topWinnersByPenalty.forEach((penalty) => {
      penalty.winners.forEach((winner, index) => {
        csv += `${penalty.penaltyName},${index + 1},${winner.memberName},${winner.winCount}\n`;
      });
    });
  }

  // Commit matrix
  if (clubStats.commitMatrix.length > 0) {
    csv += '\nCommit Matrix (Member x Penalty)\n';
    const penaltyHeaders = clubStats.commitsByPenalty.map(p => p.penaltyName).join(',');
    csv += `Member,${penaltyHeaders}\n`;
    clubStats.commitMatrix.forEach((member) => {
      const counts = clubStats.commitsByPenalty.map(p => member.commitsByPenalty[p.penaltyId] || 0).join(',');
      csv += `${member.memberName},${counts}\n`;
    });
  }

  return csv;
}

/**
 * Export member-level statistics to CSV
 * @param memberStats - Array of member statistics
 * @param clubCurrency - Currency symbol from club
 * @returns CSV content string
 */
export function generatePlayerStatisticsCSV(
  memberStats: MemberStats[],
  clubCurrency: string = '$'
): string {
  let csv = 'Member-Level All-Time Statistics\n\n';
  csv += 'Member Name,Total Amount,Total Playtime (formatted),Playtime (seconds),Attendance Sessions,Attendance %\n';

  memberStats.forEach(member => {
    csv += `${member.memberName},${clubCurrency}${member.totalAmount.toFixed(2)},${formatPlaytime(member.totalPlaytime)},${member.totalPlaytime},${member.attendanceSessions},${member.attendancePercentage.toFixed(1)}\n`;
  });

  return csv;
}

/**
 * Export commit matrix as CSV
 * @param clubStats - Club-level statistics
 * @returns CSV content string
 */
export function generateCommitMatrixCSV(clubStats: ClubLevelStats): string {
  let csv = 'All-Time Commit Matrix\n\n';

  if (clubStats.commitMatrix.length === 0) {
    csv += 'No data available\n';
    return csv;
  }

  // Header row with penalty names
  const penaltyHeaders = clubStats.commitsByPenalty.map(p => p.penaltyName).join(',');
  csv += `Member,${penaltyHeaders}\n`;

  // Data rows
  clubStats.commitMatrix.forEach((member) => {
    const counts = clubStats.commitsByPenalty
      .map(p => member.commitsByPenalty[p.penaltyId] || 0)
      .join(',');
    csv += `${member.memberName},${counts}\n`;
  });

  return csv;
}

/**
 * Save CSV to local file system and optionally share
 * @param csvContent - CSV content string
 * @param filename - Filename without extension (e.g., "club-statistics-2024-12-15")
 * @returns Path to saved file
 */
export async function exportToCSVLocal(csvContent: string, filename: string): Promise<string> {
  try {
    // Import legacy filesystem API to avoid deprecation warnings
    // @ts-ignore - runtime-only import
    const FileSystem = require('expo-file-system/legacy');
    
    if (!FileSystem) {
      throw new Error('FileSystem module not available');
    }

    // Ensure filename is clean and includes timestamp
    const cleanFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '-');
    const timestamp = new Date().toISOString().split('T')[0];
    const finalFilename = `${cleanFilename}-${timestamp}.csv`;

    // Create export directory if it doesn't exist
    const documentsDir = FileSystem.documentDirectory;
    const exportPath = `${documentsDir}${EXPORT_DIR}/`;
    
    // Ensure directory exists using legacy API
    try {
      await FileSystem.makeDirectoryAsync(exportPath, { intermediates: true });
    } catch (dirError) {
      // Directory might already exist, continue
      console.log('Directory creation note:', dirError instanceof Error ? dirError.message : 'Directory may already exist');
    }

    // Full file URI
    const fileUri = `${exportPath}${finalFilename}`;

    // Write file using legacy API
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('Statistics exported to:', fileUri);
    return fileUri;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Export failed:', errorMsg);
    throw new Error(`Failed to export CSV: ${errorMsg}`);
  }
}

/**
 * Save CSV and share via intent
 * @param csvContent - CSV content string
 * @param filename - Filename without extension
 */
export async function exportToCSV(csvContent: string, filename: string): Promise<void> {
  try {
    const fileUri = await exportToCSVLocal(csvContent, filename);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Share ${filename}`,
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to export CSV: ${errorMsg}`);
  }
}

/**
 * Format playtime in seconds to human-readable format
 * @param seconds - Total seconds
 * @returns Formatted string (e.g., "2h 30m")
 */
export function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Create a text-based table representation for display/export
 * @param clubStats - Club-level statistics
 * @param penaltyMap - Map of penaltyId to penalty name
 * @returns Formatted text table
 */
export function formatClubStatisticsTable(
  clubStats: ClubLevelStats,
  penaltyMap: Record<string, string>
): string {
  let text = '═══════════════════════════════════════════════════\n';
  text += 'CLUB-LEVEL ALL-TIME STATISTICS\n';
  text += '═══════════════════════════════════════════════════\n\n';

  text += `Total Amount:        ${clubStats.currency}${clubStats.totalAmount.toFixed(2)}\n`;
  text += `Total Playtime:      ${formatPlaytime(clubStats.totalPlaytime)}\n`;
  text += `Total Commits:       ${clubStats.commitsByPenalty.reduce((sum, p) => sum + p.totalCommits, 0)}\n\n`;

  text += '───────────────────────────────────────────────────\n';
  text += 'COMMITS BY PENALTY\n';
  text += '───────────────────────────────────────────────────\n';
  clubStats.commitsByPenalty
    .sort((a, b) => b.totalCommits - a.totalCommits)
    .forEach((p) => {
      text += `${p.penaltyName.padEnd(30)} ${p.totalCommits.toString().padStart(5)}\n`;
    });

  if (clubStats.topWinnersByPenalty.length > 0) {
    text += '\n───────────────────────────────────────────────────\n';
    text += 'TOP 3 WINNERS BY PENALTY\n';
    text += '───────────────────────────────────────────────────\n';
    clubStats.topWinnersByPenalty.forEach((penalty) => {
      text += `\n${penalty.penaltyName}\n`;
      penalty.winners.forEach((winner, index) => {
        text += `  ${index + 1}. ${winner.memberName} (${winner.winCount} wins)\n`;
      });
    });
  }

  return text;
}

/**
 * Create a text-based member statistics representation
 * @param memberStats - Array of member statistics
 * @param clubCurrency - Currency symbol from club
 * @returns Formatted text table
 */
export function formatPlayerStatisticsTable(
  memberStats: MemberStats[],
  clubCurrency: string = '$'
): string {
  let text = '═══════════════════════════════════════════════════\n';
  text += 'MEMBER-LEVEL ALL-TIME STATISTICS\n';
  text += '═══════════════════════════════════════════════════\n\n';

  memberStats.forEach(member => {
    text += `${member.memberName}\n`;
    text += `  Total Amount:     ${clubCurrency}${member.totalAmount.toFixed(2)}\n`;
    text += `  Total Playtime:   ${formatPlaytime(member.totalPlaytime)}\n`;
    text += `  Attendance:       ${member.attendanceSessions} sessions (${member.attendancePercentage.toFixed(1)}%)\n`;
    text += '\n';
  });

  return text;
}
