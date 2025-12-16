/**
 * Session Details Export Service
 * 
 * Provides export functionality for session-specific data.
 * Exports session logs, member amounts, commits, and playtime as CSV and JSON.
 * 
 * Storage path: /PenaltyPro/Exports/
 */

import { db } from '../database/db';
import * as Sharing from 'expo-sharing';
import { formatPlaytime } from './statisticsExportService';

const EXPORT_DIR = 'PenaltyPro/Exports';

export interface SessionExportData {
  sessionId: string;
  sessionDate: string;
  memberData: {
    memberId: string;
    memberName: string;
    playtimeSeconds: number;
    playtimeFormatted: string;
    totalAmount: number;
    commitCount: number;
    commitsByPenalty: Record<string, number>;
  }[];
  logs: {
    timestamp: string;
    memberId?: string;
    system: number;
    systemDescription: string;
    amountTotal?: number;
    extra?: any;
  }[];
  summary: {
    totalAmount: number;
    totalPlaytime: number;
    totalPlaytimeFormatted: string;
    memberCount: number;
    logCount: number;
  };
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
 * Fetch session-specific data for export
 * @param sessionId - Session ID
 * @returns SessionExportData object
 */
export async function fetchSessionExportData(sessionId: string): Promise<SessionExportData> {
  try {
    // Fetch session logs
    const logsResult = await db.executeSql(
      `SELECT timestamp, memberId, system, amountTotal, extra 
       FROM SessionLog 
       WHERE sessionId = ? AND system IN (11, 12, 15)
       ORDER BY timestamp ASC`,
      [sessionId]
    );

    const logs = logsResult.rows.map((log: any) => ({
      timestamp: log.timestamp,
      memberId: log.memberId,
      system: log.system,
      systemDescription: getSystemDescription(log.system),
      amountTotal: log.amountTotal,
      extra: log.extra ? JSON.parse(log.extra) : null,
    }));

    // Fetch session start time
    const sessionResult = await db.executeSql(
      `SELECT startTime FROM Session WHERE id = ?`,
      [sessionId]
    );

    const sessionDate = sessionResult.rows.length > 0
      ? (sessionResult.rows[0] as any).startTime.split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Build member data from final amounts logs
    const finalAmountLogs = logs.filter(l => l.system === 11);
    const memberDataMap = new Map<string, any>();

    for (const log of finalAmountLogs) {
      if (log.extra?.finalAmounts) {
        for (const [memberId, amount] of Object.entries(log.extra.finalAmounts)) {
          if (!memberDataMap.has(memberId)) {
            // Fetch member name and playtime
            const memberResult = await db.executeSql(
              `SELECT m.name FROM Member m WHERE m.id = ?`,
              [memberId]
            );
            const memberName = memberResult.rows.length > 0 ? (memberResult.rows[0] as any).name : 'Unknown';

            // Get playtime from member session summary
            const playtimeResult = await db.executeSql(
              `SELECT playtimeSeconds FROM MemberSessionSummary WHERE memberId = ? AND sessionId = ?`,
              [memberId, sessionId]
            );
            const playtimeSeconds = playtimeResult.rows.length > 0
              ? (playtimeResult.rows[0] as any).playtimeSeconds
              : 0;

            memberDataMap.set(memberId, {
              memberId,
              memberName,
              playtimeSeconds,
              playtimeFormatted: formatPlaytime(playtimeSeconds),
              totalAmount: amount as number,
              commitCount: 0,
              commitsByPenalty: {},
            });
          }
        }
      }
    }

    // Add commit data
    const commitLogs = logs.filter(l => l.system === 12);
    for (const log of commitLogs) {
      if (log.memberId && log.extra?.commitSummary) {
        const member = memberDataMap.get(log.memberId);
        if (member) {
          member.commitCount = Object.values(log.extra.commitSummary as Record<string, number>).reduce(
            (sum, count) => sum + (count as number),
            0
          );
          member.commitsByPenalty = log.extra.commitSummary;
        }
      }
    }

    const memberData = Array.from(memberDataMap.values());

    // Calculate summary
    const totalAmount = memberData.reduce((sum, m) => sum + m.totalAmount, 0);
    const totalPlaytime = memberData.reduce((sum, m) => sum + m.playtimeSeconds, 0);

    return {
      sessionId,
      sessionDate,
      memberData,
      logs,
      summary: {
        totalAmount,
        totalPlaytime,
        totalPlaytimeFormatted: formatPlaytime(totalPlaytime),
        memberCount: memberData.length,
        logCount: logs.length,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch session data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate CSV export of session data
 * @param sessionId - Session ID to export
 * @returns CSV content string
 */
export async function generateSessionCSV(sessionId: string): Promise<string> {
  try {
    const data = await fetchSessionExportData(sessionId);

    let csv = `Session Details Export\n`;
    csv += `Session ID,${data.sessionId}\n`;
    csv += `Date,${data.sessionDate}\n`;
    csv += `Export Time,${new Date().toISOString()}\n\n`;

    // Summary section
    csv += `Summary\n`;
    csv += `Total Amount,${data.summary.totalAmount.toFixed(2)}\n`;
    csv += `Total Playtime,${data.summary.totalPlaytimeFormatted}\n`;
    csv += `Total Playtime (seconds),${data.summary.totalPlaytime}\n`;
    csv += `Total Members,${data.summary.memberCount}\n`;
    csv += `Total Log Entries,${data.summary.logCount}\n\n`;

    // Member data
    csv += `Member Details\n`;
    csv += `Member Name,Total Amount,Playtime,Playtime (seconds),Total Commits\n`;
    data.memberData.forEach(member => {
      csv += `"${member.memberName}",${member.totalAmount.toFixed(2)},"${member.playtimeFormatted}",${member.playtimeSeconds},${member.commitCount}\n`;
    });

    // Detailed logs
    csv += `\nDetailed Logs\n`;
    csv += `Timestamp,Member ID,System,Description,Amount Total,Extra Data\n`;
    data.logs.forEach(log => {
      const extraStr = log.extra ? JSON.stringify(log.extra).replace(/"/g, '""') : '';
      csv += `"${log.timestamp}","${log.memberId || ''}","${log.system}","${log.systemDescription}","${log.amountTotal || ''}","${extraStr}"\n`;
    });

    return csv;
  } catch (error) {
    throw new Error(
      `Failed to generate CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate JSON export of session data
 * @param sessionId - Session ID to export
 * @returns JSON content string
 */
export async function generateSessionJSON(sessionId: string): Promise<string> {
  try {
    const data = await fetchSessionExportData(sessionId);

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        sessionId: data.sessionId,
        sessionDate: data.sessionDate,
      },
      summary: data.summary,
      memberData: data.memberData,
      logs: data.logs,
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to generate JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Export session data to both CSV and JSON files
 * @param sessionId - Session ID to export
 * @returns Array of file paths
 */
export async function exportSessionData(sessionId: string): Promise<string[]> {
  try {
    // @ts-ignore - runtime-only import
    const FileSystem = require('expo-file-system/legacy');

    if (!FileSystem) {
      throw new Error('FileSystem module not available');
    }

    // Generate content
    const csvContent = await generateSessionCSV(sessionId);
    const jsonContent = await generateSessionJSON(sessionId);

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
    const csvUri = `${exportPath}session-${sessionId}-${timestamp}.csv`;
    const jsonUri = `${exportPath}session-${sessionId}-${timestamp}.json`;

    await FileSystem.writeAsStringAsync(csvUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await FileSystem.writeAsStringAsync(jsonUri, jsonContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('Session data exported to:', csvUri, jsonUri);
    return [csvUri, jsonUri];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Export failed:', errorMsg);
    throw new Error(`Failed to export session data: ${errorMsg}`);
  }
}

/**
 * Export and share session data via intent
 * @param sessionId - Session ID to export
 */
export async function exportAndShareSessionData(sessionId: string): Promise<void> {
  try {
    const [csvUri] = await exportSessionData(sessionId);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(csvUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share Session Data',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to share session data: ${errorMsg}`);
  }
}
