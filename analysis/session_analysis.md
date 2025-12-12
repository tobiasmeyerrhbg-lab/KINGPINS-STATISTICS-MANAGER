# Session Analysis Document

**Analysis Date:** December 6, 2025  
**Analyzer:** GitHub Copilot  
**Status:** Complete Analysis (No Implementation)

---

## Executive Summary

This document provides a comprehensive analysis of session-related requirements extracted from three authoritative sources:
- `IMPLEMENTATION_GUIDE.md` (high-level architecture)
- `SESSION-GUIDE.md` (detailed logic and algorithms)
- `UI-GUIDE.md` (user interface specifications)

The analysis identifies **gaps, contradictions, unclear requirements, and missing specifications** that must be resolved before implementation.

---

## 1. Complete Session Data Model

### 1.1 Session Table

| Field | Type | Source | Description | Notes |
|-------|------|--------|-------------|-------|
| id | UUID | IG 1.4 | Primary key | Required on creation |
| clubId | FK (Club) | IG 1.4 | Club reference | Required |
| date | Date | IG 1.4 | Session date | **MISSING: format spec, timezone handling** |
| startTime | Timestamp | IG 1.4, SG 2 | Session start | ISO8601 format per SG |
| endTime | Timestamp | IG 1.4, SG 2 | Session end (nullable) | Null while active, set on finalization |
| playingTime | Minutes | IG 1.4 | Session duration in minutes | **CALCULATED: endTime - startTime** |
| playerCount | Integer | IG 1.4 | Active players | **UNCLEAR: static or dynamic?** |
| notes | Text (Optional) | IG 1.4 | Session notes | Can be added after session ends |
| winners | JSON | IG 1.4 | { penaltyId → [memberIds] } | Populated during title resolution (SG 5) |
| activePlayers | JSON Array | IG 1.4 | [memberIds] | Set at session start from system=1 logs |
| totalAmounts | JSON Map | IG 1.4, SG 2-4 | { memberId → amount } | Live during session, immutable after finalization |
| status | Enum | SG 2, 5 | "active" \| "finishing" \| "finished" | **MISSING: explicit in IG, implied in SG** |
| locked | Boolean | SG 5 | Session locked after finalization | **MISSING: explicit column definition** |
| multiplier | Integer (≥1) | SG 2, 4 | Current multiplier | **MISSING: where stored? In Session or SessionState?** |
| createdAt | Timestamp | IG 1.4 | Creation timestamp | ISO8601 |
| updatedAt | Timestamp | IG 1.4 | Last update timestamp | ISO8601 |

### 1.2 SessionLog Table (Append-only)

| Field | Type | Source | Description | Notes |
|-------|------|--------|-------------|-------|
| id | Auto-increment | IG 1.5, SG 1 | Primary key | Append-only, never modified |
| timestamp | ISO8601 | IG 1.5, SG 1 | Event timestamp | Accurate time of event |
| sessionId | FK (Session) | IG 1.5, SG 1 | Session reference | Required |
| clubId | FK (Club) | IG 1.5, SG 1 | Club reference | Required (denormalized for queries) |
| memberId | UUID (Optional) | IG 1.5, SG 1 | Member involved | Optional (null for system=5) |
| penaltyId | UUID (Optional) | IG 1.5, SG 1 | Penalty involved | Optional (null for system=1) |
| system | Integer | IG 1.5 | Event type code | 1, 2, 5, 6, 8, 9, 11, 12, 13, 14 |
| amountSelf | Numeric (Optional) | IG 1.5, SG 3 | Base SELF amount | For commits (system=8, 9) |
| amountOther | Numeric (Optional) | IG 1.5, SG 3 | Base OTHER amount | For commits (system=8, 9) |
| amountTotal | Numeric (Optional) | IG 1.5 | Total amount | **UNCLEAR: computed or stored separately?** |
| multiplier | Integer (Optional) | IG 1.5, SG 3 | Multiplier at time | For commits, penalty changes |
| note | Text (Optional) | IG 1.5, SG 4 | Human notes | For multiplier changes, debug info |
| extra | JSON (Optional) | SG 3, 9 | Additional metadata | For system=9 (undo), references original log id |

### 1.3 SessionLog System Codes

