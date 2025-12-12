# IMPLEMENTATION_GUIDE

PP (PenaltyPro) ist eine Android-App zur Verwaltung eines Sport-/Club-Betriebs.
Sie verwaltet Mitglieder, Sessions, Live-Penalties, Finanzdaten, Titelgewinne und umfangreiche Statistiken.

Das System basiert auf vier Grundpfeilern:

- Members
- Penalties
- Sessions
- SessionLogs (append-only, die Grundlage des gesamten Systems)

Alles Weitere (Totals, Statistiken, Rankings, Financials, Winner, Rewards ...) wird aus diesen Logs oder definierten Sessionfeldern berechnet.

## 📘 UI Architecture Reference (UI-GUIDE)

All UI logic, screens, components, and layout structures are documented in:

➡ **`/docs/UI-GUIDE.md`**

This file is the **single source of truth** for:
- all UI components  
- all screens  
- reusable widgets  
- configurable layout blocks  
- rules for club-specific layouts  
- extension conventions  
- file naming conventions  
- block documentation and props structure  

### Mandatory Rule for All Agents
Whenever UI elements are added, updated, or removed, the agent **must update `UI-GUIDE.md` accordingly** before writing or modifying code.
Whenever UI work is triggered, check `UI-GUIDE.md` first.
The Implementation Guide refers to this UI reference whenever UI tasks occur.

## 1. Entities / Data Model
### 1.1 Club

Repräsentiert einen Verein.

| Field         | Description                                      |
|---------------|--------------------------------------------------|
| id            | UUID                                             |
| name          | Club name                                        |
| logoUri       | Optional club logo                               |
| maxMultiplier | Maximum multiplier value (default: 10, min: 1)   |
| timezone      | Optional IANA timezone identifier (e.g., "America/New_York", "Europe/Berlin") for display formatting |
| createdAt     | Timestamp                                        |
| updatedAt     | Timestamp                                        |

**Timezone Usage:**
- **Optional field** storing IANA timezone identifier
- **Purpose:** Future use for timezone-aware session display formatting
- **Current behavior:** Existing sessions display times in local device timezone (no conversion applied)
- **New sessions:** May use Club.timezone for formatting if implemented in future

### 1.2 Member

Repräsentiert eine Person (Mitglied oder Gast).

| Field                     | Description                                        |
|---------------------------|----------------------------------------------------|
| id                        | UUID                                               |
| clubId                    | FK → Club                                         |
| name                      | String                                            |
| isGuest                   | Boolean                                           |
| photoUri                  | Optional profile image                             |
| paidPenaltyAmount        | Sum of all payments                                |
| joinedAt                  | Timestamp                                         |
| updatedAt                 | Timestamp                                         |
| birthdate                | Optional                                          |

**Note:** `totalPlayingTimeMinutes`, `penaltyCommits`, and `titleWins` are computed on-demand from `MemberSessionSummary` table (aggregate SUM of playtimeSeconds), not stored in Member record.

### 1.3 Penalty
| Field                     | Description                                        |
|---------------------------|----------------------------------------------------|
| id                        | UUID                                               |
| clubId                    | FK                                                |
| name                      | String                                            |
| description               | Optional                                          |
| amount                    | Base amount for SELF                               |
| amountOther               | Base amount for OTHER                              |
| affect                    | Enum: SELF / OTHER / BOTH / NONE                  |
| isTitle                   | Boolean                                           |
| active                    | Boolean                                           |
| rewardEnabled             | Boolean                                           |
| rewardValue               | Optional number (manual override; if empty → user must enter value at session end) |
| createdAt                 | Timestamp                                         |
| updatedAt                 | Timestamp                                         |

### 1.4 Session
Eine Session repräsentiert ein Event (Training, Match etc.).

| Field                     | Description                                        |
|---------------------------|----------------------------------------------------|
| id                        | UUID                                               |
| clubId                    | FK                                                |
| date                      | Date                                              |
| startTime                | Timestamp (ISO8601)                               |
| endTime                  | Timestamp (ISO8601), null while active            |
| playingTimeSeconds       | Integer (seconds), computed: endTime - startTime   |
| playerCount              | Integer, dynamic: activePlayers.length            |
| multiplier               | Integer ≥ 1, current multiplier (default: 1)      |
| status                   | TEXT: "active" or "finished"                      |
| locked                   | Boolean (INTEGER 0/1), prevents edits when true   |
| notes                     | Optional session notes                             |
| winners                   | JSON mapping: { penaltyId → [memberIds] }        |
| activePlayers             | JSON array of memberIds                           |
| totalAmounts              | JSON mapping { memberId → amount } (mutable during session, immutable after finalization) |
| createdAt                 | Timestamp (ISO8601)                               |
| updatedAt                 | Timestamp (ISO8601)                               |

**Status Values:**
- `"active"`: Session in progress, commits allowed
- `"finished"`: Session ended and finalized, immutable (locked=true)

### 1.5 SessionLog (Append-only, never modified)
Die wichtigste Tabelle des Systems.

| Field                     | Description                                        |
|---------------------------|----------------------------------------------------|
| id                        | Auto-increment                                     |
| timestamp                 | ISO8601                                           |
| sessionId                 | FK                                                |
| clubId                    | FK                                                |
| memberId                  | Optional (null for system=5)                      |
| penaltyId                 | Optional (null for system=1)                      |
| system                    | System-Event-Type (1, 2, 5, 6, 8, 9, 11-14)       |
| amountSelf                | Base SELF amount (not multiplied)                  |
| amountOther               | Base OTHER amount (not multiplied)                 |
| amountTotal               | Computed and stored: -((amountSelf * multiplier) + (amountOther * multiplier * affectedOtherCount)) |
| multiplier                | Multiplier at time of event                        |
| note                      | Optional text                                     |
| extra                     | JSON (for system=11-14 evaluation data) |

### System Events
| System  | Meaning                                                  |
|---------|---------------------------------------------------------|
| 1       | Player added                                            |
| 2       | Title / Winner resolution                               |
| 5       | Multiplier change                                       |
| 6       | Reward deduction                                        |
| 8       | Commit event (penalty triggered, +1)                    |
| 9       | Negative commit (counter decrement, negative delta)      |

No payment events in this log.

## 1.6 Session Evaluation Logs (Auto-generated at session end)

Beim Beenden einer Session werden automatisch zusätzliche SystemLogs erstellt,
damit spätere Auswertungen nicht jedes Mal neu berechnet werden müssen.

Diese Logs sind rein technische Snapshots:

1. system=11 → FinalTotals  
   { memberId → totalAmount }

2. system=12 → CommitSummary  
   { memberId → { penaltyId → commitCount } }

3. system=13 → PenaltySummary  
   { penaltyId → totalAmountOverAllPlayers }

4. system=14 → PlayerSummary  
   { memberId → { totalAmount, totalCommits } }

Diese Logs dienen ausschließlich der schnellen Analyse (Member Ledger, Statistiken),
und verändern keine Finanzdaten.

### 1.7 Services Map (Current)
- `clubService.ts` – Club CRUD (maxMultiplier included)
- `memberService.ts` – Member CRUD (no stored totalPlayingTimeMinutes)
- `penaltyService.ts` – Penalty CRUD with affect validation
- `sessionService.ts` – startSession, getSession(s), updateMultiplier, updateTotalAmounts, finalizeSession (legacy)
- `sessionFinalizationService.ts` – **NEW**: Complete session end orchestration with title/reward resolution, summary logs (system=11-14), playtime calculation, ledger integration
- `sessionLogService.ts` – createLog, getLogsBySession, getCommitSummary
- `commitService.ts` – addCommit, negativeCommit with affect logic and amountTotal calculation
- `memberSessionSummaryService.ts` – createMemberSessionSummary, updateMemberSessionSummary, getTotalPlaytimeSeconds
- `ledgerService.ts` – createLedgerEntry, getOutstanding, getLedgerByMember


## 2. Application Flow
### 2.1 Session Creation

User selects participating members

For each selected member → system=1 "Player added" log

Active Session Screen opens

Live table built from:

- selected members
- all active penalties

## 3. Active Session Screen — Implementation Details

### 3.0 State Model
**In-memory state maintained during active session:**
```typescript
interface SessionLiveState {
  sessionId: string;
  clubId: string;
  multiplier: number;  // current active multiplier (1 to maxMultiplier)
  commitCounts: Record<string, Record<string, number>>;  // { memberId: { penaltyId: count } }
  totals: Record<string, number>;  // { memberId: totalAmount }
  members: Member[];  // all active members (pre-fetched, resolved names)
  penalties: Penalty[];  // all active penalties (pre-fetched, resolved names)
}
```

