# Export Functionality Documentation

Comprehensive multi-format export system across all statistics tabs and session screens.

## 4.1 Tab 1: All-Time Statistics Exports

**Location:** `src/screens/statistics/AllTimeStatisticsTab.tsx`

**Export Functions:**

Three export buttons in the All-Time Statistics tab:
1. **Club Summary Export** - Summary of totals, playtime, commits by penalty
2. **Commit Matrix Export** - Member × Penalty detailed matrix
3. **Member Statistics Export** - Per-member totals, playtime, attendance %

**Service:** `src/services/statisticsExportService.ts`

**Key Functions:**
- `generateClubStatisticsCSV(clubStats, penaltyMap)` - Club-level CSV
- `generatePlayerStatisticsCSV(memberStats, clubCurrency)` - Member-level CSV
- `generateCommitMatrixCSV(clubStats)` - Commit matrix CSV
- `exportToCSVLocal(csvContent, filename)` - Save to device storage
- `exportToCSV(csvContent, filename)` - Save and share via intent

**Storage Path:** `/PenaltyPro/StatisticsExports/`

**File Naming:**
```
club-statistics-YYYY-MM-DD.csv
commit-matrix-YYYY-MM-DD.csv
member-statistics-YYYY-MM-DD.csv
```

**Attendance Calculation:**
```
Attendance% = (member.totalPlaytime / club.totalPlaytime) * 100
```

## 4.2 Tab 3: Session Analysis Exports

**Location:** `src/screens/statistics/SessionAnalysisTab.tsx`

**Status:** PLANNED - To be implemented with:
- Graph export as PNG/JPEG
- CSV data export for selected sessions
- Timestamp-based filenames

**Integration Points:**
- SessionGraphView component with render-to-image capability
- Session filtering UI for selective export
- Multi-format export dialog

## 4.3 Tab 4: Global Exports (NEW)

**Location:** `src/screens/statistics/GlobalExportsTab.tsx`

**Service:** `src/services/globalExportsService.ts`

**Purpose:** Export all session logs for entire club in raw format

**Key Functions:**
- `fetchAllRelevantLogs(clubId)` - Retrieve all system 11, 12, 15 logs
- `generateAllLogsCSV(clubId)` - CSV export of all logs
- `generateAllLogsJSON(clubId)` - JSON export of all logs
- `exportAllLogs(clubId)` - Save both CSV and JSON
- `exportAndShareAllLogs(clubId)` - Save and share via intent

**Systems Included:**
- System 11: Final Amounts (extra: finalAmounts object)
- System 12: Commit Summary (extra: commitSummary object)
- System 15: Member Playtime (extra: playtime in seconds)

**Storage Path:** `/PenaltyPro/Exports/`

**File Naming:**
```
all-logs-{clubId}-YYYY-MM-DD.csv
all-logs-{clubId}-YYYY-MM-DD.json
```

## 4.4 Session Details Screen Exports

**Location:** `src/screens/sessions/SessionDetailsScreen.tsx`

**Service:** `src/services/sessionDetailsExportService.ts`

**Purpose:** Export session-specific data (member amounts, commits, playtime, logs)

**Key Functions:**
- `fetchSessionExportData(sessionId)` - Gather all session data
- `generateSessionCSV(sessionId)` - CSV export with member data and logs
- `generateSessionJSON(sessionId)` - JSON export with detailed structure
- `exportSessionData(sessionId)` - Save both CSV and JSON
- `exportAndShareSessionData(sessionId)` - Save and share via intent

**Storage Path:** `/PenaltyPro/Exports/`

**File Naming:**
```
session-{sessionId}-YYYY-MM-DD.csv
session-{sessionId}-YYYY-MM-DD.json
```

## 4.5 Implementation Details

**API Used:** `expo-file-system/legacy`
- Avoids deprecation warnings from standard FileSystem API
- Backward compatible with stable API features
- Used via: `require('expo-file-system/legacy')`

**Sharing:** `expo-sharing`
- Android intent-based file sharing
- Supports mimeType: 'text/csv', 'application/json'
- Fails gracefully on platforms without sharing support

**Error Handling:**
- Try-catch blocks around all file operations
- Alert dialogs for user feedback (success/failure)
- Console logging for debugging
- Graceful fallback if FileSystem unavailable

**File Organization:**
```
/DocumentsDirectory/
  PenaltyPro/
    Exports/
      all-logs-{clubId}-YYYY-MM-DD.csv
      all-logs-{clubId}-YYYY-MM-DD.json
      session-{sessionId}-YYYY-MM-DD.csv
      session-{sessionId}-YYYY-MM-DD.json
    StatisticsExports/
      club-statistics-YYYY-MM-DD.csv
      commit-matrix-YYYY-MM-DD.csv
      member-statistics-YYYY-MM-DD.csv
```

