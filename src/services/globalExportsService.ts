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
    15: 'Member Playtime',
  };
  return descriptions[system] || `System ${system}`;
}

/**
 * Fetch all relevant logs for a club (system 11, 12, 15)
 * @param clubId - Club ID to filter by
 * @returns Array of SessionLog entries
 */
export async function fetchAllRelevantLogs(clubId: string): Promise<GlobalLogExport[]> {
  try {
    const result = await db.executeSql(
      `SELECT id, timestamp, sessionId, clubId, memberId, system, amountTotal, extra 
       FROM SessionLog 
       WHERE clubId = ? AND system IN (11, 12, 15)
       ORDER BY timestamp DESC`,
      [clubId]
    );

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
 * Generate CSV export of all logs
 * @param clubId - Club ID to export
 * @returns CSV content string
 */
export async function generateAllLogsCSV(clubId: string): Promise<string> {
  try {
    const logs = await fetchAllRelevantLogs(clubId);

    let csv = 'Global Session Logs Export - All Systems\n\n';
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
 * @returns JSON content string
 */
export async function generateAllLogsJSON(clubId: string): Promise<string> {
  try {
    const logs = await fetchAllRelevantLogs(clubId);

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        clubId: clubId,
        totalRecords: logs.length,
        systems: [
          { system: 11, description: 'Final Amounts' },
          { system: 12, description: 'Commit Summary' },
          { system: 15, description: 'Member Playtime' },
        ],
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
export async function exportAllLogs(clubId: string): Promise<string[]> {
  try {
    // @ts-ignore - runtime-only import
    const FileSystem = require('expo-file-system/legacy');

    if (!FileSystem) {
      throw new Error('FileSystem module not available');
    }

    // Generate content
    const csvContent = await generateAllLogsCSV(clubId);
    const jsonContent = await generateAllLogsJSON(clubId);

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