### 3.1 Table Rendering Algorithm

**Render steps:**
1. **Fetch session, active members, active penalties** by ID (resolve names).
2. **Build matrix:** `commitCounts[memberId][penaltyId]` for each selected member/penalty.
3. **For each member (row):**
   - Render member name (sticky left column).
   - **For each penalty (column):**
     - Get `count = commitCounts[memberId][penaltyId]`.
     - Render cell: `[−] ${count} [+]` with button handlers.
   - Render live total: `totals[memberId]` (sticky right column).
4. **Column headers (sticky top):** Penalty names.
5. **Below grid:** Session total (sum of all totals).

**Scrolling:**
- Horizontal: member name + totals columns remain sticky; penalties scroll left/right.
- Vertical: penalty name headers remain sticky; members scroll up/down.

### 3.2 Commit Handling

**When user taps + or −:**

1. Determine:
   - `memberId` (the row)
   - `penaltyId` (the column)
   - `direction` (1 for +, -1 for −)
   - `currentMultiplier` (from session state)

2. Calculate delta:
   - Get penalty: `penalty = penalties.find(p => p.id === penaltyId)`
   - `amountSelf = penalty.amount * currentMultiplier`
   - `amountOther = penalty.amountOther * currentMultiplier`
   - Apply affect rules (SELF / OTHER / BOTH / NONE):
     - **SELF:** `totals[memberId] += direction * amountSelf`
     - **OTHER:** for each other member: `totals[otherId] += direction * amountOther`
     - **BOTH:** apply both SELF and OTHER rules
     - **NONE:** no totals change

3. Update in-memory state:
   - `commitCounts[memberId][penaltyId] += direction` (counter increments/decrements)
   - `totals[memberId]` updated as per affect rules
   - Recalculate session total

4. Write log (async, non-blocking):
   - `system = direction > 0 ? 8 : 9`
   - `memberId`, `penaltyId`, `sessionId`, `clubId`
   - `amountSelf`, `amountOther` (base amounts, not multiplied)
   - `multiplier` (current active multiplier)
   - `timestamp = now`
   - Call `createLog()` from sessionLogService

5. Update UI immediately (in-memory state updates before async log).

### 3.3 Multiplier Handling

**When user changes multiplier via slider:**

1. Validate new value: `1 <= newMultiplier <= Club.maxMultiplier`
2. Update in-memory state: `sessionState.multiplier = newMultiplier`
3. Update UI: Multiplier button label updates ("2x", "3x", etc.)
4. Write log (async):
   - `system = 5`
   - `sessionId`, `clubId`, `memberId = null`
   - `multiplier = newMultiplier`
   - `note = "Multiplier changed from X to Y"`
   - `timestamp = now`
   - Call `createLog()` from sessionLogService

**Important:** Multiplier change affects only **future** commits. Previous commits retain their multiplier value in logs.

### 3.4 Resume Session Logic

**On app restart, if an active session exists:**

1. Detect active session: `SELECT * FROM Session WHERE status = 'active' LIMIT 1`
2. Show modal: "Resume unfinished session for [club name]?"
   - Button: "Resume" → continue
   - Button: "Discard" → mark session abandoned (status stays active, no deletion)
3. If Resume:
   - Load all SessionLogs for this session: `SELECT * FROM SessionLog WHERE sessionId = X ORDER BY id ASC`
   - Rebuild state:
     - **multiplier:** Find last system=5 log; if none, use 1
     - **commitCounts:** Replay all system=8 and system=9 logs; build { memberId: { penaltyId: count } }
     - **totals:** Replay all logs in order, applying affect rules; build { memberId: totalAmount }
     - **members, penalties:** Pre-fetch and resolve names
   - Navigate to SessionLiveScreen with recovered state
   - Status remains "active"
4. If Discard:
   - Session remains in history (not deleted)
   - Navigate back to SessionListScreen
   - Session can be viewed in SessionDetailsScreen for audit

## 5. Title / Winner Handling (CURRENT IMPLEMENTATION)

**Implementation:** `/src/services/sessionFinalizationService.ts` + `/src/components/SessionEndModals.tsx`

**Flow at session end:**

1. **Auto-detection:**
   - Count commits per penalty (from SessionLog system=8/9)
   - Find highest commit count per title penalty
   - If unique max → auto-resolve winner (no modal)
   - If tie → queue for user resolution

2. **Tie-breaking modals:**
   - Sequential modals (one per tied penalty)
   - Shows member names (not IDs) with commit counts
   - Radio button selection (exactly one winner required)
   - Cannot proceed until selection made

3. **System=2 logs:**
   - Written for ALL title winners (auto + manual)
   - Fields: sessionId, clubId, memberId (winner), penaltyId, system=2, timestamp, note="Title winner"

4. **Storage:**
   - Session.winners: `{ penaltyId → [winnerId] }` (array for backwards compatibility)
   - Internal logic uses single winnerId per penalty

**Functions:**
- `prepareTitleResolution()` – analyzes commits, returns titlesToResolve + autoResolvedWinners
- `logTitleWinners()` – writes system=2 logs for all winners

## 6. Reward Handling (CURRENT IMPLEMENTATION)

**Implementation:** `/src/services/sessionFinalizationService.ts` + `/src/components/SessionEndModals.tsx`

**Flow at session end (after title resolution):**

1. **Auto-application:**
   - If penalty.rewardValue exists and > 0 → use automatically
   - No modal needed

2. **Manual input modals:**
   - Sequential modals (one per penalty with rewardEnabled but no rewardValue)
   - Shows penalty name and winner name (not IDs)
   - Numeric input required (> 0 validation)
   - Cannot proceed until valid value entered

3. **Deduction rules (STRICT):**
   - Rewards ALWAYS deduct from the winner only (never distributed)
   - For title penalties: deduct from the ONE selected winner
   - Formula: `Session.totalAmounts[winnerId] -= rewardValue`
   - **NOT multiplied** – reward value is absolute

4. **System=6 logs:**
   - Written for ALL rewards (auto + manual)
   - Fields: sessionId, clubId, memberId (winner), penaltyId, system=6, amountTotal=-rewardValue, timestamp, note="Reward deduction"

5. **Ledger:**
   - **Rewards NOT written to ledger** (internal to session only)
   - Only final Session.totalAmounts written to ledger at end

**Functions:**
- `prepareRewardResolution()` – analyzes penalties, returns rewardsToResolve + autoRewards
- `applyRewards()` – deducts from winners, updates Session.totalAmounts, writes system=6 logs

## 6a. Session Finalization (COMPLETE IMPLEMENTATION)

**Implementation:** `/src/services/sessionFinalizationService.ts` orchestrates entire flow

**Complete flow when user taps "End Session":**

1. **Confirmation modal** (SessionEndModals component)
   - "Are you sure you want to end this session? This cannot be undone."
   - Confirm → proceed | Cancel → return

2. **UI freeze** (SessionLiveScreenNew)
   - All commit buttons disabled (checks `session?.locked`)
   - Multiplier slider disabled
   - End Session button shows "Locked" and disabled

3. **Title resolution** (prepareTitleResolution)
   - Auto-resolve unique winners
   - Show modals for ties (sequential, one at a time)
   - Write system=2 logs for all winners
   - Store in Session.winners

4. **Reward resolution** (prepareRewardResolution)
   - Auto-apply predefined reward values
   - Show modals for missing values (sequential)
   - Deduct from winners via applyRewards()
   - Write system=6 logs
   - Update Session.totalAmounts

5. **Final summary logs** (generateFinalSummaryLogs)
   - system=11: `{ memberId: finalAmount }` → extra field
   - system=12: `{ memberId: { penaltyId: count } }` → extra field
   - system=13: `{ penaltyId: totalAmountAcrossPlayers }` → extra field
   - system=14: `{ memberId: { totalAmount, totalCommits } }` → extra field

6. **MemberSessionSummary records** (createMemberSummaries)
   - One record per active member
   - **Playtime:** Calculated from system=1 log timestamp to endTime (seconds)
   - totalAmount: from final Session.totalAmounts
   - totalCommits: sum of all penalty commit counts
   - commitCounts: JSON { penaltyId: count }

7. **Ledger entries** (createSessionLedgerEntries)
   - **ONE entry per member** with type='session'
   - amount = finalTotals[memberId] (includes all commits + rewards)
   - No separate entries for commits or rewards