| Code | Name | Source | When Triggered | Required Fields | Effects |
|------|------|--------|-----------------|-----------------|---------|
| 1 | Player added | IG, SG 2 | On session start for each member | memberId, timestamp | Sets memberAddedTime for playtime |
| 2 | Title/Winner resolved | IG, SG 5 | At session end for title penalties | penaltyId, memberId, note | Updates Session.winners |
| 5 | Multiplier changed | IG, SG 4 | When user changes multiplier | note (from X to Y), timestamp | Affects only future commits |
| 6 | Reward deduction | IG, SG 5 | At session end for rewards | memberId, amount (or rewardValue?) | Deducted from Session.totalAmounts |
| 8 | Commit (positive) | IG, SG 3 | User taps +/increment | memberId, penaltyId, amountSelf, amountOther, multiplier | Updates totalAmounts per affect |
| 9 | Commit (negative/undo) | IG, SG 3 | User taps -/decrement | memberId, penaltyId, extra (ref to system=8) | Reverses specific commit |
| 11 | FinalTotals (eval log) | IG 1.6, SG 5 | At session end | extra: JSON { memberId → amount } | Analytics only, no behavior change |
| 12 | CommitSummary (eval log) | IG 1.6, SG 5 | At session end | extra: JSON { memberId → { penaltyId → count } } | Analytics only |
| 13 | PenaltySummary (eval log) | IG 1.6, SG 5 | At session end | extra: JSON { penaltyId → totalAmount } | Analytics only |
| 14 | PlayerSummary (eval log) | IG 1.6, SG 5 | At session end | extra: JSON { memberId → { totalAmount, totalCommits } } | Analytics only |

### 1.4 MemberSessionSummary Table (Denormalized, created at end)

| Field | Type | Source | Description | Notes |
|-------|------|--------|-------------|-------|
| id | UUID | SG 5 | Primary key | Generated at end |
| sessionId | FK (Session) | SG 5 | Session reference | |
| memberId | FK (Member) | SG 5 | Member reference | |
| clubId | FK (Club) | SG 5 | Club reference | Denormalized |
| totalAmount | Numeric | SG 5 | Final session total | From finalTotals |
| totalCommits | Integer | SG 5 | Total number of commits | From commitSummary |
| commitCounts | JSON | SG 5 | { penaltyId → count } | Per-penalty breakdown |
| playtimeSeconds | Integer | SG 6 | Member's play duration | endTime - system=1 timestamp |
| createdAt | Timestamp | SG 5 | Created at finalization | |

---

## 2. Session Lifecycle Phases

### Phase 1: Selection & Initialization (Pre-session)

**Trigger:** User initiates session creation  
**IG Reference:** 2.1  
**SG Reference:** 2  

**Steps:**
1. User selects participating members from club member list
2. System validates:
   - At least 1 member selected
   - At least 1 active penalty in club
3. Create Session record:
   - `id` = UUID
   - `clubId` = selected club
   - `startTime` = current timestamp
   - `activePlayers` = [memberIds]
   - `totalAmounts` = { memberId: 0 } for each member
   - `multiplier` = 1
   - `status` = "active"
4. For each member, write `system=1` log:
   - `timestamp` = current
   - `memberId` = member id
   - `sessionId` = new session id
   - `system` = 1
   - `note` = optional "player added" message
5. Open Active Session Screen

**UI Reference:** SG 2  
**Unclear Points:**
- Should system=1 log timestamp be used as memberAddedTime, or should it be calculated differently?
- Should we validate penalty.active = true before starting?

---

### Phase 2: Active Session (Live Interaction)

**Duration:** From session start until user presses "End Session"  
**IG Reference:** 3  
**SG Reference:** 3, 4  

#### 2.1 Positive Commit (Increment Penalty)

**When:** User taps + or increment button on a member-penalty cell  
**Steps:**
1. Determine:
   - `memberId` = cell's member
   - `penaltyId` = cell's penalty
   - `currentMultiplier` = session's current multiplier
   - `amountSelf` = penalty.amount
   - `amountOther` = penalty.amountOther
   - `affect` = penalty.affect (SELF/OTHER/BOTH/NONE)
2. Compute applied amounts:
   - `applySelf = amountSelf * currentMultiplier`
   - `applyOther = amountOther * currentMultiplier`
