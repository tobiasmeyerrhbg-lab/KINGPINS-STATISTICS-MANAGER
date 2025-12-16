# Tab 1 — All-Time Statistics Implementation Guide

This is comprehensive documentation for Tab 1 — All-Time Statistics (Club-Level & Member-Level).

## Overview

This tab provides comprehensive, long-term cumulative statistics for a single Club across all finished sessions. All calculations are derived from the SessionLog, which serves as the single source of truth for all metrics.

The tab is divided into two levels:
- **Club-Level Statistics**: Aggregated metrics across all members and sessions
- **Member-Level Statistics**: Per-member metrics including playtime and financial data

---

## A. Club-Level All-Time Statistics

### 1. Total Amount (All Sessions)

**Purpose:**
Displays the cumulative penalty amounts that all members have incurred across all finished sessions in the club.

**Data Source:**
`SessionLog` table with `system=11` (final session summary logs)
- Each system=11 log contains `amountTotal` field representing the final amount for that member in that session
- These amounts already include multiplier effects and reward deductions applied during session finalization

**Calculation Formula:**
```
totalAmount = SUM(SessionLog.amountTotal) WHERE system=11 AND clubId=?
```

**Example:**
If a club has 3 finished sessions:
- Session 1: Member A owes €50, Member B owes -€10 (credit) → logs: €50, -€10
- Session 2: Member A owes €25, Member C owes €75 → logs: €25, €75
- Session 3: Member B owes €100 → logs: €100
- **Total Amount = €50 + (-€10) + €25 + €75 + €100 = €240**

**UI Implementation:**
- Displayed in summary card at top of Club-Level tab
- Format: `{currency}{amount.toFixed(2)}` (e.g., "€240.00")
- Currency symbol sourced from `Club.currency` column
- All text wrapped in `<Text>` component for React Native compatibility

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getClubLevelStats()` function
- Lines: 103-107 (system=11 log aggregation)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` line 212

---

### 2. Total Playtime (All Sessions)

**Purpose:**
Shows the total duration of all finished sessions in the club. Useful for understanding club activity level over time.

**Data Source:**
`Session` table with status='finished'
- Calculate duration from `startTime` and `endTime` fields
- Measured in seconds for internal storage, formatted to human-readable format for display

**Calculation Formula:**
```
totalPlaytime = SUM(session.endTime - session.startTime) for all finished sessions in seconds
formatTime(seconds) = {hours}h {minutes}m where hours = floor(seconds / 3600), minutes = floor((seconds % 3600) / 60)
```

**Example:**
If a club has 3 finished sessions:
- Session 1: 1 hour 30 minutes = 5,400 seconds
- Session 2: 45 minutes = 2,700 seconds
- Session 3: 2 hours = 7,200 seconds
- **Total Playtime = 5,400 + 2,700 + 7,200 = 15,300 seconds = 4h 15m**

**UI Implementation:**
- Displayed in summary card at top of Club-Level tab
- Format: `{hours}h {minutes}m` (e.g., "4h 15m")
- All text wrapped in `<Text>` component

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getClubLevelStats()` function
- Lines: 68-80 (session duration calculation)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` line 216

---

### 3. Total Commits per Penalty

**Purpose:**
Displays how many times each penalty was committed across all members and all sessions. Helps identify most-committed penalties.

**Data Source:**
`SessionLog` table with `system=12` (commit summary logs per session)
- Each system=12 log contains `extra.count` field representing total commits for that member-penalty pair in that session
- Aggregate across all sessions and members per penalty

**Calculation Formula:**
```
For each penalty:
  commitCount = SUM(SessionLog.extra.count) WHERE system=12 AND penaltyId=? AND clubId=?
```

**Example:**
If a club has penalties: Kegelkönig, Pudel, Fötzken
- Across all sessions, system=12 logs show:
  - Kegelkönig: 5 + 3 + 7 = 15 total commits
  - Pudel: 8 + 2 = 10 total commits
  - Fötzken: 1 + 4 + 6 + 2 = 13 total commits

**UI Implementation:**
- Displayed as a table under "Commits by Penalty" section
- Columns: [Penalty Name] [Total Commits]
- Rows sorted by: Commits (descending) or Name (ascending) - user selectable
- Filterable by penalty name (click penalty filter chips at top)
- All text wrapped in `<Text>` components
- Style: Light gray row dividers, penalty name in medium font, counts in bold blue

**Sortable & Filterable:**
- Sort button toggles between "by Name" and "by Commits"
- Sort order button toggles between ascending/descending
- Filter chips at top show all available penalties, user can select/deselect
- Table automatically filters and sorts based on selections

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getClubLevelStats()` function
- Lines: 108-119 (system=12 log aggregation)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` lines 245-289

---

### 4. Top 3 Winners per Title Penalty

**Purpose:**
Identifies the top 3 members with the most commits for each title penalty across all sessions. Provides ranking and recognition data.

**Data Source:**
`SessionLog` table with `system=12` (commit summary logs)
- Track member-penalty commit pairs across all sessions
- Only display for penalties that have `isTitle=true`

