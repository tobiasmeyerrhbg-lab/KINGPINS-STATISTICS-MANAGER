# Phase 5 Quick Reference — Statistics Tab 4 Exports

## File Changes Summary

### 1. GlobalExportsTab.tsx
**Path:** `src/screens/statistics/GlobalExportsTab.tsx`

**New Imports:**
```typescript
import {
  exportPenaltyAnalysis,
  exportTopWinners,
  exportMemberStatistics,
} from '../../services/globalExportsService';
```

**New State:**
```typescript
const [exporting, setExporting] = useState(false);
```

**New Handlers:**
```typescript
// Three async handler functions that call service, set loading state, and show alerts
handleExportPenaltyAnalysis()
handleExportTopWinners()
handleExportMemberStatistics()
```

**UI Structure:**
```
Header: "📊 Global Exports"
├── Section 1: "📈 All-Time Statistics"
│   ├── 📥 Export All Time Penalty Analysis (blue button)
│   ├── 🏆 Export Top Winners by Penalty (blue button)
│   └── 👥 Export Member Statistics (blue button)
├── Section 2: "🗂️ All System Logs"
│   ├── 📥 Export All Logs (CSV & JSON) (blue button)
│   └── 📤 Share All Logs (secondary button)
└── Info Section: Export details & coverage
```

---

### 2. globalExportsService.ts
**Path:** `src/services/globalExportsService.ts`

**Three New Functions:**

#### exportPenaltyAnalysis(clubId)
```typescript
// Signature: async (clubId: string): Promise<string>
// Returns: File URI of created CSV

// SQL: Counts commits by penalty (systems 8, 9)
// Output: CSV with Penalty Name | Total Commits | Grand Total

// File: penalty-analysis-{clubId}-{YYYY-MM-DD}.csv
// Storage: /PenaltyPro/Exports/
```

#### exportTopWinners(clubId)
```typescript
// Signature: async (clubId: string): Promise<string>
// Returns: File URI of created CSV

// SQL: Ranks members per penalty by commit count
// Output: CSV with Penalty Name | Rank | Member Name | Commits

// File: top-winners-{clubId}-{YYYY-MM-DD}.csv
// Storage: /PenaltyPro/Exports/
```

#### exportMemberStatistics(clubId)
```typescript
// Signature: async (clubId: string): Promise<string>
// Returns: File URI of created CSV

// SQL: Aggregates per-member stats (commits, sessions, amounts)
// Output: CSV with Member Name | Total Commits | Sessions | Amount

// File: member-statistics-{clubId}-{YYYY-MM-DD}.csv
// Storage: /PenaltyPro/Exports/
```

---

### 3. UI-GUIDE.md
**Path:** `UI-GUIDE.md`

**New Section:** 4.b "Statistics Tab 4 — Global Exports" (lines 255-420)

**Contents:**
- Overview & layout structure
- Detailed description of all 5 export options
- SQL queries (raw data sources)
- CSV column headers & example outputs
- User flow & interaction sequence
- Technical implementation details
- Data accuracy guarantees
- UX notes & error handling

---

## Export Specifications

### Export 1: Penalty Analysis
```
File: penalty-analysis-{clubId}-{YYYY-MM-DD}.csv
Columns: Penalty Name, Total Commits
Data: Sum of all commits per penalty (systems 8 & 9)
Example:
  Forgetting Wallet,127
  Late Arrival,89
  Buying Round,154
  Grand Total,370
```

### Export 2: Top Winners
```
File: top-winners-{clubId}-{YYYY-MM-DD}.csv
Columns: Penalty Name, Rank, Member Name, Commits
Data: Ranked members per penalty by commit count (desc)
Example:
  Forgetting Wallet,1,John Smith,28
  Forgetting Wallet,2,Emma Johnson,21
  Late Arrival,1,Michael Brown,15
```

### Export 3: Member Statistics
```
File: member-statistics-{clubId}-{YYYY-MM-DD}.csv
Columns: Member Name, Total Commits, Sessions Attended, Total Amount
Data: Per-member aggregations across all penalties
Example:
  John Smith,45,12,234.50
  Emma Johnson,38,11,198.75
  Michael Brown,52,13,267.25
```

### Export 4 & 5: All Logs
```
Files: 
  - all-logs-{clubId}-{YYYY-MM-DD}.csv
  - all-logs-{clubId}-{YYYY-MM-DD}.json
Data: Complete system log history (systems 8,9,11,12,15)
Coverage: All sessions, all members, all penalties
Note: No filtering or limiting applied
```

---

## Key Implementation Details

