# Tab 1 — All-Time Statistics — Complete Implementation Details

## Overview

This tab displays cumulative statistics for an entire club across all sessions, derived from the SessionLog (append-only) and Session data.

**Navigation:** Club Detail Screen → Statistics Button → Tab 1: "All-Time"

**Navigation Structure:**
- StatisticsScreen (parent wrapper)
  - AllTimeStatisticsTab (main component)
    - Club-Level Tab: club aggregations
    - Member-Level Tab: per-member aggregations

**Data Sources:**
- `Session` table: `startTime`, `endTime`, `status='finished'` → duration = (endTime - startTime) in seconds
- `SessionLog` with `system=11`: Final penalty amounts per member per session
- `SessionLog` with `system=12`: Total commits per member-penalty per session
- `SessionLog` with `system=15`: Per-member playtime per session (new system type added at session end)

---

## Club-Level Statistics

### 1. Total Amount (All Sessions)

**Purpose:**
Cumulative penalty amounts paid/owed by all members across all club sessions.

**Source:**
`SessionLog` with `system=11` logs.

**Calculation:**
```
Total Amount = SUM(SessionLog.amountTotal WHERE system=11 AND clubId=?)
```

**Display Format:**
- Currency symbol from `Club.currency` (e.g., "$", "€")
- Format: `{currency}{amount.toFixed(2)}`
- Example: `€1234.56`

**UI Location:**
Summary card at the top of the Club-Level tab, first row.

---

### 2. Total Playtime (All Sessions)

**Purpose:**
Total duration of all club sessions.

**Source:**
`Session` table: `startTime` and `endTime` fields.

**Calculation:**
```
Total Playtime (seconds) = SUM((Session.endTime - Session.startTime) 
                              WHERE clubId=? AND status='finished')
```

**Display Format:**
Human-readable format: `{hours}h {minutes}m`

**UI Location:**
Summary card, second row.

---

### 3. Total Commits per Penalty

**Purpose:**
Shows how many commits each penalty received across all sessions and all members.

**Source:**
`SessionLog` with `system=12` logs.

**Calculation:**
```
For each penaltyId:
  Total Commits = SUM(SessionLog.extra.count 
                     WHERE system=12 AND clubId=? AND penaltyId=?)
```

**UI Features:**
- **Table:** List of penalties with commit counts
- **Sortable:** By penalty name or commit count (ascending/descending)
- **Filterable:** Include/exclude penalties using chip buttons
- **Exportable:** CSV

**Data Structure Returned:**
```typescript
commitsByPenalty: Array<{
  penaltyId: string;
  penaltyName: string;
  totalCommits: number;
}>
```

**UI Location:**
"Commits by Penalty" table in Club-Level tab.

---

### 4. Top 3 Winners per Title Penalty

**Purpose:**
Identifies the member with the most commits for each title penalty.

**Source:**
`SessionLog` with `system=12` logs, filtered for title penalties.

**Calculation:**
```
For each title penalty:
  1. Group SessionLogs by memberId
  2. SUM(SessionLog.extra.count) per memberId
  3. Sort descending by count
  4. Take top 3 members
```

**Display Format:**
- Penalty name as section header
- Ranked list: `#1 {memberName} ({commitCount} commits)`

**Data Structure Returned:**
```typescript
topWinnersByPenalty: Array<{
  penaltyId: string;
  penaltyName: string;
  winners: Array<{
    memberId: string;
    memberName: string;
    commitCount: number;
  }> // max 3 per penalty
}>
```

**UI Location:**
"Top Winners by Penalty" section in Club-Level tab (below commits table).

---

### 5. All-Time Commit Matrix

**Purpose:**
Cross-tabulation of members × penalties showing total commits per cell.

**Source:**
`SessionLog` with `system=12` logs.

**Structure:**
- **Y-axis (rows):** Members
- **X-axis (columns):** Penalties
- **Cells:** Total commits of that member for that penalty (or blank/gray if zero)

