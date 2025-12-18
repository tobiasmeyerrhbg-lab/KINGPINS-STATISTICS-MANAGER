/**
 * Global Exports Service
 * 
 * Provides export functionality for raw system logs across entire club.
 * Exports all SessionLog entries with system=11,12,15 (amounts, commits, playtime)
 * in both CSV and JSON formats.
 * 
 * Storage path: /PenaltyPro/Exports/
 */

import { db } from '../database/db';
import * as Sharing from 'expo-sharing';
import { formatPlaytime } from './statisticsExportService';

const EXPORT_DIR = 'PenaltyPro/Exports';

export interface GlobalLogExport {
  id: number;
  timestamp: string;
  sessionId: string;
  clubId: string;
  memberId?: string;
  system: number;
  systemDescription: string;
  amountTotal?: number;
  extra?: any;
}

/**
 * Map system IDs to human-readable descriptions
 */
function getSystemDescription(system: number): string {
  const descriptions: Record<number, string> = {
    11: 'Final Amounts',
    12: 'Commit Summary',
    13: 'Penalty Amount Summary', 
    15: 'Member Playtime',
  };
  return descriptions[system] || `System ${system}`;
}

/**
 * Fetch all relevant logs for a club (system 11, 12, 15)
 * @param clubId - Club ID to filter by
 * @param year - Optional year to filter by
 * @returns Array of SessionLog entries
 */