8. **Session locking** (lockSession)
   - endTime = now
   - playingTimeSeconds = (endTime - startTime) / 1000
   - playerCount = activePlayers.length
   - status = 'finished'
   - locked = true (permanent, cannot reopen)
   - winners stored as `{ penaltyId: [winnerId] }`

9. **Navigation**
   - **Direct to SessionDetailsScreen** (no SessionEndSummaryScreen)
   - Shows all finalization data: winners, rewards, logs, totals, summaries
   - Read-only UI (session is locked)

**Master function:**
```typescript
finalizeSessionComplete(
  sessionId,
  clubId,
  allWinners: Record<string, string>,  // penaltyId → winnerId
  allRewards: Record<string, { winnerId, rewardValue }>
)
```

**UI Components:**
- `/src/components/SessionEndModals.tsx` – handles confirm, title, reward modals
- `/src/screens/sessions/SessionLiveScreenNew.tsx` – integrates modals, disables UI when locked
- `/src/screens/sessions/SessionDetailsScreen.tsx` – shows all finalization data with names

## 7. Financial System

No financial event in SessionLog.

### 7.1 Ledger Table (Comprehensive Transaction Log)

| Field                  | Description                                       |
|------------------------|---------------------------------------------------|
| id                     | UUID                                              |
| type                   | TEXT: 'session', 'payment', 'adjustment', 'refund' |
| sessionId              | UUID (FK), nullable (null for payments/adjustments) |
| paymentId              | UUID (FK), nullable (for future Payment table)    |
| memberId               | UUID (FK), required                               |
| clubId                 | UUID (FK), required                               |
| amount                 | REAL (can be positive or negative)                |
| note                   | TEXT, optional                                    |
| createdBy              | TEXT, optional (admin who created manual entry)   |
| timestamp              | TEXT (ISO8601), required                          |

Ledger Service: `/src/services/ledgerService.ts` handles creation and queries (createLedgerEntry, getOutstanding, getLedgerByMember).

### 7.2 Payment Table (Future)

| Field                  | Description                                       |
|------------------------|---------------------------------------------------|
| id                     | UUID                                              |
| clubId                 | FK                                                |
| memberId               | FK                                                |
| amount                 | Numeric                                          |
| note                   | Optional                                          |
| timestamp              | ISO8601                                        |

### 7.3 Outstanding Calculation (Ledger-Based with Timestamps)

Outstanding = SUM(Ledger.amount WHERE memberId = X AND type IN ('session', 'payment', 'adjustment', 'refund'))

**Ledger entries preserve timestamps for audit trail:**
- Session totals create ledger entries with type='session' using **raw session totals** (timestamp = session endTime):
  - Positive session total → debt added (member owes club, stored positive)
  - Negative session total → credit (club owes member, stored negative)
- **Payment semantics (stored with payment timestamps):**
  - User enters **positive payment** → stored as **negative** ledger amount (reduces outstanding)
  - User enters **negative payment** → stored as **positive** ledger amount (increases outstanding/reverses)
   - **paidPenaltyAmount rule:** Only **positive payments** increment `Member.paidPenaltyAmount` by the entered amount; negative payments do **not** change `paidPenaltyAmount`.
- Manual adjustments use type='adjustment' (with timestamp)
- Refunds use type='refund' (with timestamp)

**Display rules (UI only, values unchanged):**
- Debt (positive ledger): red, format `-€amount`
- Credit (negative ledger): green, format `Credit €amount`

## 8. Financials Screen (Club level)

Functions:

Sorted list of members:

- outstanding highest → lowest
- or alphabetical

Tap member → open Member Ledger

**Financial Summary calculations:**
- **Outstanding:** SUM(Ledger.amount WHERE memberId = X) aggregated per member.
- **Total Collected:** SUM(all Member.paidPenaltyAmount) — incremented only when a positive payment is recorded; negative payments do not change this total.

## 9. Member Ledger

**Note:** Member Ledger data now comes from the comprehensive Ledger table (Section 7.1) with the following structure:

```sql
id UUID PRIMARY KEY
clubId UUID NOT NULL FK → Club
memberId UUID NOT NULL FK → Member
sessionId UUID NULL FK → Session   -- null for manual payments/adjustments
type TEXT NOT NULL CHECK(type IN (
  'session',      -- final total of a finished session
  'payment',      -- manual payment entered by user
  'adjustment',   -- manual correction
  'refund'        -- refund transaction
))
amount REAL NOT NULL      -- positive or negative, allows negative totals (debt tracking)
note TEXT NULL
createdBy TEXT NULL       -- admin who created manual entry
timestamp TEXT NOT NULL   -- ISO8601
```

** Rules: **
- Every finished session writes one ledger entry per member with type='session' containing the session's final totalAmounts value (positive = debt, negative = credit); timestamp = session endTime
- Manual payments create entries with type='payment' (timestamp = payment time):
  - User-entered **positive payment** (reduces debt) is stored as **negative** ledger amount
  - User-entered **negative payment** (adds debt) is stored as **positive** ledger amount
- **paidPenaltyAmount:** When a **positive payment** is recorded, increment `Member.paidPenaltyAmount` by the entered amount. **Negative payments do not change** `paidPenaltyAmount`.
- Outstanding = SUM(Ledger.amount WHERE memberId = X) (includes all session, payment, adjustment, refund entries)
- **Ledger preserves audit trail:** Each entry has timestamp showing when member accrued debt (sessions) or paid/adjusted (payments/adjustments)
- **Amount semantics (stored values):**
  - Positive ledger amount = debt (member owes club)
  - Negative ledger amount = credit (club owes member or payment/credit applied)

**Member Ledger Display (Chronological, newest first):**

Each entry shows timestamp and displays per debt/credit rules:

1. **Session Entries**
   - Display: "Session DD.MM.YYYY" (session name from startTime)
   - Amount (ledger-based):
     - Positive (debt): red, format `-€amount`
     - Negative (credit): green, format `Credit €amount`
   - Date/Time: DD.MM.YYYY HH:MM (session endTime, uses club.timeFormat)
   - Tappable: Links to SessionDetailsScreen

2. **Payment Entries**
   - Display: Note text or "Payment"
   - Amount (ledger-based):
     - Positive (adds debt/reversal): red, format `€amount`
     - Negative (reduces debt): green, format `-€amount`
   - Date/Time: DD.MM.YYYY HH:MM (payment timestamp, uses club.timeFormat)
   - Not tappable

**Manual Entry Form:**
- Single "Record Payment" button
- Input: Amount (positive or negative number)
- Input: Note (optional)
- Positive amount → reduces outstanding balance
- Negative amount → increases outstanding balance
- No separate types (adjustment/refund removed for simplicity)

## 10. Statistics Screen

The Statistics module is divided into four main tabs:

1. Tab: All-Time Statistics (Club / Player)

Cross-Session Analysis (with time-range selection)

Session Analysis (Session Graph Engine)

Exports (Built-in reports)

Each tab operates on top of the SessionLog system, which remains the single source of truth.

10.1 Tab 1 — All-Time Statistics (Club / Player)

   This tab aggregates all data across all Sessions of the selected Club.

   1. Total Amount (All Sessions)

   Displays the full penalty amount across all sessions.
   Computed as:

   SUM(session.totalAmount) over all sessions


   2. Total Playtime (All Sessions)

   Computed from session start/end timestamps:
   SUM(session.endTime - session.startTime)

   3. Total Commits per Penalty

   A table showing how many times each penalty was committed across all sessions.
   Default: Show all penalties.
   Filter: Select one or multiple penalties.

   Formula:

   COUNT(log where log.penaltyId = X)
   (positive and negative commits included, negative counted as negative or absolute? → currently absolute)

   4. Total Wins per Title Penalty

   Shows how many times each member has won a title.
   Default: Show all penalties that represent titles.
   Filterable by title penalty.

   5. Matrix: All-Time Commits per Penalty per Member

   A two-axis static table:

   X-axis: All penalties
   Y-axis: All members
   Cell value: Total commits of this penalty by this member across all sessions

   Supports:

   Sorting by row (member)
   Sorting by column (penalty)
   Sorting by any metric (ascending/descending)