**Calculation Formula:**
```
For each penalty (isTitle=true):
  For each member:
    winCount = SUM(SessionLog.extra.count) WHERE system=12 AND memberId=? AND penaltyId=? AND clubId=?
  Sort members by winCount descending
  Return top 3 (if fewer than 3, return all)
```

**Example:**
For "Kegelkönig" penalty:
- Member A: 8 commits total
- Member B: 5 commits total
- Member C: 3 commits total
- Member D: 2 commits total
- **Top 3 Rankings:**
  - 🥇 #1: Member A (8 commits)
  - 🥈 #2: Member B (5 commits)
  - 🥉 #3: Member C (3 commits)

**UI Implementation:**
- Displayed in "Top Winners by Penalty" section below commits table
- For each title penalty, show penalty name as section header
- List members in ranked order (1-3), showing rank, member name, and commit count
- Format: `#1 Member Name  8 commits`
- All text wrapped in `<Text>` components
- Styling: Penalty title in bold, rank in blue, member name in primary color, count in gray

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getClubLevelStats()` function
- Lines: 137-175 (top winners aggregation and sorting)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` lines 293-309

---

### 5. All-Time Commit Matrix (Member × Penalty)

**Purpose:**
Provides a comprehensive grid view of commits for each member across all penalties, making patterns visible at a glance.

**Data Source:**
`SessionLog` table with `system=12` (commit summary logs)
- Aggregate commits per member-penalty pair across all sessions

**Calculation Formula:**
```
For each member:
  For each penalty:
    commitCount = SUM(SessionLog.extra.count) WHERE system=12 AND memberId=? AND penaltyId=? AND clubId=?
    Create cell(member, penalty) = commitCount
```

**Example:**
| Member | Kegelkönig | Pudel | Fötzken |
|--------|-----------|-------|---------|
| A      | 5         | 2     | 1       |
| B      | 3         | 4     | 2       |
| C      | 7         | 4     | 10      |