3. Write `system=8` log:
   - `memberId` = committer
   - `penaltyId` = penalty
   - `amountSelf` = penalty.amount (base, not multiplied)
   - `amountOther` = penalty.amountOther (base, not multiplied)
   - `amountTotal` = (penalty.amountOther*multiplyer*(activePlayers.count-1))+(penalty.amount*multiplyer)
   - `multiplier` = currentMultiplier
   - `timestamp` = now
4. Update `Session.totalAmounts`:
   - If `affect == "SELF"`: `totalAmounts[memberId] += applySelf`
   - If `affect == "OTHER"`: for each other member: `totalAmounts[otherId] += applyOther`
   - If `affect == "BOTH"`: apply both rules
   - If `affect == "NONE"`: no update (but log still created)
5. Update in-memory commit counters
6. UI updates immediately with new totals and counter

**UI Reference:** IG 3.2, SG 3  

#### 2.2 Negative Commit (Decrement Penalty)

**When:** User taps + or increment button on a member-penalty cell  
**Steps:**
1. Determine:
   - `memberId` = cell's member
   - `penaltyId` = cell's penalty
   - `currentMultiplier` = session's current multiplier
   - `amountSelf` = penalty.amount
   - `amountOther` = penalty.amountOther
   - `affect` = penalty.affect (SELF/OTHER/BOTH/NONE)
2. Compute applied amounts:
   - `applySelf = amountSelf * currentMultiplier`
   - `applyOther = amountOther * currentMultiplier`
3. Write `system=9` log:
   - `memberId` = committer
   - `penaltyId` = penalty
   - `amountSelf` = penalty.amount (base, not multiplied)
   - `amountOther` = penalty.amountOther (base, not multiplied)
   - `amountTotal` = -(penalty.amountOther*multiplyer*(activePlayers.count-1))+(penalty.amount*multiplyer)
   - `multiplier` = currentMultiplier
   - `timestamp` = now
4. Update `Session.totalAmounts`:
   - If `affect == "SELF"`: `totalAmounts[memberId] -= applySelf`
   - If `affect == "OTHER"`: for each other member: `totalAmounts[otherId] -= applyOther`
   - If `affect == "BOTH"`: apply both rules
   - If `affect == "NONE"`: no update (but log still created)
5. Update in-memory commit counters
6. UI updates immediately with new totals and counter

**UI Reference:** None (system=9 not explicitly in UI-GUIDE)  
**SG Reference:** 3  

#### 2.3 Multiplier Change

**When:** User changes multiplier selector during active session  
**Steps:**
1. Validate new multiplier is integer ≥ 1
2. If valid:
   - Write `system=5` log:
     - `timestamp` = now
     - `note` = "Multiplier changed from X to Y"
     - `multiplier` = new value
   - Update `currentMultiplier` in session state
   - **Do NOT retroactively adjust** previous commits in `Session.totalAmounts`
3. All future commits use new multiplier
4. UI updates multiplier display

**UI Reference:** IG 4  
**SG Reference:** 4  

---

### Phase 3: Session Finalization (End Session)

**Trigger:** User presses "End Session" button  
**IG Reference:** 13 (section)  
**SG Reference:** 5  

#### 3.1 Mode Switch

1. Disable all commit inputs (prevent new +/- actions)
2. Show UI for title resolution and reward input

#### 3.2 Title/Winner Resolution

1. For each penalty with `isTitle = true`:
   - Count commits per member from commit summary
   - Determine highest count(s)
   - If tie → force user to select exactly one winner
   - Write `system=2` log for chosen winner:
     - `penaltyId` = title penalty
     - `memberId` = chosen winner
     - `note` = optional description
   - Update `Session.winners` = { penaltyId: [memberId] }

**UI Reference:** None (explicit UI spec missing)  
**SG Reference:** 5  
**Unclear:** How are ties presented to user? Single selection required?

#### 3.3 Reward Resolution

1. For each penalty with `rewardEnabled = true`:
   - If penalty has `rewardValue` (pre-defined):
     - Use that value
   - Else:
     - Show UI prompt asking for reward value
     - This is a **required input** (SG 5)
   - Apply reward:
     - Write `system=6` log:
       - `memberId` = title winner (from Section 3.2)
       - `penaltyId` = penalty with reward
       - `amountTotal` or `extra` = reward amount
     - Deduct from `Session.totalAmounts[memberId]`