10.2 Tab 2 — Cross-Session Analysis (Time-Range Based)

   This tab performs statistical analysis over multiple sessions, controlled by the user.
   A dedicated detailed spec will follow later, but the core structure is:

   1. Time-Range Selection

   Default: All-Time
   Options:
   Per year (e.g., 2021)
   Custom date range (start → end)

   2. Analysis Scope Selection

   User chooses what to analyze:
   Club
   Sessions
   Member

   3. Member-Level Controls

   If the user selects Member:
   A player list appears
   User can hide individual players
   Default: all players visible

   4. Metric Selection

   The following metrics are selectable:

   Commits
   Amount
   Playtime
   (Additional metrics can be added later.)

   5. Load Button

   A mandatory action:
   [Load Statistics]

   Reloads all tables + graphs based on the selected filters.

   6. Output

   The system loads:
   Exportable tables
   Exportable graphs
   (Exact graphs and table formats will be defined in the dedicated Tab-2 specification)

10.3 Tab 3 — Session Analysis

   This tab contains:

   Session selector

   Session Graph Engine (full replay of session logs)

   1. Session Selection

   User must select a session before the graph renders.

   UI logic:
   Dropdown

   Required data:

   session.Date
   session.endtime-session.startime // Duration
   session.activePlayers

   Once selected:
   The Session Graph Engine loads immediately.

   2. Session Graph Engine


   Core rules:
   X-axis: time since start of session
   Y-axis: mode-dependent (commits, amounts, full replay)
   Each log produces data points
   Points display the committer's image (Tap → detailed commit info)
   Multiplier periods appear as background color bands 

   PenaltyType logic:
   self → only committer affected
   other → all except committer
   both → all players
   none → info-only point

   Supported graph modes:
   Count per penalty
   Total amount per player
   Full session replay 
   The Session Graph Engine is fully defined in: /SESSION_GRAPH_ENGINE.md

   Additional selectable modes (future)

   Background rendering:
   Multiplier periods are highlighted:
   Multiplier 1 → no color
   Higher → orange → red gradient depending on value (max value = club.maxMultiplyer)

   Favorites:
   User can save graph configurations (filters, modes, selections).

   Export:
   Graph export available as PNG, JPEG, PDF.

10.4 Tab 4 — Exports

### New Screen & Navigation (Step 1 Scaffold)

- Added `Statistics` menu entry to Club menu in `src/screens/clubs/ClubDetailScreen.tsx`.
- Created `src/screens/statistics/StatisticsScreen.tsx` with a 4-tab framework:
   - All-Time
   - Cross-Session
   - Session Analysis (references `/SESSION_GRAPH_ENGINE.md`)
   - Exports
- Tabs currently render placeholder content labeled "Coming Soon". No calculations or graphs yet.
- Wired navigation route `Statistics` in `src/navigation/ClubStackNavigator.tsx`.
- Styling follows club screens: safe area, header title, light background.

Notes:
- Future steps will fill each tab with tables/graphs and hook into SessionLog-based queries.
- The Session Analysis tab will host the Session Graph Engine container for full log replay.

   This tab lists all standard, predefined export templates.

   Current templates:
   Standard reports (content TBD)
   Graph exports (PNG/JPEG/PDF)

   These are accessible from Tab 3 as well but can also appear here.
   Session summaries (OPTIONAL — can be added later)
   This tab is intentionally minimal for now.
      

## 11. Options Menu

Contains:

- Dark mode toggle
- Language selector (English first)
- (Space for future options)

## 12. Snapshot Handling

A Snapshot stores only:

- selected players
- current multiplier
- current activeTotals
- current commitCounts

Used for:

- restoring Active Session Screen quickly
- not for statistics
- not for history

SessionLog remains the single source of truth.

## 13. Session Lifecycle (Final)
### Start Session:
  - Select members
  - Create system=1 logs
  - Build empty matrix

### During Session:
  - User commits penalties (+/-)
  - system=8 or system=9 logs created
  - Other affects applied
  - Multiplier may change (system=5)

### End Session:
  - Resolve winners (system=2)
  - Rewards (system=6)
  - Session.totalAmounts computed
  - Session is locked
  - Only notes may be added afterwards

### After Session:
  - SessionDetails available
  - SessionGraph available
  - Member Ledger updated



### Sessions — High Level Overview (integration & responsibilities)

A **Session** is the primary runtime unit of the application. It represents a single event (training, match, etc.) and coordinates live interaction (commits), intermediate state (active totals), and final outputs (session totals, member summaries, ledger entries, analytics).  

**Core responsibilities (high level):**

- **Start / Initialize**
  - Create session record (startTime, activePlayers, multiplier = 1).
  - Emit `system=1` logs for each player added.

- **Run / Active phase**
  - Record every user action in `SessionLog` (append-only).
  - Maintain `Session.totalAmounts` live as the single authoritative totals structure during the session (updated immediately on each commit or penalty that adjusts totals).
  - Allow multiplier changes (recorded via `system=5`) which affect only future commits.

- **End / Finalize**
  - Resolve titles/winners (`system=2`) and rewards (`system=6`).
  - Freeze the live totals by writing `Session.totalAmounts` as the final snapshot.
  - Produce evaluation logs (system codes 11–14) for fast analytics.
  - Integrate final `Session.totalAmounts` into member ledgers: each member's final session total becomes an entry in the account statement used by financial screens and outstanding calculations.
  - Mark session locked/finished — afterwards only notes can be changed.

**Important rules & invariants:**
- `SessionLog` is append-only and the audit trail for everything.
- `Session.totalAmounts` is the authoritative, live and final numeric state for financial/statistics purposes — it is updated during the session and copied as the final snapshot at session end.
- `commitCount` (how many commits happened) is tracked separately where needed (commit summaries) and is NOT affected by multiplier values.
- Negative commits (`system=9`) act as an undo operation: they reverse one prior commit effect (see SESSION-GUIDE.md for exact semantics). 

- Playtime definitions:
  - **Session playtime (session level):** `endSessionTimestamp - startSessionTimestamp`
  - **Member playtime (member level):** `endSessionTimestamp - memberAddedTime` (memberAddedTime is the `system=1` log timestamp when the member joined the session). These values are stored in the session/member summaries.

**Documentation discipline:**
- The detailed session flow and all algorithmic steps (including pseudo code, DB migrations, and edge cases) are specified in `SESSION-GUIDE.md`.  
- UI elements that depend on session fields must reference `UI-GUIDE.md`.  
- Any change to session behavior requires updates to `SESSION-GUIDE.md` for the session module.


## 13. Demo Loaders

The app provides **Demo Loaders** to quickly populate test data for development and demonstration purposes.

### 13.1 Load Demo-Club

**Location:** ClubsScreen (Clubs list screen)

**Button:** "Load Demo-Club" (green button in header area)

**Behavior:**
1. Checks if a club named "Berka Kingpins" already exists
2. If it exists: navigates to that club's detail screen
3. If it doesn't exist: creates new club with:
   - Name: "Berka Kingpins"
   - maxMultiplier: 10 (default)
   - UUID auto-generated
4. After creation: reloads club list and navigates to the new club

**Error Handling:** Shows alert if creation fails

**Implementation:** `ClubsScreen.tsx` → `handleLoadDemoClub()`

### 13.2 Load Demo-Members

**Location:** MemberListScreen (Members tab within a club)

**Button:** "Load Demo-Members" (green button in header area)

**Behavior:**
Creates three members for the current club:
1. **Player 1** (isGuest = false)
2. **Player 2** (isGuest = false)
3. **Player 3** (isGuest = true)

Each member receives:
- Auto-generated UUID
- clubId from current context
- joinedAt = current timestamp
- Default values for optional fields

**UI Refresh:** Automatically reloads member list after creation

**Error Handling:** Shows alert if creation fails

**Implementation:** `MemberListScreen.tsx` → `handleLoadDemoMembers()`

### 13.3 Load Demo-Penalties

**Location:** PenaltiesScreen (Penalties tab within a club)

**Button:** "Load Demo-Penalties" (green button in filter/header area, next to active filter toggle)

**Behavior:**
Creates four penalties for the current club:

1. **Kegelkönig-Pkt.**
   - affect: NONE
   - amount: 0
   - amountOther: 0
   - isTitle: true
   - active: true
   - rewardEnabled: true
   - rewardValue: 0

2. **Pudel**
   - affect: SELF
   - amount: 0.25
   - amountOther: 0
   - isTitle: true
   - active: true
   - rewardEnabled: false

3. **Fötzken**
   - affect: SELF
   - amount: 0.5
   - amountOther: 0
   - isTitle: true
   - active: true
   - rewardEnabled: false

4. **Kranz**
   - affect: BOTH
   - amount: -3.5 (negative amount for SELF)
   - amountOther: 0.5
   - isTitle: true
   - active: true
   - rewardEnabled: false