**Timestamp Format:** `YYYY-MM-DD` (from `new Date().toISOString().split('T')[0]`)

**Database Queries:**
- SessionLog table: SELECT by clubId, filter by system IN (11, 12, 15)
- Member table: SELECT name WHERE id = ?
- MemberSessionSummary: SELECT playtimeSeconds WHERE memberId, sessionId
- Session table: SELECT startTime WHERE id = ?

**No Currency Hardcoding:**
- All exports use `club.currency` from database
- CSV headers reference currency dynamically
- JSON exports include currency metadata where applicable

**Type Safety:**
- All export functions typed with TypeScript
- SessionExportData interface for structured data
- GlobalLogExport interface for raw log exports
- Error messages typed as Error or unknown

## 4.6 Testing Recommendations

1. **Tab 1 Exports:**
   - Export club statistics → verify CSV contains summary, penalty commits, top winners, matrix
   - Export member statistics → verify CSV has attendance % calculated correctly
   - Export commit matrix → verify member names and penalty counts accurate
   - Verify file saved to /PenaltyPro/StatisticsExports/ with YYYY-MM-DD timestamp

2. **Tab 4 Global Exports:**
   - Export all logs → verify CSV has all system 11, 12, 15 logs from entire club
   - Verify JSON structure matches metadata format
   - Test with multiple sessions → confirm all sessions included
   - Verify extra JSON data properly escaped in CSV

3. **Session Details Exports:**
   - Export session data → verify member amounts, commits, playtime included
   - Check detailed logs section → verify all system 11, 12, 15 entries present
   - Verify JSON matches CSV data
   - Test with sessions having different member counts

4. **File Operations:**
   - Directory creation → verify /PenaltyPro/Exports/ created on first export
   - File writing → verify UTF-8 encoding applied
   - Timestamp naming → verify YYYY-MM-DD format consistent
   - Share dialog → verify opens on Android with correct MIME type
   - Error handling → disconnect FileSystem → verify Alert shows error

## 4.7 Key Design Decisions

1. **Three Separate Export Services:**
   - `statisticsExportService.ts`: Tab 1 (All-Time Statistics) exports
   - `globalExportsService.ts`: Tab 4 (Global Exports) raw logs
   - `sessionDetailsExportService.ts`: Session Details screen exports
   - Separation allows independent evolution and testing

2. **Two File Formats (CSV & JSON):**
   - CSV for spreadsheet/Excel analysis
   - JSON for programmatic integration and complete data fidelity
   - Both saved simultaneously for compatibility

3. **Local Storage Only (No Cloud):**
   - All files saved to device `/DocumentsDirectory/`
   - User can manually share via native share sheet
   - Privacy-first approach (no external upload)

4. **System Code Filtering:**
   - Only systems 11 (amounts), 12 (commits), 15 (playtime) exported in Tab 4
   - Other systems (1, 2, 5, 6, 8, 9) excluded to reduce noise in raw exports
   - Tab 1 exports already aggregate this data in user-friendly format

5. **Attendance % Calculation:**
   - Based on playtime ratio, not session count
   - Formula: `(member.totalPlaytime / club.totalPlaytime) * 100`
   - More accurate for clubs with variable session durations

## 4.8 Files Implemented

**New Services:**
- [src/services/globalExportsService.ts](src/services/globalExportsService.ts) - Tab 4 raw log exports
- [src/services/sessionDetailsExportService.ts](src/services/sessionDetailsExportService.ts) - Session-specific exports

**New Components:**
- [src/screens/statistics/GlobalExportsTab.tsx](src/screens/statistics/GlobalExportsTab.tsx) - Tab 4 UI

**Updated Components:**
- [src/screens/statistics/StatisticsScreen.tsx](src/screens/statistics/StatisticsScreen.tsx) - Import GlobalExportsTab, replace ExportsTab placeholder
- [src/screens/sessions/SessionDetailsScreen.tsx](src/screens/sessions/SessionDetailsScreen.tsx) - Added export handlers and buttons

**Updated Services:**
- [src/services/statisticsExportService.ts](src/services/statisticsExportService.ts) - Tab 1 (already completed)

## 4.9 Future Enhancements

1. **Tab 3 Graph Exports:**
   - PNG/JPEG export of SessionGraphView component
   - CSV export of graph-aggregated data for selected sessions
   - Requires render-to-image library integration

2. **Data Import:**
   - Reverse export functionality (read CSV/JSON, restore data)
   - Useful for club data migration

3. **Email Export:**
   - Direct email from app instead of share sheet
   - Requires email configuration

4. **Excel/XLSX:**
   - Direct Excel export instead of CSV
   - Requires XLSX library

5. **Selective Exports:**
   - Date range filtering for Session Analysis
   - Member subset selection
   - Penalty subset selection