**UI Reference:** None (explicit UI spec missing)  
**SG Reference:** 5  
**Unclear:** Which member gets the reward deduction? Always the title winner? What if no title penalty?

#### 3.4 Finalize Totals

1. Copy `Session.totalAmounts` to local `finalTotals`
2. Write evaluation logs (analytics only, no behavior change):
   - `system=11` FinalTotals:
     - `extra` = { memberId: amount } for all members
   - `system=12` CommitSummary:
     - `extra` = { memberId: { penaltyId: commitCount } }
   - `system=13` PenaltySummary:
     - `extra` = { penaltyId: totalAmountOverAllPlayers }
   - `system=14` PlayerSummary:
     - `extra` = { memberId: { totalAmount, totalCommits } }

**SG Reference:** 5  

#### 3.5 Create MemberSessionSummary Records

1. For each member in session:
   - Create MemberSessionSummary row:
     - `sessionId`, `memberId`, `clubId`
     - `totalAmount` = finalTotals[memberId]
     - `totalCommits` = sum of all commits for this member
     - `commitCounts` = { penaltyId: count }
     - `playtimeSeconds` = endTime - memberAddedTime (from system=1 log)

**SG Reference:** 5, 6  

#### 3.6 Ledger Integration

1. For each member:
   - Insert ledger/statement entry:
     - `type` = "session"
     - `sessionId` = session id
     - `memberId` = member id
     - `clubId` = club id
     - `amount` = finalTotals[memberId]
     - `timestamp` = now

**Note:** Ledger table structure **not defined in any guide**  
**SG Reference:** 5, implied by "Member Ledger" (IG 9)  

#### 3.7 Session Metadata Update

1. Update Session record:
   - `endTime` = now
   - `status` = "finished"
   - `locked` = true
   - `playingTime` = (endTime - startTime) in minutes
   - `playerCount` = count of activePlayers
   - `totalAmounts` = finalTotals (store computed final)

#### 3.8 Navigation

1. Emit UI refresh or navigate to SessionEndSummaryScreen

**UI Reference:** 2.2  

---

## 3. Session UI Specifications

### 3.1 Active Session Screen (SessionLiveScreen)

**File:** `/ui/screens/SessionLiveScreen.tsx` (per UI-GUIDE 2.1)  
**Status:** Not implemented  

**Required Elements:**
- Y-axis: List of active members
- X-axis: List of active penalties
- Matrix cells: Commit counters (can be positive or negative)
- Live totals per member (right margin or column)
- Total session amount (footer or header)
- Multiplier selector (integer ≥ 1, editable)
- Timer showing session duration (current time - startTime)
- "End Session" button (enabled when valid conditions met)
- Optional: Notes input field

**Receives (Props):**
- `sessionId`
- `members` (active)
- `penalties` (active)
- `currentTotals` = Session.totalAmounts
- `commitCounts` = { memberId: { penaltyId: count } }
- `currentMultiplier`

**Sends (Events):**
- `onCommit(memberId, penaltyId)`
- `onUndo(memberId, penaltyId)`
- `onMultiplierChange(newMultiplier)`
- `onEndSession()`
- `onNote(text)`

**Missing Specifications:**
- How are commit counters incremented/decremented? (Tap count? Long press? Buttons?)
- How is multiplier changed? (Dropdown? Slider? Plus/minus buttons?)
- How is the timer displayed? (HH:MM:SS format?)
- What happens on app crash during session? (Recovery mechanism?)
- Should session auto-save? (Backup in case of crash?)

---

### 3.2 Session End Summary Screen (SessionEndSummaryScreen)

**File:** `/ui/screens/SessionEndSummaryScreen.tsx` (per UI-GUIDE 2.2)  
**Status:** Not implemented  

**Responsibilities:**
1. Display title resolution UI (for title penalties)
2. Display reward input UI (if needed)
3. Display finalization confirmation
4. Show final totals preview
5. Navigate to SessionDetailsScreen after finalization

**UI Blocks Used:** TotalPenaltyAmountBlock, MemberStatsBlock, etc. (configurable per club layout)  

**Missing Specifications:**
- How is title selection presented? (Dropdown? List of members?)
- Is reward input mandatory or optional? (Per-penalty or global?)
- Are there undo/correction options before final commit?
- What error states exist? (Invalid input, etc.)