**UI Implementation:**
- Displayed as grid layout in "Commit Matrix (Member × Penalty)" section
- X-axis: Penalty names (horizontal columns)
- Y-axis: Member names (vertical rows)
- Each cell displays count (or "—" if zero)
- Cell background: Green (#d1fae5) if count > 0, light gray (#f3f4f6) if count = 0
- All text wrapped in `<Text>` components
- Scrollable horizontally for many penalties

**Filtering & Sorting:**
- Automatically respects penalty and member filters selected at top of tab
- Displays only selected members (rows) and selected penalties (columns)

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getClubLevelStats()` function
- Lines: 177-192 (commit matrix building)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` lines 313-349

---

## B. Member-Level All-Time Statistics

### 1. Total Penalty Amount per Member

**Purpose:**
Shows the cumulative penalty amount each member has incurred across all finished sessions.

**Data Source:**
`SessionLog` table with `system=11` (final session summary logs)
- Each system=11 log contains the member's final amount for that session
- Aggregate per member across all sessions

**Calculation Formula:**
```
For each member:
  totalAmount = SUM(SessionLog.amountTotal) WHERE system=11 AND memberId=? AND clubId=?
```

**Example:**
For Member A across 3 sessions:
- Session 1: €50 (system=11 log)
- Session 2: -€10 (credit, system=11 log)
- Session 3: €25 (system=11 log)
- **Total Amount = €50 + (-€10) + €25 = €65**

**UI Implementation:**
- Displayed in member card under "Member Statistics" section in Member-Level tab
- Format: `{currency}{amount.toFixed(2)}` (e.g., "€65.00")
- Currency sourced from `Club.currency`
- Label: "Total Amount:"
- All text wrapped in `<Text>` components
- Styling: Label in gray, value in bold primary color

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getMemberLevelStats()` function
- Lines: 260-264 (system=11 log aggregation per member)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` line 478

---

### 2. All-Time Playtime per Member

**Purpose:**
Shows the total duration each member has actively participated in sessions, helping measure engagement.

**Data Source:**
`SessionLog` table with `system=15` (member playtime logs created at session end)
- Each system=15 log contains `extra.playtime` field (duration in seconds for that member in that session)
- Aggregate per member across all sessions
- **Important:** system=15 logs must be created by session finalization process with member's playtime

**Calculation Formula:**
```
For each member:
  totalPlaytime = SUM(SessionLog.extra.playtime) WHERE system=15 AND memberId=? AND clubId=?
  formatTime(seconds) = {hours}h {minutes}m
```

**Example:**
For Member A across 3 sessions:
- Session 1: 1h 30m = 5,400 seconds (system=15)
- Session 2: 45m = 2,700 seconds (system=15)
- Session 3: 30m = 1,800 seconds (system=15)
- **Total Playtime = 5,400 + 2,700 + 1,800 = 9,900 seconds = 2h 45m**

**UI Implementation:**
- Displayed in member card under "Member Statistics" section in Member-Level tab
- Format: `{hours}h {minutes}m` (e.g., "2h 45m")
- Label: "Playtime:"
- All text wrapped in `<Text>` components
- Styling: Label in gray, value in bold primary color

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getMemberLevelStats()` function
- Lines: 265-268 (system=15 log aggregation per member)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` line 481
- **Dependency:** Session finalization must create system=15 logs in sessionFinalizationService.ts

---

### 3. Attendance (Sessions & Percentage)

**Purpose:**
Shows both the count of sessions a member participated in and their participation percentage relative to total club sessions.

**Data Source:**
- `SessionLog` table to track which sessions each member participated in (any log entry with that memberId)
- `Session` table to count total finished sessions in the club

**Calculation Formula:**
```
For each member:
  attendanceSessions = COUNT(DISTINCT SessionLog.sessionId) WHERE memberId=? AND clubId=?
  totalClubSessions = COUNT(DISTINCT Session.id) WHERE clubId=? AND status='finished'
  attendancePercentage = (attendanceSessions / totalClubSessions) * 100
```

**Example:**
If club has 10 finished sessions total:
- Member A participated in 8 sessions (8 unique sessionIds in logs)
- **Attendance: 8 sessions (80%)**

**UI Implementation:**
- Displayed in member card under "Member Statistics" section in Member-Level tab
- Format: `{attendanceSessions} sessions ({attendancePercentage.toFixed(0)}%)`
- Example display: "8 sessions (80%)"
- Label: "Attendance:"
- All text wrapped in `<Text>` components
- Styling: Label in gray, value in bold primary color

**Implementation Location:**
- File: `/src/services/allTimeStatisticsService.ts` → `getMemberLevelStats()` function
- Lines: 271-285 (attendance calculation)
- UI File: `/src/screens/statistics/AllTimeStatisticsTab.tsx` line 484

---

## C. Filters & Controls

### Penalty Filter (Club-Level Tab)

- Filter chips show all penalties
- User can click to toggle selection (blue = selected, gray = not selected)
- Affects: Commits table, Top Winners, Commit Matrix
- Default: All shown (if selectedPenalties.size === 0)

### Member Filter (Member-Level Tab)

- Filter chips show all members
- User can click to toggle selection (blue = selected, gray = not selected)
- Affects: Member cards list
- Default: All shown (if selectedMembers.size === 0)

### Sorting Controls

**Club-Level:** Sort commits table by Name or Commits, Ascending or Descending
**Member-Level:** Sort by Amount, Playtime, Attendance, or Name, Ascending or Descending

---

## D. Export Functionality (CSV)

**Club-Level Export File:** `club-statistics-{YYYY-MM-DD}.csv`
- Summary section: Total Amount, Total Playtime, Total Commits
- Commits by Penalty table
- Top Winners by Penalty section
- Commit Matrix grid

**Member-Level Export File:** `member-statistics-{YYYY-MM-DD}.csv`
- CSV with headers: Member Name, Total Amount, Total Playtime (formatted), Playtime (seconds), Attendance Sessions, Attendance %
- One row per member

**Implementation:**
- File: `/src/services/statisticsExportService.ts`
- Functions: `generateClubStatisticsCSV()`, `generatePlayerStatisticsCSV()`, `exportToCSV()`
- Uses: expo-file-system and expo-sharing

---

## E. React Native Rendering - Critical Requirement

**All text content MUST be wrapped in `<Text>` components.**

This prevents the error: "Text strings must be rendered within a <Text> component"

✅ Correct:
```jsx
<Text style={styles.label}>Total Amount:</Text>
```

❌ Wrong:
```jsx
<View>Total Amount:</View>
```

**Verified in implementation:**
- [x] Summary card (lines 212-223)
- [x] Filter chips (lines 232-243, 407-417)
- [x] Table rows (lines 284-289)
- [x] Winner rows (lines 305-310)
- [x] Matrix cells (lines 332-343)
- [x] Member cards (lines 477-487)

---

## F. Testing Checklist

### Component Render
- [x] No "Text must be rendered within <Text>" errors

### Club-Level Tab
- [ ] Total Amount displays with currency (€240.00)
- [ ] Total Playtime displays as h:m (4h 15m)
- [ ] Commits table shows all penalties with counts
- [ ] Sorting by name/commits works both ways
- [ ] Penalty filter chips toggle and filter
- [ ] Top Winners show top 3 per title penalty
- [ ] Matrix displays with green/gray cells

### Member-Level Tab
- [ ] Member cards show all 3 metrics
- [ ] Total Amount has currency (€65.00)
- [ ] Playtime shows h:m (2h 45m)
- [ ] Attendance shows sessions + % (8 sessions (80%))
- [ ] Member filter chips work
- [ ] Sorting by all 4 keys works both ways

### Export
- [ ] CSV button generates file
- [ ] Share dialog appears
- [ ] CSV has correct data and currency symbols

### Data Accuracy
- [ ] Total Amount = sum of system=11 logs
- [ ] Playtime = sum of session durations
- [ ] Commits = sum of system=12 logs
- [ ] Winners ranked by commit count
- [ ] Member totals sum to club total