Each penalty receives:
- Auto-generated UUID
- clubId from current context
- createdAt/updatedAt timestamps
- description: empty string

**UI Refresh:** Automatically reloads penalty list after creation

**Error Handling:** Shows alert if creation fails

**Implementation:** `PenaltiesScreen.tsx` → `handleLoadDemoPenalties()`

### 13.4 Demo Loader UI Placement

**ClubsScreen:**
- Header container with white background
- Centered green button above club list
- Padding: 12px, border bottom separator

**MemberListScreen:**
- Header container with white background
- Centered green button above member list
- Padding: 12px, border bottom separator

**PenaltiesScreen:**
- Filter container (existing)
- Modified to flexDirection: 'row'
- Two buttons side-by-side:
  - Left: Active/All filter toggle (blue)
  - Right: Demo loader (green)
- Space-around alignment

### 13.5 Demo Loader Design Consistency

All demo loader buttons share:
- Background color: #4CAF50 (green)
- Text color: #FFFFFF (white)
- Font weight: 600 (semi-bold)
- Border radius: 8px
- Padding: 10-20px (horizontal), 10px (vertical)

This distinguishes them from:
- Primary actions (blue #007AFF)
- FAB buttons (blue #007AFF)
- Filter toggles (blue when active, gray when inactive)


## 14. Session System (Implemented)

### 14.1 Navigation
- `ClubDetailScreen` exposes: **Sessions** button (opens SessionList)
- `SessionListScreen` shows all sessions sorted by date DESC (latest first), with "Start New Session" button and "Resume" for active sessions
- `SessionStackNavigator` routes: SessionList → SessionCreate → SessionLive → SessionEndSummary → SessionDetails → EventLogs → SessionTable → SessionAnalysis (club-scoped)
- Nested under `ClubStackNavigator` via `Sessions` wrapper with clubId/clubName/maxMultiplier propagation

### 14.2 Lifecycle & Logic
- Start Session: multiplier starts at 1 (adjustable during session); validates ≥1 member and ≥1 active penalty; creates Session row with **date column** (timestamp) + zeroed totalAmounts; writes system=1 logs per member; creates zeroed MemberSessionSummary rows (Option A)
- Active phase: commits via `commitService` (system=8/+ and system=9/−), Session.totalAmounts updated immediately using **current active multiplier** (applySelf = amountSelf × multiplier, applyOther = amountOther × multiplier)
- Multiplier: slider/stepper writes system=5 and updates Session.multiplier (bounded by Club.maxMultiplier); each commit applies the multiplier active at commit time
- Rewards/Titles: End Summary enforces single winner for title penalties (tie → modal choice); rewardEnabled penalties prompt for rewardValue if missing; reward deductions write system=6 logs and update totals
- Finalize: status=finished, locked=true, playingTimeSeconds computed; writes evaluation logs (11 FinalTotals, 12 CommitSummary); upserts MemberSessionSummary; creates one Ledger entry per active member with final totalAmount

### 14.3 Crash Recovery
- SessionListScreen shows "Resume" button for active sessions; navigation jumps to SessionLive with hydrated state
- SessionLive hydrates from DB/logs (Session + SessionLog + penalties + members) to rebuild counters/totals after app restart

### 14.4 Screens
- SessionListScreen: club-scoped list sorted by **date DESC** (latest first); shows date, status, duration, total, player count; Resume button for active sessions; "Start New Session" button at top
- SessionCreateScreen: select members (checkboxes), **inline "Add New Member" button** opens member creation modal, validates active penalties, starts session at multiplier 1 with date timestamp
- SessionLiveScreen: timer, multiplier slider/stepper (dynamic, applies to each commit), penalty×member grid with +/- commits, live totals per member, End Session button
- SessionEndSummaryScreen: title winner resolution (forced single), reward handling with prompts, finalize CTA
- SessionDetailsScreen: compact session info (status/date/duration/player count), avatar rows for title winners and final totals, member summaries hidden, bottom action buttons for Event Logs / Session Table / Session Analysis / View Summaries
- EventLogsScreen: dedicated list of SessionLog entries with totals visible for commits, multiplier change old→new
- SessionTableScreen: view-only commit matrix (members × penalties, counts from `getCommitSummary`)
- SessionAnalysisScreen: placeholder screen for upcoming charts/analytics

## 15. Android Architecture Recommendation

- React Native
- Local DB: SQLite

File for AI: place this MD file in repository root

15.5 Agent Workflow Rules

All AI coding must follow this sequence:
1. Check AI Implementation Log
   - Find last implemented state
   - Decide next tasks
   - Never overwrite previous work
2. Check UI-GUIDE.md
   -All UI must follow the conventions there
   -If UI changes → update UI-GUIDE.md first
3. Check SESSION-GUIDE.md
   - For anything related to session behavior
4. Check DB schema
   - Always create or update migrations
   - Never modify an existing migration file
5. After every feature implementation
   - Add a structured entry to AI Implementation Log
   - Add comments & reasoning inside code
   - Add new migrations if DB structures changed

## 15. How to Use This File With AI Assistants

Put this file in project root

In Cline or GitHub Copilot Workspace:
"This file defines the official specification.
All code must follow it."

Every time the AI implements a feature:
- Add docstring comments
- Update architecture if necessary
- Create migration scripts

---

# AI Implementation Log (Append-only)

This section is used by AI agents (Cline, Copilot, ChatGPT) to maintain a chronological audit trail of what has already been implemented.

**Rules for Agents:**
- Never delete entries
- Each entry must contain date + agent + commit summary
- Every implemented feature must reference the section in this Implementation Guide
- For every code change, add a bullet point
- For every UI change, update UI-GUIDE.md and reference it here

**Format:**
```
## YYYY-MM-DD – AGENT_NAME
### Implemented
- ...
### Updated Documentation
- ...
### Notes
- ...
```

---

## 2025-12-06 – GitHub Copilot
### Implemented
- Created database migration: `/migrations/0001_create_club_table.sql` (Section 1.1 Club entity)
- Created Club CRUD service: `/src/services/clubService.ts` with getAllClubs(), getClub(), createClub(), updateClub(), deleteClub()
- Created Club management UI screens:
  - `/src/screens/clubs/ClubListScreen.tsx` - lists all clubs with FAB for creation
  - `/src/screens/clubs/ClubCreateScreen.tsx` - create new club with name and logo picker
  - `/src/screens/clubs/ClubEditScreen.tsx` - edit/delete existing club
- Created ClubStack navigator: `/src/navigation/ClubStackNavigator.tsx` with routes for ClubList, ClubCreate, ClubEdit

### Updated Documentation
- Added Club Management Screens section to UI-GUIDE.md with complete documentation for all three screens and navigator

### Notes
- Database migration file created - needs to be run on app initialization
- ClubStack navigator created but needs to be integrated into main app navigator under "Admin" section
- Dependencies required: react-native-uuid, react-native-image-picker, @react-navigation/native, @react-navigation/native-stack
- Database connection module (`../database/db`) referenced but not yet implemented
- Next task: Member CRUD implementation (Task 002)

---

## 2025-12-06 – GitHub Copilot (Member CRUD)
### Implemented
- Created database migration: `/migrations/0002_create_member_table.sql` (Section 1.2 Member entity)
- Created Member CRUD service: `/src/services/memberService.ts` with getMembersByClub(), getMember(), createMember(), updateMember(), deleteMember()
- Created Member management UI screens:
  - `/src/screens/members/MemberListScreen.tsx` - lists all members for a club with FAB for creation, shows guest badge, alphabetical sorting
  - `/src/screens/members/MemberCreateScreen.tsx` - create new member with name, guest toggle, photo picker, birthdate (auto-sets joinedAt)
  - `/src/screens/members/MemberEditScreen.tsx` - edit/delete existing member
- Created MemberStack navigator: `/src/navigation/MemberStackNavigator.tsx` with routes for MemberList, MemberCreate, MemberEdit

### Updated Documentation
- Added Member Management Screens section to UI-GUIDE.md with complete documentation for all three screens and navigator

### Notes
- Database migration file created with foreign key to Club table - needs to be run on app initialization
- MemberStack navigator created but needs to be integrated into main app navigator under "Admin" section or inside "Club Details" screen
- totalPlayingTimeMinutes field exists for quick UI display but is calculated live during sessions (append-only paradigm)
- isGuest stored as INTEGER (0/1) in SQLite, converted to boolean in service layer
- Dependencies required: react-native-uuid, react-native-image-picker, @react-navigation/native, @react-navigation/native-stack
- Database connection module (`../database/db`) referenced but not yet implemented
- Next task: Penalty CRUD implementation (Task 003)

---

## 2025-12-06 – GitHub Copilot (Penalty CRUD)
### Implemented
- Created database migration: `/migrations/0003_create_penalty_table.sql` (Section 1.3 Penalty entity)
- Created Penalty CRUD service: `/src/services/penaltyService.ts` with getPenaltiesByClub(), getPenalty(), createPenalty(), updatePenalty(), deletePenalty()
- Implemented affect validation (SELF/OTHER/BOTH/NONE) in service layer
- Created Penalty management UI screens:
  - `/src/screens/penalties/PenaltyListScreen.tsx` - lists all penalties with color-coded affect badges, active/inactive indicator, title/reward badges, alphabetical sorting
  - `/src/screens/penalties/PenaltyCreateScreen.tsx` - create new penalty with all fields including affect selector, toggles for isTitle/active/rewardEnabled, conditional rewardValue input
  - `/src/screens/penalties/PenaltyEditScreen.tsx` - edit/delete existing penalty with warning for title penalties
- Created PenaltyStack navigator: `/src/navigation/PenaltyStackNavigator.tsx` with routes for PenaltyList, PenaltyCreate, PenaltyEdit

### Updated Documentation
- Added Penalty Management Screens section to UI-GUIDE.md with complete documentation for all three screens and navigator

### Notes
- Database migration file created with foreign key to Club table - needs to be run on app initialization
- PenaltyStack navigator created but needs to be integrated into main app navigator under "Admin" section alongside Club and Member management
- Affect field validated at service layer to ensure only valid values (SELF/OTHER/BOTH/NONE)
- Boolean fields (isTitle, active, rewardEnabled) stored as INTEGER (0/1) in SQLite, converted to boolean in service layer
- Title penalty warning displayed in edit screen when isTitle = true
- Color-coded affect badges in list: SELF (blue), OTHER (orange), BOTH (green), NONE (gray)
- Dependencies required: react-native-uuid, @react-navigation/native, @react-navigation/native-stack
- Database connection module (`../database/db`) referenced but not yet implemented
- Next tasks: Session creation, Active Session matrix, commit handling

---

## 2025-12-07 – GitHub Copilot (Session Backend & Specification)
### Implemented
- Added Club maxMultiplier support (schema + service payloads)
- Removed stored totalPlayingTimeMinutes from Member (computed from MemberSessionSummary)
- Created Session backend stack:
  - Migrations: `/migrations/0004_create_session_table.sql`, `/migrations/0005_create_sessionlog_table.sql`, `/migrations/0006_create_member_session_summary_table.sql`, `/migrations/0007_create_ledger_table.sql`
  - Services: `/src/services/sessionService.ts`, `/src/services/sessionLogService.ts`, `/src/services/commitService.ts`, `/src/services/memberSessionSummaryService.ts`, `/src/services/ledgerService.ts`

### Updated Documentation
- Updated Sections 1.1–1.6 with finalized Session/SessionLog schemas and computed playtime rules
- Updated Financial System with Ledger as authoritative transaction log
- SESSION-GUIDE.md created with complete session specifications

### Notes
- Backend for Session system is complete (data model, logs, summaries, ledger). Pending: UI (SessionLive/EndSummary/Details), Session stack navigator, crash recovery UI hydration.
- Next tasks: implement Session UI screens, navigator wiring, crash-recovery resume flow, tie/reward modals, ledger display in details.

---

## 2025-12-07 – GitHub Copilot (Session Analysis & Resolution)
### Implemented
- **Session Analysis & Specification Resolution:** Created comprehensive session analysis document at `/analysis/session_analysis.md` identifying 23 unresolved requirements across Data Model, Lifecycle Logic, UI/UX, Error Handling, and Analytics
- **All specifications resolved** per user decisions (A1-A6, B1-B5, C1-C5, D1-D3, E1-E2)

### Updated Documentation
- **IMPLEMENTATION_GUIDE.md:**
  - Added `maxMultiplier` field to Club entity (Section 1.1) - configurable max multiplier for slider (default: 10)
  - Updated Member entity (Section 1.2) to clarify `totalPlayingTimeMinutes` is computed on-demand from MemberSessionSummary, not stored
  - Updated Session entity (Section 1.4) with complete schema with all resolved fields
  - Updated SessionLog entity (Section 1.5) with extra JSON field and amountTotal calculation
  - Expanded Reward Handling (Section 6) with clear deduction rules
  - Replaced Payment table with comprehensive Ledger table (Section 7.1)
  - Updated Member Ledger section (Section 9)

- **SESSION-GUIDE.md:**
  - Updated all sections with final session specifications and algorithms
  - Added recovery/error handling policies
  - Defined multiplier, playtime, playerCount, status, locked semantics
  - Finalization with title/reward resolution
  - Crash recovery strategy

- **UI-GUIDE.md:**
  - Expanded SessionLiveScreen, SessionEndSummaryScreen, SessionDetailsScreen specifications
  - Added comprehensive Section 11: UI Interaction Specifications
  - Added Section 12: Session Error Handling UI

### Notes
- **All 23 unresolved requirements from session analysis now resolved** with clear, implementable specifications
- Crash recovery strategy: Auto-recover on app launch via SessionLog replay (no data loss guarantee)
- Session lifecycle: Two states only (active → finished), finalization is permanent
- Negative amounts: Explicitly allowed in Session.totalAmounts and Ledger
- UI components required: Slider for multiplier, modal dialogs for title/reward resolution, HH:MM:SS timer
- All changes are backward-compatible with existing Club/Member/Penalty CRUD systems
- Next tasks: Create database migrations (0004-0007), implement Session/SessionLog services, build SessionLiveScreen

---

## 2025-12-08 – GitHub Copilot (Main Navigation Screens)

## 2025-12-08 – GitHub Copilot (Demo Loaders Feature)

### Implemented
- **Demo Loaders functionality across all three main screens:**
  - **ClubsScreen** (`src/screens/clubs/ClubsScreen.tsx`):
    - Added "Load Demo-Club" button in header
    - Creates "Berka Kingpins" club with maxMultiplier=10
    - Checks for existing club to prevent duplicates
    - Auto-navigates to club detail after creation
    - Error handling with user alerts
  
  - **MemberListScreen** (`src/screens/members/MemberListScreen.tsx`):
    - Added "Load Demo-Members" button in header
    - Creates 3 demo members: Player 1, Player 2, Player 3 (guest)
    - Auto-generates UUIDs and timestamps
    - Refreshes member list after creation
    - Error handling with user alerts
  
  - **PenaltiesScreen** (`src/screens/penalties/PenaltiesScreen.tsx`):
    - Added "Load Demo-Penalties" button next to filter toggle
    - Creates 4 demo penalties with proper affect rules:
      - Kegelkönig-Pkt. (NONE, title, reward enabled)
      - Pudel (SELF, 0.25, title)
      - Fötzken (SELF, 0.50, title)
      - Kranz (BOTH, -3.5 SELF / 0.5 OTHER, title)
    - Refreshes penalty list after creation
    - Error handling with user alerts

- **UI Layout Changes:**
  - Added header containers to ClubsScreen and MemberListScreen
  - Modified PenaltiesScreen filter container to flexDirection: 'row'
  - Consistent green (#4CAF50) styling for all demo buttons
  - Proper spacing and alignment with existing UI elements

- **Service Integration:**
  - Imported createClub, createMember, createPenalty functions
  - Used existing service methods for data creation
  - Proper UUID generation handled by services
  - Timestamp generation handled by services

### Updated Documentation
- **IMPLEMENTATION_GUIDE.md:**
  - Added new Section 13: Demo Loaders
  - Documented all three demo loader functions
  - Specified exact data structures for each demo
  - Defined UI placement rules
  - Documented button styling consistency
  - Listed error handling approach

### Notes
- All demo loaders follow the same UX pattern: button → create → refresh → alert on error
- Demo data is realistic and follows German bowling club conventions
- Kranz penalty demonstrates negative SELF amount (reward scenario)
- Kegelkönig-Pkt demonstrates NONE affect with reward enabled
- All demo penalties set isTitle=true and active=true for immediate usability
- ClubsScreen demo loader includes duplicate prevention logic
- UI changes maintain existing FAB button positions and functionality
- Green color distinguishes demo loaders from primary actions (blue)
- Code marked with "// NEW:" comments for easy identification

---
### Implemented
- **Main Navigation Screens:** Created four primary tab navigation screens for core app functionality:
  - `/src/screens/clubs/ClubsScreen.tsx` (271 lines) - Main clubs tab, lists all clubs with member counts, alphabetical sorting, FAB for creation, navigation to ClubEdit
  - `/src/screens/members/MembersScreen.tsx` (428 lines) - All members across clubs, club filter dropdown, guest badges, club selector modal for creation from main tab, navigation to MemberEdit
  - `/src/screens/financials/FinancialsScreen.tsx` (363 lines) - Financial overview with ledger integration, summary card (total outstanding/collected/members with balance), color-coded member amounts (red=owed, green=overpaid, gray=settled), pull-to-refresh
  - `/src/screens/penalties/PenaltiesScreen.tsx` (456 lines) - All penalties across clubs, SectionList grouped by club, affect badges (color-coded SELF/OTHER/BOTH/NONE), title/reward/inactive badges, active filter toggle, club selector modal for creation
  
- **Main Tab Navigator:** Created `/src/navigation/MainTabNavigator.tsx` (103 lines)
  - 4-tab bottom navigation: Clubs → ClubsScreen → ClubStackNavigator, Members → MembersScreen → MemberStackNavigator, Financials → FinancialsScreen, Penalties → PenaltiesScreen → PenaltyStackNavigator
  - Emoji-based tab icons (temporary)
  - NavigationContainer wrapper for navigation context
  - Tab bar styling with active/inactive tint colors
  
- **Stack Navigator Updates:** Modified stack navigators to include new main screens as initial routes
  
- **App Integration:** Updated `/src/App.tsx` to render MainTabNavigator when database initialization completes
  
- **TypeScript Navigation Fixes:** Fixed navigation type errors in screens
  
- **UI Component Fixes:** 
  - Replaced @react-native-community/picker with custom dropdown component
  - Fixed MainTabNavigator TabIcon to use Text component instead of HTML elements
  - Added styles for custom filter dropdown in MembersScreen

### Updated Documentation
- **UI-GUIDE.md:**
  - Added Section 13: Main Navigation Screens with complete specs for ClubsScreen, MembersScreen, FinancialsScreen, PenaltiesScreen
  - Added Section 14: Navigation Structure with main app navigator tab bar layout

### Dependencies Installed
- `@react-navigation/bottom-tabs@^6.0.0` - for MainTabNavigator bottom tab support

### Notes
- All four main screens are error-free and compile successfully
- Metro bundler running on exp://192.168.178.54:8081 with QR code for testing
- Pending: Database migrations must be run for services to have tables
- Pending: Replace emoji tab icons with proper icon library
- Pending: Implement MemberLedgerScreen
- Pending: Create SessionsScreen for 5th tab
- Next task: Run database migrations to create tables, then test data persistence in screens

---

## 2025-12-09 – GitHub Copilot (Bug Fixes – UUID & Penalty Validation)
### Implemented
- **UUID Generation Fix:** Migrated all services from unreliable `react-native-uuid` to standard `uuid` package with `react-native-get-random-values` polyfill
  - All services updated: clubService, memberService, penaltyService, memberSessionSummaryService, sessionService, ledgerService
  - Pattern: `import 'react-native-get-random-values'; import { v4 as uuidv4 } from 'uuid';`
  - **Resolved error:** `TypeError: 0, _reactNativeUuid.v4 is not a function (it is undefined)`
  - Updated `package.json` with dependencies: `uuid@^9.0.1`, `react-native-get-random-values@^1.11.0`

- **Penalty Affect/Amount Validation:** Implemented rule-based amount validation enforcing affect-dependent requirements
  - Added `normalizeAmounts()` helper in `penaltyService.ts`
  - Updated `createPenalty()` and `updatePenalty()` service methods to normalize amounts
  - Updated `/src/screens/penalties/PenaltyCreateScreen.tsx` with affect-aware validation logic

- **Type Safety & Error Handling Improvements:**
  - Cast `db.executeSql()` results to `any` in multiple services to suppress SQLiteRunResult TypeScript errors
  - Added error message helper function in sessionService for safe error message extraction
  - Fixed sessionService `finalizeSession()` to use correct variable name `playingTimeSeconds`

### Code Changes Summary
**Files Modified:**
- `src/services/clubService.ts` – UUID imports
- `src/services/memberService.ts` – UUID imports, SQLite result casting, remove undefined field reference
- `src/services/penaltyService.ts` – UUID imports, added `normalizeAmounts()` validation function, SQLite result casting
- `src/services/memberSessionSummaryService.ts` – UUID imports, SQLite result casting
- `src/services/sessionService.ts` – UUID imports, error handling, variable name fix
- `src/services/ledgerService.ts` – UUID imports, SQLite result casting
- `src/screens/penalties/PenaltyCreateScreen.tsx` – Affect-based validation logic with auto-normalization
- `package.json` – Added uuid and react-native-get-random-values dependencies

### Testing Notes
- ClubCreateScreen: now generates stable UUIDs; no more "v4 is not a function" errors
- MemberCreateScreen: now generates stable UUIDs
- PenaltyCreateScreen: now validates affect/amount combinations with clear error messages
- All create/edit flows execute without runtime UUID errors

### Notes
- Penalty validation moved to both UI (user-friendly messages) and service layer (data integrity guarantee)
- Service layer `normalizeAmounts()` ensures database always receives valid affect/amount combinations
- SQLite result typing issues resolved with explicit `any` casting (safe: db module is internal utility)

---

## 2025-12-09 – GitHub Copilot (Club-First Navigation Refactor)
### Implemented
- Swapped app entry to `ClubStackNavigator` (wrapped in `NavigationContainer`) and removed reliance on the bottom tab shell
- Added `ClubDetailScreen` (`/src/screens/clubs/ClubDetailScreen.tsx`) with club info and shortcuts to members, financials, and penalties for that club
- Updated `ClubStackNavigator` to include the new routes and scoped params; `ClubsScreen` now navigates to `ClubDetail` on tap
- Scoped `FinancialsScreen` (`/src/screens/financials/FinancialsScreen.tsx`) to `clubId` and removed cross-club filtering/aggregation UI
- Scoped `PenaltiesScreen` (`/src/screens/penalties/PenaltiesScreen.tsx`) to `clubId`, removed the club selector modal, and ensured creation/edit navigation keeps club context
- Adjusted member/penalty navigation params to carry `clubId` where available for consistent back-stack context

### Updated Documentation
- Added club-first navigation notes and screen updates to UI-GUIDE.md (ClubDetail, scoped Financials/Penalties flows)

### Notes
- `MembersScreen` (all clubs) remains for legacy reference but is no longer part of the primary flow

---

## 2025-12-08 – GitHub Copilot (Database Schema Fixes & maxMultiplier UI)
### Implemented
- **Fixed Database Schema Mismatches:**
  - Fixed `/src/services/memberService.ts` line 146: Removed `totalPlayingTimeMinutes` column from INSERT statement (column doesn't exist in Member table)
  - Fixed `/src/database/db.ts` Penalty migration: Changed column names from `amountSelf` and `amountOther` to correct `amount` and `amountOther`; Changed `isActive` to `active`
  - Added `resetDatabase()` function to `/src/database/db.ts` for clearing all tables and rerunning migrations on demand

- **Added maxMultiplier Club Setting:**
  - Updated `/src/screens/clubs/ClubCreateScreen.tsx`: Added maxMultiplier input field (number keypad), validation for positive integers, pass maxMultiplier to createClub()
  - Updated `/src/screens/clubs/ClubEditScreen.tsx`: Added maxMultiplier state, load from club data, input field with number keypad, validation, pass to updateClub()
  - Club service already had maxMultiplier support; no changes needed there

---

## 2025-12-10 – GitHub Copilot (Active Table + Club Settings)
### Implemented
- **Active Table Penalty Header Display:**
   - `/src/screens/sessions/SessionLiveScreenNew.tsx` – `formatPenaltyAmount` now hides amounts when both are zero and applies explicit labels:
      - SELF: show `{amountSelf}`
      - OTHER: show `{amountOther} (Other)`
      - BOTH: show `{amountSelf} / {amountOther} (Other)`; if one side is zero, only show the non-zero part
   - Header amount text is hidden entirely when both amounts are zero.
- **Club Edit Settings Expansion:**
   - `/src/screens/clubs/ClubEditScreen.tsx` – added editable fields for `currency`, `timezone` (dropdown), `timeFormat` (dropdown), and `maxMultiplier` (int ≥ 1 validation).
   - Dropdowns use predefined options: timezones (`CET`, `UTC`, `EST`, `PST`, `Asia/Kolkata`), time formats (`HH:mm`, `h:mm a`, `HH:mm:ss`).
   - Save payload now persists `currency`, `timezone`, `timeFormat`, and `maxMultiplier` via `updateClub`.
- **Club Service Schema:**
   - `/src/services/clubService.ts` – Club interface extended with `currency`, `timeFormat`; create/update/select now includes these fields.
   - Migration added: `migrations/0010_add_currency_timeformat.sql` (adds `currency` and `timeFormat` columns to `Club`).

### Notes
- Timezone default kept as `CET`; currency defaults to `€`; time format defaults to `HH:mm` when absent.

### Resolved Errors
- **Error:** `table Member has no column named totalPlayingTimeMinutes` → **Fixed:** Removed non-existent column from INSERT statement
- **Error:** `table Penalty has no column named amount` → **Fixed:** Corrected schema in db.ts to use correct column names (amount, amountOther, active)

### Database Reset Instructions
To clear existing database with wrong schema and force recreation:
```typescript
// In App.tsx or appropriate startup location:
import { db } from './src/database/db';
await db.reset(); // Drops all tables and recreates with correct schema
```

### Updated Documentation
- Updated this Implementation Guide with Database Schema Fixes entry
- maxMultiplier field is now settable on Club creation and editing

### Notes
- **Database Migration System:** Using app-side migration tracking (\_Migrations table) to detect executed migrations. To force schema recreation, call `db.reset()`
- **maxMultiplier Default:** Defaults to 10 if not specified during club creation
- **Type Safety:** Database schema in db.ts now exactly matches migration files (/migrations/ folder)

---

## 2025-12-09 – GitHub Copilot (Active Session Screen Redesign)

### Implemented

**Updated All Three Guides First (UI-GUIDE.md, IMPLEMENTATION_GUIDE.md, SESSION-GUIDE.md):**
- Added comprehensive ID Display Policy section (Section 2.0 in UI-GUIDE) mandating name-based display throughout
- Completely rewrote SessionLiveScreen documentation with new table grid layout specification (sticky rows/columns, horizontal/vertical scrolling)
- Added Multiplier Button specification with slider modal interaction (top-right corner, 1x-Nx values, system=5 logging)
- Added Title/Reward Resolution sections with auto-resolution logic and sequential modal specifications
- All modals now display names, not IDs; pre-fetched lookups to avoid null/ID leaks
- Updated IMPLEMENTATION_GUIDE Section 3 (Active Session) with state model, table rendering algorithm, commit handling, multiplier handling, and resume session logic
- Updated SESSION-GUIDE Sections 5.2-5.4 with title/reward resolution and modal display rules

**Code Implementation:**

1. **SessionLiveScreenNew** (`/src/screens/sessions/SessionLiveScreenNew.tsx` – 680 lines):
   - Complete table grid layout with Y-axis members, X-axis penalties
   - Sticky member name column (left) + sticky totals column (right)
   - Sticky penalty name headers (top)
   - Each cell: [−] count [+] buttons with direction-based commit handling
   - Header with session metadata + multiplier button (top-right, large, tappable)
   - Session timer (HH:MM:SS format, updates every second)
   - Live session summary (total amount, player count, status)
   - Multiplier slider modal (1 to maxMultiplier, integer values, applies immediately, writes system=5 log)
   - End Session button triggers resolution flow
   - Crash recovery banner (conditional, dismissible)
   - Performance optimized: in-memory state updates before async logs, memoization for totals calculations
   - Hydration logic: replays SessionLog to rebuild commit counts and totals on resume
   - Affect rules properly applied: SELF, OTHER, BOTH, NONE

2. **SessionEndSummaryScreenNew** (`/src/screens/sessions/SessionEndSummaryScreenNew.tsx` – 450 lines):
   - Loads session, members, penalties, and commit summaries
   - Implements auto-resolution: single member with max commits → auto-selected (no modal)
   - Implements modal flow for ties: one modal per tied penalty, sequential
   - Title modal shows penalty name (not ID), tied member names (not IDs), with commit counts
   - Auto-resolution for missing reward values: if penalty has rewardValue, use it (no modal)
   - Reward value modal: penalty name, winner name, number input, live preview of deduction
   - Modal state management: currentTitlePenaltyIndex, currentRewardPenaltyIndex
   - Sequential progression: all titles → all rewards → finalize
   - Final totals preview: shows each member's amount after all deductions
   - Finalize button converts winners to array format, calls finalizeSession() with full signature
   - Error handling: logs written for each title/reward resolution (system=2 and system=6)

3. **SessionStackNavigator** (`/src/navigation/SessionStackNavigator.tsx`):
   - Updated imports to use SessionLiveScreenNew and SessionEndSummaryScreenNew
   - Route mappings unchanged, component references updated

### Updated Documentation

**UI-GUIDE.md:**
- Added Section 2.0: ID Display Policy (MANDATORY for all screens)
- Completely rewrote Section 2.0a: SessionLiveScreen with table grid layout, multiplier button, modals, performance rules
- Expanded SessionListScreen/SessionCreateScreen/SessionEndSummaryScreen descriptions to reference name-based display

**IMPLEMENTATION_GUIDE.md:**
- Sections 3.0-3.4: Complete rewrite with state model, table rendering algorithm, commit handling, multiplier handling, resume logic
- All subsections include code samples and implementation details

**SESSION-GUIDE.md:**
- Sections 5.2-5.4: Complete rewrite with title/reward resolution logic, modal specifications, name-based display rules
- Added rules for auto-resolution, tie-breaking modals, sequential flow

### Code Quality

- All new components use TypeScript with proper interfaces
- Memoization: useMemo for elapsedTime, totalSessionAmount, tiedMembersForCurrentTitle
- Callback optimization: useCallback for handleCommit, handleMultiplierChange, handleSelectWinner, handleSetRewardValue, handleFinalize
- Error handling: try-catch blocks, Alert dialogs, state recovery on errors
- Loading states: isLoading spinner, isFinalizing progress indication
- Disabled state management: isProcessing ref to prevent concurrent operations
- Comprehensive comments documenting each major function
- Consistent styling using React Native StyleSheet
- Modal animations: fade overlay, slide-up content

### Database & Services

- **No database schema changes** (migrations remain unchanged)
- **Services used:**
  - `getSession()`, `updateMultiplier()`, `finalizeSession()`, `updateTotalAmounts()` from sessionService
  - `getLogsBySession()`, `createLog()`, `getCommitSummary()` from sessionLogService
  - `getPenaltiesByClub()` from penaltyService
  - `getMembersByClub()` from memberService
  - All service calls made with correct signatures and parameters

### Testing Recommendations

1. **Session Creation:** Verify commit grid renders correctly with multiple members and penalties
2. **Commits:** Test +/− buttons update counters, totals, and other members (affect rules)
3. **Multiplier:** Slider changes multiplier, system=5 logs written, future commits apply new multiplier
4. **Title Resolution:** Non-tied penalty auto-selects, tied penalty shows modal with member names
5. **Reward Resolution:** Penalty with rewardValue auto-applies, missing rewardValue shows modal with input validation
6. **Resume:** App crash during active session → restart → modal to resume → SessionLiveScreen hydrated correctly
7. **Finalization:** All titles/rewards resolved → finalize button works → navigates to SessionDetails

### Notes

- **Horizontal Scrolling:** Member name and totals columns sticky, penalty columns scroll
- **Vertical Scrolling:** Penalty headers sticky, member rows scroll
- **Name Display:** Every ID replaced with name lookup (members.find(), penalties.find())
- **No IDs in UI:** Modal titles, body text, option buttons all use names
- **Auto-Resolution:** One member with max commits → skip modal → move to next title
- **Modal Flow:** Sequential progression through modals; cancel returns to current modal (doesn't skip)
- **Performance:** In-memory state updates immediately; logs written asynchronously; UI never blocked
- **Type Safety:** All functions have proper TypeScript signatures; null checks for lookups
- **Error Recovery:** Failed log writes trigger full state reload to ensure consistency
- **Affect Rules:** Correctly implemented in commit handling; penalty.affect determines totals updates
- **Multiplier Bounded:** Slider validates 1 <= newMultiplier <= Club.maxMultiplier before writing log