---

### 3.3 Session Details Screen (SessionDetailsScreen)

**File:** `/ui/screens/SessionDetailsScreen.tsx` (per UI-GUIDE 2.3)  
**Status:** Not implemented  

**Purpose:** View past/finished sessions  

**Receives:**
- `sessionId`

**Displays:**
- Session metadata (date, time, duration, club, participants)
- All penalties with final amounts per member
- Expandable detail blocks

**Missing Specifications:**
- Can notes be edited after session ends?
- Can session be "reopened" (unlocked) for corrections?
- Are there delete/archive options?

---

## 4. Real-Time State Management (In-Memory)

### 4.1 Session State (Active Session Only)

The following must be maintained in memory during active session:

```typescript
type SessionState = {
  sessionId: string;
  clubId: string;
  startTime: Timestamp;
  activePlayers: string[]; // memberIds
  activePenalties: string[]; // penaltyIds (where active=true)
  
  // Live authoritative totals
  totalAmounts: Map<memberId, number>;
  
  // Commit tracking for UI
  commitCounts: Map<memberId, Map<penaltyId, number>>;
  
  // Current session state
  currentMultiplier: number;
  status: "active" | "finishing" | "finished";
  
  // Undo tracking
  undoStack: Array<{ logId, memberId, penaltyId }>;
};
```

**Unclear:**
- Should this be persisted to localStorage/device storage?
- Recovery mechanism if app crashes?
- How long should undo stack be kept?

### 4.2 SessionLog Persistence

All logs must be written to database **immediately** (not batch):
- system=8 (commit)
- system=9 (undo)
- system=5 (multiplier)
- etc.

This ensures append-only integrity and crash recovery.

---

## 5. Database Migrations Required

### Migration 5: Session Table

```sql
CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  clubId TEXT NOT NULL,
  date DATE,
  startTime TEXT NOT NULL,
  endTime TEXT,
  playingTime INTEGER,
  playerCount INTEGER,
  notes TEXT,
  winners TEXT, -- JSON: { penaltyId → [memberIds] }
  activePlayers TEXT, -- JSON: [memberIds]
  totalAmounts TEXT, -- JSON: { memberId → amount }
  status TEXT DEFAULT 'active',
  locked INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  
  FOREIGN KEY (clubId) REFERENCES Club(id)
);
```

**Missing Columns (to add):**
- `multiplier` INTEGER? Or kept in memory?

### Migration 6: SessionLog Table

```sql
CREATE TABLE IF NOT EXISTS SessionLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  clubId TEXT NOT NULL,
  memberId TEXT,
  penaltyId TEXT,
  system INTEGER NOT NULL,
  amountSelf REAL,
  amountOther REAL,
  amountTotal REAL,
  multiplier INTEGER,
  note TEXT,
  extra TEXT, -- JSON for system=9, 11, 12, 13, 14
  
  FOREIGN KEY (sessionId) REFERENCES Session(id),
  FOREIGN KEY (clubId) REFERENCES Club(id),
  FOREIGN KEY (memberId) REFERENCES Member(id),
  FOREIGN KEY (penaltyId) REFERENCES Penalty(id)
);
```

### Migration 7: MemberSessionSummary Table

```sql
CREATE TABLE IF NOT EXISTS MemberSessionSummary (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  memberId TEXT NOT NULL,
  clubId TEXT NOT NULL,
  totalAmount REAL NOT NULL,
  totalCommits INTEGER NOT NULL,
  commitCounts TEXT NOT NULL, -- JSON: { penaltyId → count }
  playtimeSeconds INTEGER,
  createdAt TEXT NOT NULL,
  
  FOREIGN KEY (sessionId) REFERENCES Session(id),
  FOREIGN KEY (memberId) REFERENCES Member(id),
  FOREIGN KEY (clubId) REFERENCES Club(id)
);
```

### Migration 8: Ledger/Statement Table

```sql
CREATE TABLE IF NOT EXISTS Ledger (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- "session" | "payment" | ...
  sessionId TEXT,
  memberId TEXT NOT NULL,
  clubId TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  timestamp TEXT NOT NULL,
  
  FOREIGN KEY (sessionId) REFERENCES Session(id),
  FOREIGN KEY (memberId) REFERENCES Member(id),
  FOREIGN KEY (clubId) REFERENCES Club(id)
);
```