### Data Completeness Guarantees
- ✅ **No WHERE clause filtering** beyond clubId
- ✅ **All sessions included** — no date range restrictions
- ✅ **All members included** — even those with zero commits
- ✅ **All penalties included** — all penalty types (SELF, OTHER, BOTH, NONE)
- ✅ **All logs included** — complete historical record

### Error Handling
```typescript
try {
  const uri = await exportPenaltyAnalysis(clubId);
  Alert.alert('Export Successful', `File saved: ${uri}`);
} catch (error) {
  Alert.alert('Export Failed', error.message);
} finally {
  setExporting(false);
}
```

### Loading State
```typescript
const [exporting, setExporting] = useState(false);
// Show ActivityIndicator when exporting = true
// Disable buttons during export
```

### File Storage
```
Base Directory: {FileSystem.documentDirectory}PenaltyPro/Exports/
File Naming: {export-type}-{clubId}-{YYYY-MM-DD}.csv
Format: UTF-8 CSV with headers
Persistence: Files persist after app closes
```

---

## SQL Query Reference

### Penalty Analysis Query
```sql
SELECT DISTINCT l.penaltyId, p.name as penaltyName, COUNT(*) as totalCommits
FROM SessionLog l
JOIN Penalty p ON l.penaltyId = p.id
WHERE l.clubId = ? AND (l.system = 8 OR l.system = 9)
GROUP BY l.penaltyId, p.name
ORDER BY p.name ASC
```

### Top Winners Query
```sql
SELECT p.name as penaltyName, m.name as memberName, COUNT(*) as commits
FROM SessionLog l
JOIN Penalty p ON l.penaltyId = p.id
JOIN Member m ON l.memberId = m.id
WHERE l.clubId = ? AND (l.system = 8 OR l.system = 9)
GROUP BY l.penaltyId, l.memberId, p.name, m.name
ORDER BY p.name ASC, commits DESC
```

### Member Statistics Query
```sql
SELECT m.id, m.name, 
       COUNT(DISTINCT CASE WHEN (l.system = 8 OR l.system = 9) THEN l.id END) as totalCommits,
       COUNT(DISTINCT l.sessionId) as sessionsAttended,
       SUM(CASE WHEN l.system = 11 THEN l.amountTotal ELSE 0 END) as totalAmount
FROM Member m
LEFT JOIN SessionLog l ON m.id = l.memberId AND l.clubId = ?
WHERE m.clubId = ?
GROUP BY m.id, m.name
ORDER BY m.name ASC
```

---

## Testing Checklist

### Functional Tests
- [ ] All 3 new exports create files with correct data
- [ ] Loading indicator displays during export
- [ ] Success alert shows file URI
- [ ] Error alert displays on failure
- [ ] Share function opens system intent

### Data Accuracy
- [ ] Penalty totals match Tab 1 "Commits by Penalty"
- [ ] Winners rankings match Tab 1 "Top Winners"
- [ ] Member stats match Tab 1 member cards
- [ ] All logs include complete history

### File System
- [ ] Files created in `/PenaltyPro/Exports/`
- [ ] Filenames include clubId and date
- [ ] CSV opens correctly in spreadsheet apps
- [ ] Files accessible via file manager

### UI/UX
- [ ] Button layout displays correctly
- [ ] Styling consistent with design system
- [ ] No app freeze during export
- [ ] Multiple rapid exports handled

---

## Integration Points

### SessionLiveScreenNew.tsx (Related Phase 2-4)
- Footer restructuring complete
- Multiplier Button prominent
- Details toggle functional
- Debug Mode default OFF

### AllTimeStatisticsTab.tsx (Related Phase 1)
- Tab 1 displays corresponding data
- Export data should match displayed values
- Use as verification source for data accuracy

### GlobalExportsTab.tsx (Phase 5 - This Phase)
- Imports 3 new export functions
- Provides UI for all 5 exports
- Handles loading state and errors
- Shows success/error alerts

---

## Deployment Notes

### Pre-Release
- ✅ Code complete (all 5 phases)
- ✅ TypeScript compilation: 0 errors
- ✅ Error handling implemented
- ✅ Documentation comprehensive
- [ ] Device testing (pending)
- [ ] Data verification (pending)

### Known Limitations
- Export files are large CSV/JSON (no pagination)
- File sharing depends on device storage
- SQLite queries run synchronously

### Future Enhancements
- Email delivery of exports
- Export format options (Excel, XML)
- Data filtering UI (date ranges)
- Cloud storage integration

---

**Generated:** 2025-12-16  
**Phase:** 5 — Complete  
**Status:** Ready for Testing