export async function fetchAllRelevantLogs(clubId: string, year?: number): Promise<GlobalLogExport[]> {
  try {
    let query = `SELECT id, timestamp, sessionId, clubId, memberId, system, amountTotal, extra 
                 FROM SessionLog 
                 WHERE clubId = ?`;
    const params: any[] = [clubId];

    if (year) {
      query += ` AND strftime('%Y', timestamp) = ?`;
      params.push(year.toString());
    }

    query += ` ORDER BY timestamp DESC`;

    const result = await db.executeSql(query, params);

    return result.rows.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      sessionId: log.sessionId,
      clubId: log.clubId,
      memberId: log.memberId,
      system: log.system,
      systemDescription: getSystemDescription(log.system),
      amountTotal: log.amountTotal,
      extra: log.extra ? JSON.parse(log.extra) : null,
    }));
  } catch (error) {
    throw new Error(
      `Failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fetch distinct years that contain SessionLog data for a club
 * @param clubId - Club ID to filter by
 * @returns Array of years in descending order (most recent first)
 */
export async function fetchAvailableYears(clubId: string): Promise<number[]> {
  try {
    const result = await db.executeSql(
      `SELECT DISTINCT strftime('%Y', timestamp) AS year
       FROM SessionLog
       WHERE clubId = ?
       ORDER BY year DESC`,
      [clubId]
    );

    const years = result.rows.map((row: any) => parseInt(row.year, 10)).filter((y: number) => !Number.isNaN(y));

    return years;
  } catch (error) {
    throw new Error(
      `Failed to fetch available years: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}


/**
 * Generate CSV export of all logs
 * @param clubId - Club ID to export
 * @param year - Optional year to filter by
 * @returns CSV content string
 */
export async function generateAllLogsCSV(clubId: string, year?: number): Promise<string> {
  try {
    const logs = await fetchAllRelevantLogs(clubId, year);

    let csv = year ? `Global Session Logs Export - Year ${year}\n\n` : 'Global Session Logs Export - All Systems\n\n';
    csv += `Export Date,${new Date().toISOString().split('T')[0]}\n`;
    csv += `Total Records,${logs.length}\n\n`;

    // CSV header
    csv += 'Timestamp,Session ID,Member ID,System,Description,Amount Total,Extra Data\n';

    // CSV rows
    logs.forEach((log) => {
      const extraStr = log.extra
        ? JSON.stringify(log.extra).replace(/"/g, '""')
        : '';
      csv += `"${log.timestamp}","${log.sessionId}","${log.memberId || ''}","${log.system}","${log.systemDescription}","${log.amountTotal || ''}","${extraStr}"\n`;
    });

    return csv;
  } catch (error) {
    throw new Error(
      `Failed to generate CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate JSON export of all logs with metadata
 * @param clubId - Club ID to export
 * @param year - Optional year to filter by
 * @returns JSON content string
 */
export async function generateAllLogsJSON(clubId: string, year?: number): Promise<string> {
  try {
    const logs = await fetchAllRelevantLogs(clubId, year);

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        clubId: clubId,
        year: year || null,
        totalRecords: logs.length,
        systems: Array.from(new Set(logs.map(log => log.system))).map(sys => ({
        system: sys,
        description: getSystemDescription(sys),
      })),
      },
      logs: logs,
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to generate JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Export all logs to both CSV and JSON files
 * @param clubId - Club ID to export
 * @returns Array of file paths
 */
export async function exportAllLogs(clubId: string, year?: number): Promise<string[]> {
  try {
    // @ts-ignore - runtime-only import
    const FileSystem = require('expo-file-system/legacy');

    if (!FileSystem) {
      throw new Error('FileSystem module not available');
    }

    // Generate content
    const csvContent = await generateAllLogsCSV(clubId, year);
    const jsonContent = await generateAllLogsJSON(clubId, year);

    // Create export directory
    const documentsDir = FileSystem.documentDirectory;
    const exportPath = `${documentsDir}${EXPORT_DIR}/`;

    try {
      await FileSystem.makeDirectoryAsync(exportPath, { intermediates: true });
    } catch (dirError) {
      console.log('Directory note:', dirError instanceof Error ? dirError.message : '');
    }

    // Generate timestamp for filenames
    const timestamp = new Date().toISOString().split('T')[0];

    // Export files
    const csvUri = `${exportPath}all-logs-${clubId}-${timestamp}.csv`;
    const jsonUri = `${exportPath}all-logs-${clubId}-${timestamp}.json`;

    await FileSystem.writeAsStringAsync(csvUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await FileSystem.writeAsStringAsync(jsonUri, jsonContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('Global logs exported to:', csvUri, jsonUri);
    return [csvUri, jsonUri];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Export failed:', errorMsg);
    throw new Error(`Failed to export logs: ${errorMsg}`);
  }
}

/**
 * Export and share all logs via intent
 * @param clubId - Club ID to export
 */
export async function exportAndShareAllLogs(clubId: string): Promise<void> {
  try {
    const [csvUri, jsonUri] = await exportAllLogs(clubId);

    if (await Sharing.isAvailableAsync()) {
      // Share both files together if possible
      await Sharing.shareAsync(csvUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share Club Logs',
        UTI: 'public.comma-separated-values-text',
      });
      // Note: Mobile OSes typically open share dialog for first file only
      console.log('JSON export saved to:', jsonUri);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to share logs: ${errorMsg}`);
  }
}
/**
 * Export All Time Penalty Analysis - summarizes commit counts per penalty
 * Matches Tab 1 statistics
 */
export async function exportPenaltyAnalysis(clubId: string, year?: number): Promise<string> {
  try {
    // @ts-ignore
    const FileSystem = require('expo-file-system/legacy');
    if (!FileSystem) throw new Error('FileSystem module not available');

    // Fetch all commits from all sessions
    let query = `SELECT DISTINCT l.penaltyId, p.name as penaltyName, COUNT(*) as totalCommits
       FROM SessionLog l
       JOIN Penalty p ON l.penaltyId = p.id
       WHERE l.clubId = ? AND (l.system = 8 OR l.system = 9)`;
    const params: any[] = [clubId];

    if (year) {
      query += ` AND strftime('%Y', l.timestamp) = ?`;
      params.push(year.toString());
    }

    query += ` GROUP BY l.penaltyId, p.name
       ORDER BY p.name ASC`;

    const result = await db.executeSql(query, params);

    const penalties = Array.from(result.rows) || [];

    let csv = year ? `Penalty Analysis - Year ${year}\n\n` : 'All-Time Penalty Analysis\n\n';
    csv += `Export Date,${new Date().toISOString().split('T')[0]}\n`;
    csv += `Total Penalties,${penalties.length}\n\n`;
    csv += 'Penalty Name,Total Commits\n';

    let totalCommits = 0;
    penalties.forEach((p: any) => {
      csv += `${p.penaltyName},${p.totalCommits}\n`;
      totalCommits += p.totalCommits;
    });

    csv += `\nGrand Total,${totalCommits}\n`;

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `penalty-analysis-${clubId}-${timestamp}.csv`;
    const documentsDir = FileSystem.documentDirectory;
    const exportPath = `${documentsDir}${EXPORT_DIR}/`;

    try {
      await FileSystem.makeDirectoryAsync(exportPath, { intermediates: true });
    } catch (dirError) {
      console.log('Directory note:', dirError instanceof Error ? dirError.message : '');
    }

    const fileUri = `${exportPath}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('Penalty analysis exported to:', fileUri);
    return fileUri;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to export penalty analysis: ${errorMsg}`);
  }
}

/**
 * Export Top Winners by Penalty
 * Lists members who have received each penalty most frequently
 */
export async function exportTopWinners(clubId: string, year?: number): Promise<string> {
  try {
    // @ts-ignore
    const FileSystem = require('expo-file-system/legacy');
    if (!FileSystem) throw new Error('FileSystem module not available');

    // Fetch top winners per penalty
    let query = `SELECT 
        p.name as penaltyName,
        m.name as memberName,
        COUNT(*) as commits
       FROM SessionLog l
       JOIN Penalty p ON l.penaltyId = p.id
       JOIN Member m ON l.memberId = m.id
       WHERE l.clubId = ? AND (l.system = 8 OR l.system = 9)`;
    const params: any[] = [clubId];

    if (year) {
      query += ` AND strftime('%Y', l.timestamp) = ?`;
      params.push(year.toString());
    }

    query += ` GROUP BY l.penaltyId, l.memberId, p.name, m.name
       ORDER BY p.name ASC, commits DESC`;

    const result = await db.executeSql(query, params);

    const data = Array.from(result.rows) || [];

    let csv = year ? `Top Winners by Penalty - Year ${year}\n\n` : 'Top Winners by Penalty\n\n';
    csv += `Export Date,${new Date().toISOString().split('T')[0]}\n\n`;
    csv += 'Penalty Name,Rank,Member Name,Commits\n';

    const penaltyGroups: Record<string, any[]> = {};
    data.forEach((row: any) => {
      if (!penaltyGroups[row.penaltyName]) {
        penaltyGroups[row.penaltyName] = [];
      }
      penaltyGroups[row.penaltyName].push(row);
    });

    Object.keys(penaltyGroups).sort().forEach((penaltyName) => {
      penaltyGroups[penaltyName].forEach((row: any, idx: number) => {
        csv += `${penaltyName},${idx + 1},${row.memberName},${row.commits}\n`;
      });
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `top-winners-${clubId}-${timestamp}.csv`;
    const documentsDir = FileSystem.documentDirectory;
    const exportPath = `${documentsDir}${EXPORT_DIR}/`;

    try {
      await FileSystem.makeDirectoryAsync(exportPath, { intermediates: true });
    } catch (dirError) {
      console.log('Directory note:', dirError instanceof Error ? dirError.message : '');
    }

    const fileUri = `${exportPath}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('Top winners exported to:', fileUri);
    return fileUri;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to export top winners: ${errorMsg}`);
  }
}

/**
 * Export Member Statistics - all-time data per member
 * Includes commits, totals, attendance
 */
export async function exportMemberStatistics(clubId: string, year?: number): Promise<string> {
  try {
    // @ts-ignore
    const FileSystem = require('expo-file-system/legacy');
    if (!FileSystem) throw new Error('FileSystem module not available');

    // Fetch member-level stats
    let query = `SELECT 
        m.id as memberId,
        m.name as memberName,
        COUNT(DISTINCT CASE WHEN l.system IN (8,9) THEN 1 END) as totalCommits,
        COUNT(DISTINCT l.sessionId) as sessionsAttended,
        SUM(CASE WHEN l.system = 11 THEN l.amountTotal ELSE 0 END) as totalAmount
       FROM Member m
       LEFT JOIN SessionLog l ON m.id = l.memberId AND l.clubId = ?
       WHERE m.clubId = ?`;
    const params: any[] = [clubId, clubId];

    if (year) {
      query += ` AND strftime('%Y', l.timestamp) = ?`;
      params.push(year.toString());
    }

    query += ` GROUP BY m.id, m.name
       ORDER BY m.name ASC`;

    const result = await db.executeSql(query, params);

    const members = Array.from(result.rows) || [];

    let csv = year ? `Member Statistics - Year ${year}\n\n` : 'Member Statistics\n\n';
    csv += `Export Date,${new Date().toISOString().split('T')[0]}\n`;
    csv += `Total Members,${members.length}\n\n`;
    csv += 'Member Name,Total Commits,Sessions Attended,Total Amount\n';

    members.forEach((m: any) => {
      csv += `${m.memberName},${m.totalCommits || 0},${m.sessionsAttended || 0},${(m.totalAmount || 0).toFixed(2)}\n`;
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `member-statistics-${clubId}-${timestamp}.csv`;
    const documentsDir = FileSystem.documentDirectory;
    const exportPath = `${documentsDir}${EXPORT_DIR}/`;

    try {
      await FileSystem.makeDirectoryAsync(exportPath, { intermediates: true });
    } catch (dirError) {
      console.log('Directory note:', dirError instanceof Error ? dirError.message : '');
    }

    const fileUri = `${exportPath}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('Member statistics exported to:', fileUri);
    return fileUri;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to export member statistics: ${errorMsg}`);
  }
}