---

## 6. Service Layer Functions Required

### 6.1 Session Service (`/src/services/sessionService.ts`)

**Functions to implement:**
- `startSession(clubId: string, memberIds: string[]): Promise<Session>`
- `getActiveSession(sessionId: string): Promise<SessionState>`
- `addCommit(sessionId: string, memberId: string, penaltyId: string): Promise<SessionLog>`
- `undoCommit(sessionId: string, memberId: string, penaltyId: string): Promise<SessionLog>`
- `changeMultiplier(sessionId: string, newMultiplier: number): Promise<void>`
- `endSession(sessionId: string, winners?: Map, rewards?: Map): Promise<void>`
- `getSessionById(sessionId: string): Promise<Session>`
- `getSessionsByClub(clubId: string): Promise<Session[]>`

**Status:** Not implemented

### 6.2 SessionLog Service (`/src/services/sessionLogService.ts`)

**Functions to implement:**
- `createLog(log: SessionLogPayload): Promise<SessionLog>`
- `getLogsBySession(sessionId: string): Promise<SessionLog[]>`
- `getLastCommitLog(sessionId: string, memberId: string, penaltyId: string): Promise<SessionLog>`
- `getMemberSessionSummary(sessionId: string, memberId: string): Promise<MemberSessionSummary>`

**Status:** Not implemented

---

## 7. Identified Gaps & Contradictions

### Critical Gaps

| Gap | Severity | Description | Impact |
|-----|----------|-------------|--------|
| Missing Session table migration | CRITICAL | No migration 0004 for Session table | Cannot start sessions |
| Missing SessionLog table migration | CRITICAL | No migration 0005 for SessionLog | Cannot track events |
| Missing MemberSessionSummary table | CRITICAL | No migration for denormalized summary | Cannot generate reports |
| No session services | CRITICAL | No service layer for session CRUD | Cannot implement business logic |
| No active session UI screen | CRITICAL | SessionLiveScreen not designed/implemented | Cannot run live sessions |
| Multiplier storage location unclear | HIGH | Where is currentMultiplier stored? Session.multiplier or SessionState? | State management ambiguity |
| playerCount semantics unclear | HIGH | Is it static (set at start) or dynamic (updated during session)? | Data consistency issue |
| Ledger table undefined | HIGH | Ledger structure implied but not specified | Cannot integrate financial system |

### Unclear/Partial Specifications

| Issue | Location | Description | Recommendation |
|-------|----------|-------------|-----------------|
| Reward deduction member | SG 5, IG 6 | Which member is reward deducted from? Always title winner? | Clarify in SG 5 |
| Undo policy for invalid undo | SG 3 | "Reject and warn" is default, but what about alternative policies? | Define explicitly |
| Playtime edge case | SG 6 | What if no system=1 log exists? Use first commit timestamp? | Specify fallback |
| Session recovery | None | What happens if app crashes during active session? | Define recovery strategy |
| Reward input | SG 5, UI-GUIDE | How is reward input presented? Required per penalty or global? | Add UI spec |
| Title tie resolution | SG 5, UI-GUIDE | How are tied titles presented to user? | Add UI interaction spec |

### Contradictions

| Contradiction | Details | Resolution |
|---------------|---------|-----------|
| playingTime calculation | IG 1.4 says "Minutes" but SG 6 implies seconds | **Decision needed**: Store in minutes (truncate) or seconds (precise)? |
| amountTotal storage | IG 1.5 lists amountTotal in SessionLog, but SG 3 never references storing it | **Decision**: Is it computed (amountSelf * multiplier) or stored? |
| Session.multiplier | IG 1.4 does not list multiplier in Session fields, but SG 2 implies session-level multiplier | **Decision**: Store in Session or only in SessionState? |
| totalPlayingTime calculation | Member totalPlayingTimeMinutes calculated "live during sessions" but field is in Member table | **Decision**: How/when is Member.totalPlayingTimeMinutes updated? |

---

## 8. Dependencies Between Components