**Calculation:**
```
For each memberId:
  For each penaltyId:
    commitCount = SUM(SessionLog.extra.count 
                     WHERE system=12 AND memberId=? AND penaltyId=?)
```

**UI Features:**
- **Color coding:** Green cell if commits > 0, gray if zero
- **Sortable:** By member or penalty totals
- **Filterable:** Include/exclude members/penalties using chip buttons
- **Exportable:** CSV

**Data Structure Returned:**
```typescript
commitMatrix: Array<{
  memberId: string;
  memberName: string;
  commitsByPenalty: Record<penaltyId, commitCount> 
    // key: penaltyId, value: total commits
}>
```

**UI Location:**
"Commit Matrix (Member × Penalty)" section in Club-Level tab (at bottom).

---

## Member-Level Statistics

### 1. Total Penalty Amount per Member

**Purpose:**
Cumulative penalties owed/paid by each member.

**Source:**
`SessionLog` with `system=11` logs.

**Calculation:**
```
For each memberId:
  Total Amount = SUM(SessionLog.amountTotal 
                    WHERE system=11 AND memberId=? AND clubId=?)
```

**Display Format:**
- Currency symbol from `Club.currency`
- Example: `€234.50`

**UI Location:**
Member card in Member-Level tab, first stat row.

---

### 2. All-Time Playtime per Member

**Purpose:**
Total duration each member actively participated across all sessions.

**Source:**
`SessionLog` with `system=15` logs (new system type created at session end).

**System 15 Log Structure:**
```
system = 15 (member playtime summary)
memberId = {memberId}
clubId = {clubId}
sessionId = {sessionId}
amountTotal = null
extra = {
  playtime: {seconds} // playtime of this member in this session
}
```

**When Created:**
At session finalization, after all member playtimes are calculated.

**Calculation:**
```
For each memberId:
  Total Playtime = SUM(SessionLog.extra.playtime 
                      WHERE system=15 AND memberId=? AND clubId=?)
```

**Display Format:**
Human-readable: `{hours}h {minutes}m`

**UI Location:**
Member card, second stat row.

---

### 3. Attendance Sessions & Attendance Percentage

**Purpose:**
Shows how many sessions a member participated in and what percentage of total club playtime that represents.

**Calculation:**
```
attendance_sessions = COUNT(DISTINCT SessionLog.sessionId 
                           WHERE memberId=? AND clubId=? AND system=15)

total_club_sessions = COUNT(DISTINCT Session.id 
                           WHERE clubId=? AND status='finished')

attendance_percentage = (member.totalPlaytime / club.totalPlaytime) * 100
```

**Display Format:**
`{sessions} sessions ({percentage.toFixed(0)}%)`

**UI Location:**
Member card, third stat row.

**Note:**
Removed: "Total Commits per Member" (per user requirement).

---

## Filters & Features

### Tab Selector
- **Club Level:** Displays club-wide aggregations
- **Member Level:** Displays per-member statistics

### Club-Level Filters & Controls

**Penalty Filter (Chip Buttons):**
- Show/hide specific penalties
- Multiple selection allowed
- Affects: Commits table, Top Winners, Commit Matrix
- When filter is empty → show all penalties

**Sort Controls for Commits Table:**
- **Sort key:** Penalty Name or Commit Count
- **Sort order:** Ascending or Descending
- Icons: 📝 (name) / 📊 (count), ⬆️ (asc) / ⬇️ (desc)

**Export Button:**
- Label: "📥 Export as CSV"
- Generates CSV with club summary, commits by penalty, top winners, commit matrix

---

### Member-Level Filters & Controls

**Member Filter (Chip Buttons):**
- Show/hide specific members
- Multiple selection allowed
- Affects: Member statistics cards
- When filter is empty → show all members

**Sort Controls:**
Buttons for: Amount | Playtime | Attendance | Name
- Active sort: highlighted in blue
- Click same button to toggle sort order (asc ↔ desc)
- Displays active sort order: " ⬆️" or " ⬇️"

**Export Button:**
- Label: "📥 Export as CSV"
- Generates CSV: Member name, total amount, playtime, attendance sessions, attendance percentage