```
Session Initialization
  ├─ Penalty.active validation
  ├─ Member existence check
  └─ Create SessionLog (system=1 for each member)

Active Session UI (SessionLiveScreen)
  ├─ Session service (getCurrentSession)
  ├─ Penalty service (getActivePenalties)
  ├─ Member service (getMembers)
  ├─ Session service (addCommit/undoCommit)
  └─ Real-time totals calculation

Commit Processing
  ├─ Penalty.affect logic (SELF/OTHER/BOTH/NONE)
  ├─ SessionLog append (system=8/9)
  ├─ Session.totalAmounts update
  └─ UI counter update (in-memory commitCounts)

Session Finalization
  ├─ Title resolution (count commits per penalty)
  ├─ Reward input/deduction
  ├─ SessionLog evaluation logs (system=11-14)
  ├─ MemberSessionSummary creation
  ├─ Ledger entry creation
  └─ Session end UI display

Member Ledger Screen
  ├─ Ledger service (getByMember)
  ├─ Session service (getSessionDetails)
  └─ Financial calculations (outstanding)
```

---

## 9. Code Location Map (Current State)

| Component | File | Status |
|-----------|------|--------|
| Club CRUD | `/src/services/clubService.ts` | ✅ Implemented |
| Club UI | `/src/screens/clubs/` | ✅ Implemented |
| Member CRUD | `/src/services/memberService.ts` | ✅ Implemented |
| Member UI | `/src/screens/members/` | ✅ Implemented |
| Penalty CRUD | `/src/services/penaltyService.ts` | ✅ Implemented |
| Penalty UI | `/src/screens/penalties/` | ✅ Implemented |
| Session CRUD | `/src/services/sessionService.ts` | ❌ Not started |
| Session Logs | `/src/services/sessionLogService.ts` | ❌ Not started |
| SessionLiveScreen | `/src/screens/sessions/SessionLiveScreen.tsx` | ❌ Not started |
| SessionEndSummaryScreen | `/src/screens/sessions/SessionEndSummaryScreen.tsx` | ❌ Not started |
| SessionDetailsScreen | `/src/screens/sessions/SessionDetailsScreen.tsx` | ❌ Not started |
| Session Navigator | `/src/navigation/SessionStackNavigator.tsx` | ❌ Not started |
| Database migrations | `/migrations/0004_session.sql` + | ❌ Not created |
| Ledger service | `/src/services/ledgerService.ts` | ❌ Not started |

---

## 10. Recommended Implementation Order

### Phase 1: Foundations (Week 1)

1. **Create migrations:**
   - `/migrations/0004_create_session_table.sql`
   - `/migrations/0005_create_sessionlog_table.sql`
   - `/migrations/0006_create_member_session_summary_table.sql`
   - `/migrations/0007_create_ledger_table.sql`

2. **Clarify SESSION-GUIDE.md:**
   - Resolve multiplier storage decision
   - Define reward deduction member logic
   - Specify playtime edge cases
   - Add recovery strategy for app crashes

3. **Create Session Service:**
   - Implement startSession()
   - Implement endSession() partial (basic structure)
   - Implement SessionLog append operations

### Phase 2: UI & State Management (Week 2)

4. **Create SessionLiveScreen:**
   - Design matrix layout (members × penalties)
   - Implement real-time totals display
   - Implement commit/undo buttons
   - Implement multiplier selector

5. **Session State Management:**
   - Define SessionState reducer
   - Implement in-memory commit tracking
   - Implement undo stack

### Phase 3: Business Logic (Week 3)

6. **Complete Session Finalization:**
   - Implement title resolution UI
   - Implement reward input UI
   - Implement evaluation logs (system=11-14)
   - Implement MemberSessionSummary creation

7. **Financial Integration:**
   - Implement Ledger service
   - Implement ledger entry creation

### Phase 4: Reporting (Week 4)

8. **SessionDetailsScreen**
9. **Member Ledger Screen**

---

## 11. Questions for Project Owner

1. **Multiplier Scope:** Should multiplier be stored in Session record, or only in SessionState? Should past sessions remember their multiplier history?

2. **App Recovery:** If app crashes during active session, should the session be auto-recovered from device storage? What data must be persisted?

3. **Reward Deduction:** When a title penalty has a reward, is the reward:
   - Deducted from the title winner only?
   - Deducted from all session participants?
   - Applied as a credit instead of deduction?

4. **Ledger Design:** Should Ledger support other transaction types (payments, adjustments), or only sessions for now?

5. **Playtime Precision:** Should playtime be stored in seconds (precise) or minutes (rounded)?

6. **Undo Limits:** Should there be a maximum number of undoable commits, or can the entire session be undone step-by-step?

7. **Session Reopening:** Can a finished session be reopened for corrections, or is finalization irreversible?

---

## Top 3 Findings

### Finding 1: Critical Data Structure Misalignment
The SESSION-GUIDE.md defines a complex state machine with live Session.totalAmounts that must be kept in sync with SessionLog (append-only audit trail). However, no clear decision exists on whether multiplier and other runtime state should be persisted to the Session record or maintained only in memory. This creates ambiguity in crash recovery and session reconstruction.

**Impact:** High – affects persistence strategy and recovery mechanisms

### Finding 2: Incomplete UI Specifications
Critical UI flows for title resolution and reward input are mentioned in SESSION-GUIDE.md (Section 5) but have no corresponding detailed UI specification in UI-GUIDE.md. The SessionEndSummaryScreen description is minimal and lacks interaction specifications.

**Impact:** High – blocks UI implementation; requires user research or business logic clarification

### Finding 3: Ledger Table Undefined
The financial system (IG Section 7, 8, 9) references "Member Ledger" and "outstanding calculations," and SESSION-GUIDE.md (Section 5) requires creating ledger entries at session finalization. However, no Ledger table schema is defined anywhere, creating ambiguity about which system this belongs to and how it integrates.

**Impact:** High – blocks financial system; may require new migration beyond Session scope

---

## Missing or Unclear Specifications

### Database Schema
- [ ] Session table: Should multiplier be stored as column?
- [ ] Session table: Definition of status enum values
- [ ] Session table: Should there be a playingTime column or is it computed?
- [ ] Ledger table: Complete schema specification
- [ ] SessionLog: Is amountTotal computed or stored?

### Session Logic
- [ ] Recovery strategy if app crashes during active session
- [ ] Reward deduction semantics: which member, when multiple penalty types
- [ ] Undo policy alternatives: can users create arbitrary negative amounts or only undo specific commits?
- [ ] Playtime precision: seconds or minutes?
- [ ] playerCount: is it static at start or dynamic during session?

### UI/UX
- [ ] SessionLiveScreen: interaction design (how to increment/decrement counters?)
- [ ] SessionLiveScreen: session timer display and updates
- [ ] Title resolution UI: how are tied titles presented to user?
- [ ] Reward input UI: required per penalty or global? Optional or mandatory?
- [ ] Session recovery UI: what happens if user returns to app after crash?
- [ ] SessionDetailsScreen: can notes be edited? Can session be reopened?

### Business Logic
- [ ] Is session.totalAmounts updated in real-time during commits, or batched at end?
- [ ] Should commit counts be persisted to database or recalculated from logs?
- [ ] How are active penalties filtered? (only active=true? only rewardEnabled for finalization?)
- [ ] Should negative amounts (from undos) be allowed in Session.totalAmounts?

---

## Recommended Next Steps

**Document to update first:** `SESSION-GUIDE.md`

**Rationale:** SESSION-GUIDE.md is the authoritative source for session business logic and algorithms, but it has several ambiguities that would propagate into implementation. Before any code is written, these must be resolved:

1. Clarify multiplier storage and recovery
2. Define reward deduction member logic (title vs all players)
3. Specify undo policy alternatives
4. Add app crash recovery strategy
5. Clarify playtime precision (seconds vs minutes)

**Then:** Update `IMPLEMENTATION_GUIDE.md` Section 1.4-1.6 to add missing Session, SessionLog, and Ledger table definitions with complete field specifications.

**Then:** Update `UI-GUIDE.md` Section 2 to add detailed SessionLiveScreen and SessionEndSummaryScreen specifications with interaction diagrams.

---

## Conclusion

The three guides form a comprehensive foundation, but session implementation has **critical gaps in database schema, state management strategy, and UI interaction specifications**. The recommended approach is:

1. **Week 1:** Clarify ambiguous requirements in SESSION-GUIDE.md
2. **Week 1-2:** Create all four missing database migrations
3. **Week 2:** Implement Session and SessionLog services
4. **Week 2-3:** Build SessionLiveScreen and SessionEndSummaryScreen
5. **Week 3-4:** Complete finalization logic and financial integration

**Total estimated effort:** 3-4 weeks for core session functionality