---

## Export Service

**File:** `src/services/statisticsExportService.ts`

**Functions:**

### `generateClubStatisticsCSV(clubStats: ClubLevelStats, penaltyMap: Record<string, string>): string`
Generates CSV with:
- Summary section (total amount with currency, total playtime formatted, total commits)
- Commits by Penalty table
- Top Winners by Penalty section
- Commit Matrix table

### `generatePlayerStatisticsCSV(memberStats: MemberStats[], clubCurrency: string): string`
Generates CSV with:
- Member name, total amount (with currency), playtime formatted, playtime seconds, attendance sessions, attendance percentage

### `exportToCSV(csvContent: string, filename: string): Promise<void>`
Saves CSV to device cache directory and shares via native share sheet.
- Uses `expo-file-system` for file I/O
- Uses `expo-sharing` for sharing dialog
- Date appended to filename: `{filename}-{YYYY-MM-DD}.csv`

---

## Service Layer

**File:** `src/services/allTimeStatisticsService.ts`

### `getClubLevelStats(clubId: string): Promise<ClubLevelStats>`
Aggregates all club-level statistics.

**Returns:**
```typescript
{
  clubId: string;
  currency: string; // from Club record
  totalAmount: number;
  totalPlaytime: number; // seconds
  commitsByPenalty: Array<{
    penaltyId: string;
    penaltyName: string;
    totalCommits: number;
  }>;
  topWinnersByPenalty: Array<{
    penaltyId: string;
    penaltyName: string;
    winners: Array<{
      memberId: string;
      memberName: string;
      commitCount: number;
    }>;
  }>;
  commitMatrix: Array<{
    memberId: string;
    memberName: string;
    commitsByPenalty: Record<penaltyId, count>;
  }>;
}
```

### `getMemberLevelStats(clubId: string): Promise<MemberStats[]>`
Aggregates per-member statistics.

**Returns:**
```typescript
Array<{
  memberId: string;
  memberName: string;
  totalAmount: number;
  totalPlaytime: number; // seconds
  attendanceSessions: number;
  attendancePercentage: number; // 0-100
}>
```

---

## UI Component

**File:** `src/screens/statistics/AllTimeStatisticsTab.tsx`

**State Management:**
- `clubStats: ClubLevelStats | null` - Club-level aggregations
- `memberStats: MemberStats[]` - Per-member statistics
- `activeTab: 'club' | 'member'` - Current tab
- `selectedPenalties: Set<string>` - Filtered penalties
- `selectedMembers: Set<string>` - Filtered members
- `clubSortKey: 'name' | 'commits'` - Commit table sort column
- `clubSortOrder: 'asc' | 'desc'` - Commit table sort direction
- `playerSortKey: 'amount' | 'playtime' | 'attendance' | 'name'` - Member card sort column
- `playerSortOrder: 'asc' | 'desc'` - Member card sort direction
- `loading: boolean` - Data loading state
- `error: string | null` - Error message

**Key UI Elements:**

**Club-Level Tab:**
1. Summary Card: Total Amount, Total Playtime, Total Commits
2. Penalty Filter Chips
3. Commits by Penalty Table (sortable, filterable)
4. Top Winners by Penalty Section
5. Commit Matrix Grid
6. Export to CSV Button

**Member-Level Tab:**
1. Member Filter Chips
2. Sort Control Buttons (Amount, Playtime, Attendance, Name)
3. Member Statistics Cards (FlatList)
4. Export to CSV Button

---

## Integration & Navigation

**Route:** Club Detail → Statistics → "All-Time" tab
**Route Params:** `{ clubId: string }`
**Component:** `AllTimeStatisticsTab` in `StatisticsScreen`

---

## File Listing

- `src/services/allTimeStatisticsService.ts` - Core aggregation logic
- `src/services/statisticsExportService.ts` - CSV export functionality
- `src/screens/statistics/AllTimeStatisticsTab.tsx` - Main UI component
- `src/screens/statistics/StatisticsScreen.tsx` - Navigation wrapper
