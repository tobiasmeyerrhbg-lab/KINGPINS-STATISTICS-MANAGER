# SESSION-GUIDE.md
Detailed session lifecycle, events, calculations and rules.

## Purpose
This document contains the complete, unambiguous session logic: start, active phase, commit processing, multiplier behavior, negative commits, reward handling, finalization, member summaries, playtime calculation, crash recovery, and how session results are written into the ledger.

All implementers and AI agents must follow this flow. Any change must be recorded here.

---

## 0. Session Table Schema (Extended Specification)

# 0.1 Database Schema — sessions
field	type	description
id	string (UUID)	Primary key
clubId	string	FK
startTime	timestamp	Session start (ISO8601)
endTime	timestamp or null	Session end (null while active)
status	enum	"active" or "finished"
multiplier	integer	Current active multiplier (≥1, stored in database)
activePlayers	JSON array	[memberIds]
totalAmounts	JSON	{ memberId: number }, mutable until finalization
winners	JSON or null	Title winners { penaltyId → [memberIds] }
locked	boolean (INTEGER 0/1)	Prevents further edits when true (finalization is permanent)
playingTimeSeconds	integer	Session total in seconds (computed: endTime - startTime)
playerCount	integer	Dynamic count: activePlayers.length
notes	TEXT or null	Optional session notes
createdAt	timestamp	ISO8601
updatedAt	timestamp	ISO8601

**Status definitions:**
- **active** – user started session, commits allowed, Session.totalAmounts is mutable
- **finished** – fully finalized, immutable (locked=true), Session.totalAmounts frozen

**Session Naming (Display-Only):**
- Sessions do NOT have a `name` field in the database
- Session names are **formatted dynamically** for display purposes:
  - **Format:** `"Session YYYY-MM-DD HH:MM"`
  - **Example:** "Session 2025-12-06 14:30"
  - **Source data:**
    - YYYY-MM-DD from `Session.date` field
    - HH:MM from `Session.startTime` (hours and minutes extracted from ISO8601 timestamp)
  - **Usage:** Session list cards, UI headers, and anywhere a human-readable session identifier is needed
  - **Timezone:** Times displayed in **local device timezone** (no timezone conversion from Club.timezone for existing sessions)

**Recovery/Error Handling:**
- On app crash during active session: auto-recover on restart from SessionLog replay
- Finalization is permanent (Option B5.1): locked sessions cannot be reopened
- Negative totalAmounts are allowed (debt tracking, corrections)
- Multiple concurrent sessions per club are allowed (no restriction)


## 1. Definitions / Primitives

- **SessionLog**: append-only log table with system codes (see Implementation Guide). Fields: id (auto-increment), timestamp, sessionId, clubId, memberId, penaltyId, system, amountSelf, amountOther, amountTotal, multiplier, note, extra.
  - **amountTotal** is computed and stored based on penalty affect rules and multiplier
  - For system=8 (positive commit): amountTotal is the calculated delta (positive/negative based on affect)
  - For system=9 (negative commit): amountTotal is negated from the positive commit calculation
- **Session.totalAmounts**: JSON map `{ memberId: number }` — authoritative totals for the session. This field is mutable during the session and immutable after finalization (except notes).
- **Session.multiplier**: INTEGER ≥ 1, stored in Session table, updated on system=5 events
- **Commit event**: `system=8` (positive commit, + button) or `system=9` (negative commit, - button).
- **Multiplier**: integer >= 1, recorded per commit. Changes are logged as `system=5` and affect only subsequent commits. **Stored in Session.multiplier column and updated immediately.**
- **MemberSessionSummary**: per-member snapshot produced at the end of the session containing commitCounts per penalty, totalCommits, totalAmount, playtimeSeconds.
- **Playtime precision**: All playtime stored in **seconds** (not minutes) for accuracy
- **PlayerCount**: Dynamic value = activePlayers.length, updated when players are added
- **Negative amounts**: Allowed in Session.totalAmounts (debt tracking, corrections)

---

## 2. Start Session (detailed)

When user presses **Start Session**:
1. Validate selected members (at least 1) and active penalties (at least 1).
2. Create Session record:
   - `startTime = now`
   - `activePlayers = [memberIds]`
   - `playerCount = activePlayers.length` (dynamic)
   - `totalAmounts = { memberId: 0 }` for each selected member
   - `multiplier = 1` (stored in Session.multiplier column)
   - `status = "active"`
   - `locked = false`
3. For each member, write `system=1` log (memberAdded):
   - `timestamp = now` (this timestamp is used as `memberAddedTime` for playtime calculation)
   - `memberId = member id`
   - `sessionId = session id`
   - `system = 1`
   - **Every time a player is added (including during a match), a system=1 log MUST be written**
4. Open Active Session UI (SessionLiveScreen).

---

## 3. Active Phase — Commit Processing

**On positive commit (user presses +):**

When
User taps + button on a member–penalty cell.

Steps: 

1. Determine base info:
- memberId
- penaltyId
- currentMultiplier
- amountSelf = penalty.amount
- amountOther = penalty.amountOther
- affect = penalty.affect (SELF / OTHER / BOTH / NONE)

2. Compute amounts:
- amountSelf = penalty.amount     // base value, not multiplied
- amountOther = penalty.amountOther
- applySelf = amountSelf * multiplier
- applyOther = amountOther * multiplier

- affectedOtherCount = 
    (penalty.affect === SELF)  → 0
    (penalty.affect === OTHER) → activePlayers.length - 1
    (penalty.affect === BOTH)  → activePlayers.length - 1
    (penalty.affect === NONE)  → 0

- amountTotal =
    (applySelf if SELF or BOTH else 0)
    + (applyOther * affectedOtherCount if OTHER or BOTH else 0)


3. Write SessionLog entry:
Positive commit (user pressed +):
- system = 8
- amountSelf = penalty.amount        // base value
- amountOther = penalty.amountOther  // base value
- multiplier = currentMultiplier
- amountTotal = computed total delta (always multiplied)
- timestamp = now

Negative commit (user pressed –):
- system = 9
- amountSelf = penalty.amount
- amountOther = penalty.amountOther
- multiplier = currentMultiplier
- amountTotal = -computed total delta
- timestamp = now


4. Update Session.totalAmounts:

- SELF:
    - Only the committing member is affected.
    - Positive commit: totalAmounts[memberId] += amountSelf * multiplier
    - Negative commit: totalAmounts[memberId] -= amountSelf * multiplier

- OTHER:
    - All other active members except the committing member are affected.
    - Positive commit: for each otherMember → totalAmounts[otherMember] += amountOther * multiplier
    - Negative commit: for each otherMember → totalAmounts[otherMember] -= amountOther * multiplier

- BOTH:
    - Apply both SELF and OTHER rules simultaneously.
    - Positive commit:
        * totalAmounts[memberId] += amountSelf * multiplier
        * for each otherMember → totalAmounts[otherMember] += amountOther * multiplier
    - Negative commit:
        * totalAmounts[memberId] -= amountSelf * multiplier
        * for each otherMember → totalAmounts[otherMember] -= amountOther * multiplier

- NONE:
    - No member totals are adjusted (log only).


5. Update counters:

Each member–penalty cell maintains an in-memory counter:

- On positive commit → counter++
- On negative commit → counter--

Counters are NOT persisted in backend; they are derived from logs when needed.


6. UI refresh:

- Refresh totalAmounts displayed for each player
- Refresh penalty counters per member
- Trigger re-render of commit buttons and session summary header


## 4. Multiplier Changes

- When multiplier changes (via slider UI), write `system=5` log with `note: "Multiplier changed from X to Y"`.
- Update `Session.multiplier = Y` (stored in database immediately).
- Update in-memory `currentMultiplier = Y`.
- Do NOT retroactively change previously applied commits in `Session.totalAmounts`; they keep the value they had when applied.
- Multiplier is constrained by `Club.maxMultiplier` setting (slider max value).

---

## 5. Ending Session — finalization process (CURRENT IMPLEMENTATION)

**Implementation:** `/src/services/sessionFinalizationService.ts` + `/src/components/SessionEndModals.tsx`

When user presses **End Session**:

1. **Confirmation Modal** — Show "Are you sure you want to end this session? This cannot be undone."
   - Buttons: Cancel | Confirm
   - On confirm → proceed to step 2

2. **Switch session to finishing mode** — disable commit inputs (UI checks `session?.locked`), multiplier slider disabled, status remains "active" until finalization complete.

3. **Resolve titles/winners** (see Section 5.2):
   - For each penalty calculate commit counts per member via `getCommitSummary()`.
   - For each penalty with `isTitle=true`If unique max → **auto-resolve** (no modal), store winner
   - If tie → **queue for modal dialog** (sequential, one at a time)
   - **Title penalties MUST have exactly one winner.**
   - Write `system=2` logs for ALL resolved titles (auto + manual) via `logTitleWinners()`
   - Update `Session.winners` as `{ penaltyId: [winnerId] }` (array for backwards compatibility)

4. **Resolve rewards** (see Section 5.3):
   - For `rewardEnabled` penalties: if `rewardValue` exists and > 0, use it automatically
   - Otherwise **queue modal prompt per reward penalty** (sequential)
   - **Reward deduction always targets the winner:**
     - If penalty has `isTitle=true`: deduct from the ONE winner
     - Formula: `Session.totalAmounts[winnerId] -= rewardValue`
   - Write `system=6` logs for ALL reward deductions via `applyRewards()`
   - Update `Session.totalAmounts` immediately
   - **No ledger entries for rewards** — ledger is updated once at finalization with final totals.

5. **Finalize totals** via `generateFinalSummaryLogs()`:
   - `finalTotals = Session.totalAmounts` (after rewards applied)
   - Write evaluation logs (stored in SessionLog table):
     - `system=11` FinalTotals — store `{ memberId: finalAmount }` in `extra`
     - `system=12` CommitSummary — `{ memberId: { penaltyId: commitCount } }` in `extra`
     - `system=13` PenaltySummary — `{ penaltyId: totalAmountOverAllPlayers }` in `extra`


6. **Persist per-member summary records** via `createMemberSummaries()`:
   - For each member: create/update MemberSessionSummary record
   - **Playtime calculation:** Find system=1 log timestamp for member, calculate `(endTime - system1Timestamp) / 1000` seconds
   - If no system=1 log (data corruption): fallback to `(endTime - session.startTime) / 1000`
   - Store: totalAmount, totalCommits, commitCounts JSON, playtimeSeconds

7. **Ledger integration** via `createSessionLedgerEntries()`:
   - **ONE ledger entry per active member** with `type='session'`, `amount=finalTotals[memberId]`, `sessionId`, `timestamp=now`, `note='Final session total'`.
   - Ledger represents final session totals only (not individual commits, not individual rewards).
   - All commits (system=8/9) and rewards (system=6) are tracked in SessionLog only.
   - Ledger entry aggregates all session activity into one amount per member.

8. **Set session end metadata** via `lockSession()`:
   - `endTime = now`
   - `playingTimeSeconds = (endTime - startTime) in seconds`
   - `playerCount = activePlayers.length` (final count)
   - `status = "finished"`
   - `locked = true` (finalization is permanent, cannot be reopened)
   - `winners = { penaltyId: [winnerId] }` (stored as array for backwards compatibility)

9. **Navigation**:
   - **Direct navigation to SessionDetailsScreen** (no intermediate summary screen)
   - SessionLiveScreenNew calls `navigation.replace('SessionDetails', { sessionId, clubId, clubName })`
   - SessionDetailsScreen shows all finalization data with resolved names (no IDs)

## 5.2 Title Resolution (Auto or Modal) — CURRENT IMPLEMENTATION

**Trigger:** User taps "End Session" on SessionLiveScreen → Confirmation modal → prepareTitleResolution()

**Implementation:** `/src/services/sessionFinalizationService.ts::prepareTitleResolution()`

**Process for each title penalty (penalties with isTitle=true):**

1. **Count commits per member:**
   - Call `getCommitSummary(sessionId)` to get `{ memberId: { penaltyId: count } }`
   - For this penalty: extract counts per member
   - Find max count among members with commits > 0

2. **Determine winner(s):**
   - If exactly one member has max count → **auto-resolve**, add to `autoResolvedWinners`
   - If multiple members tied → add to `titlesToResolve` array with:
     - penaltyId, penaltyName (resolved)
     - tiedMembers: [{ memberId, memberName, count }] (all names resolved)

3. **Modal UI (if tie):**
   - **Rendered by:** `/src/components/SessionEndModals.tsx`
   - **Title:** "Select Winner"
   - **Subtitle:** "Choose the winner for [penalty name]" (penalty name, not ID)
   - **Progress:** "Title X of Y"
   - **Body:** Radio button list of tied members, showing:
     - Member name (not ID)
     - Commit count (e.g., "5 commits")
   - **Buttons:** "Confirm" (disabled until selection made)
   - **On confirm:** Add winnerId to resolvedWinners, proceed to next title or rewards
   - **Sequential:** Only one modal shown at a time

4. **Store winners:**
   - After all titles resolved (auto + manual), call `logTitleWinners(sessionId, clubId, allWinners)`
   - Writes system=2 log for each winner:
     - sessionId, clubId, memberId (winnerId), penaltyId
     - system=2, timestamp=now, note="Title winner"
   - Winners passed to finalization as `Record<string, string>` (penaltyId → winnerId)
   - Stored in Session.winners as `{ penaltyId: [winnerId] }` for backwards compatibility

**Important:** Title penalties **must have exactly one winner** (enforced by modal UI).

## 5.3 Reward Resolution (Auto or Modal) — CURRENT IMPLEMENTATION

**Trigger:** After all title resolutions complete → prepareRewardResolution()

**Implementation:** `/src/services/sessionFinalizationService.ts::prepareRewardResolution()`

**Process for each reward penalty (penalties with rewardEnabled=true):**

1. **Determine reward value:**
   - If `penalty.rewardValue` exists and > 0 → add to `autoRewards` with winnerId + rewardValue
   - If `penalty.rewardValue` is null or ≤ 0 → add to `rewardsToResolve` array with:
     - penaltyId, penaltyName (resolved)
     - winnerId, winnerName (resolved from winners map)

2. **Modal UI (if missing value):**
   - **Rendered by:** `/src/components/SessionEndModals.tsx`
   - **Title:** "Enter Reward Value"
   - **Subtitle:** "For [penalty name]" (penalty name, not ID)
   - **Info:** "This will be deducted from [winner name]'s total" (winner name, not ID)
   - **Progress:** "Reward X of Y"
   - **Input:** Numeric input field (auto-focus, required, validation: > 0)
   - **Buttons:** "Confirm" (disabled until valid number entered)
   - **On confirm:** Add { winnerId, rewardValue } to resolvedRewards, proceed to next reward or finalization
   - **Sequential:** Only one modal shown at a time

3. **Apply deduction** via `applyRewards()`:
   - For each reward (auto + manual):
     - Get winnerId from reward
     - Calculate: `updatedTotals[winnerId] = (currentTotals[winnerId] || 0) - rewardValue`
     - Write system=6 log:
       - sessionId, clubId, memberId=winnerId, penaltyId
       - system=6, amountTotal=-rewardValue, timestamp=now, note="Reward deduction"
   - Update Session.totalAmounts via `updateTotalAmounts(sessionId, updatedTotals)`
   - Return updated totals for final ledger/summary generation

**Reward Deduction Rules:**
- Rewards ALWAYS deduct from the winner only (never distributed)
- **NOT multiplied** — reward value is absolute
- Deduction happens BEFORE final summary logs and ledger entries
- Rewards create SessionLog entries (system=6) only, not separate ledger entries

**Reward Deduction Rules:**
- Rewards ALWAYS apply to the winner, never distributed.
- **If penalty is a title penalty (isTitle=true):** Reward deducts from the ONE selected winner
- **If penalty is NOT a title penalty:** Not applicable in current model (title penalties only have rewards)
- **Rewards create SessionLog entries (system=6) only, not ledger entries**
- Ledger entries created once at finalization with final aggregated totals per member

## 5.4 Modals — Sequential & Name-Based

**Modal Display Rules:**
- **Title penalties:** One modal per tied penalty; show until all titles resolved or user cancels
- **Reward values:** One modal per missing rewardValue; show until all rewards resolved or user cancels
- **Order:** Titles first, then rewards (allows winners determined before reward prompts)
- **Display names, not IDs:**
  - Penalty names in modal titles
  - Member names in modal bodies
  - All lookups pre-fetched to avoid null/ID leaks
- **On cancel:** Modals stay open; user must complete all or abandon finalization
---

## 5.9 Crash Recovery Mode ##
If the app crashes while session.status = "active":

**On next app launch (AUTO-RECOVERY):**
1. Detect active session: `SELECT * FROM sessions WHERE status = 'active'`
2. Show modal prompt: "Resume unfinished session for [club name]?"
   - Button: "Resume" → continue with step 3
   - Button: "Discard" → mark session as abandoned
3. If user chooses Resume:
   - Load all SessionLogs for this session
   - Rebuild session state from logs:
     - `multiplier` from last system=5 log (or 1 if none)
     - `totalAmounts` by replaying all system=8/9 commits
     - `commitCounts` by counting system=8/9 logs
     - `activePlayers` from Session.activePlayers JSON
   - Restore SessionLiveScreen with recovered state
   - Status remains "active"
   - All calculations continue normally
4. If user chooses Discard:
   - Session remains visible in history
   - No ledger entries created
   - Session can be viewed in SessionDetailsScreen for audit

**Guarantee:**
No commit is ever lost, because SessionLog is append-only and written immediately.


## 6. Playtime definitions & edge cases

**All playtime is stored in seconds, not minutes.**

**Session level playtime:**
```
sessionPlaytimeSeconds = (endTime - startTime).inSeconds()
```

**Member level playtime:**
```
memberPlaytimeSeconds = (endTime - memberAddedTime).inSeconds()
```

Where `memberAddedTime` is the timestamp from the member's `system=1` log entry.

**Edge case: Missing system=1 log**
- If no system=1 log exists for a member (data corruption scenario):
  - **Fallback:** Use `Session.startTime` as memberAddedTime
  - Playtime = `(endTime - startTime).inSeconds()`
- **Prevention:** Every player addition (at session start or mid-session) MUST write a system=1 log

**Multiple joins (future feature):**
- If explicit leave logs are added later, playtime should be the sum of all intervals between join and leave segments.
- Current baseline: single join only (system=1 at session start).

---

## 7. Data migration & persistence notes

- `Session.totalAmounts` should be stored as JSON in the Session record for fast reads.
- The final evaluation logs (11–14) are optional but recommended for fast analytics; they are also append-only.
- `MemberSessionSummary` is a denormalized convenience table for UI and reports (one row per session/member).
- If you change the session logic later, provide migration scripts to reconcile `Session.totalAmounts` with historical logs.

---

## 8. Current Operational Model (Kingpins Statistics Manager)

### 8.1 Multiplier Behavior
In the current implementation:
- **Multiplier starts at 1** for every new session.
- **Multiplier is adjustable during an active session** via slider or stepper controls in SessionLiveScreen.
- Each commit applies the **current active multiplier** at the time of commit:
  - `applySelf = penalty.amountSelf × currentMultiplier`
  - `applyOther = penalty.amountOther × currentMultiplier`
  - These multiplied values determine the delta stored in `amountTotal` and applied to `Session.totalAmounts`.
- Multiplier changes are logged as system=5 events and affect only subsequent commits after the change.
- Multiplier value is stored in Session.multiplier and updated immediately when slider moves.
- Base amounts (amountSelf, amountOther) are stored in logs for history, but multiplied values are what affect totals.

### 8.2 Session Creation Flow
1. User navigates to **ClubDetailScreen** and taps **"Sessions"** button.
2. **SessionListScreen** opens showing all sessions for the club sorted by **date DESC** (latest first).
   - From list, user can tap a session to view details.
   - Active sessions show "Resume" button → SessionLiveScreen.
   - Top of list has "Start New Session" button → **SessionCreateScreen**.
3. **SessionCreateScreen** allows member selection with validation:
   - At least 1 member must be selected.
   - All selected members must have at least 1 active penalty assigned.
   - **NEW: Inline "Add New Member" button** opens member creation modal (same as Members module).
   - After creating a new member, they appear in the list immediately and are auto-selected.
4. Pressing "Start Session" creates:
   - Session record with multiplier=1, **date=now** (timestamp column), status="active", locked=false.
   - Zeroed totalAmounts for each selected member.
   - system=1 logs for each member (player added).
   - **Option A: Zeroed MemberSessionSummary rows created immediately** (not just at finalization).
5. Navigation → **SessionLiveScreen** with hydrated state.

### 8.3 MemberSessionSummary — Option A (Early Creation)
**Option A implementation (currently deployed):**
- **When:** MemberSessionSummary rows are created at session start (in startSession()).
- **Content:** Initially zeroed (totalAmount=0, totalCommits=0, commitCounts={}, playtimeSeconds=0).
- **Update at finalization:** updateMemberSessionSummary() is called to upsert final values.
- **Purpose:** Ensures every member in the session has a summary record from start to finish, enabling early audits and consistency checks.

### 8.4 Player Flow (UI Perspective)
1. **Club Entry**: User taps club card on ClubsScreen → ClubDetailScreen.
2. **Session Discovery**: User taps **\"Sessions\"** button → SessionListScreen (sorted by date DESC, latest first).
3. **Session Creation**: User taps \"Start New Session\" (at top of SessionListScreen) → SessionCreateScreen.
   - Selects members (checkboxes).
   - **NEW**: Can tap \"Add New Member\" to create member inline without leaving screen.
   - Validates penalties (inline error if missing).
   - Taps \"Start Session\" → SessionLiveScreen.
4. **Active Session**: SessionLiveScreen shows:
   - Penalty grid (member × penalty matrix).
   - Each cell has [−] [count] [+] buttons.
   - Multiplier slider/stepper (**dynamic**, adjustable during session).
   - Session timer (HH:MM:SS).
   - Totals card (per-member breakdown).
   - \"End Session\" button to finalize.
5. **Resume After Crash**: SessionListScreen shows \"Resume\" button for active sessions.
   - Tapping it jumps to SessionLiveScreen with recovered state (logs replayed).
6. **Finalization**: \"End Session\" button → SessionEndSummaryScreen.
   - Title resolution (forced choice for ties).
   - Reward prompts (manual input if needed).
   - \"Finalize Session\" button → creates ledger, locks session, navigates to SessionDetailsScreen.
7. **Session Details**: SessionDetailsScreen shows:
   - Session metadata (date, time, duration, status, locked).
   - All logs grouped by system code.
   - Member summaries (total amount, commit counts, playtime).
   - Ledger entries per member.

---

## 9. Testing checklist (essential)

- Single positive commit → totals increase correctly.
- Multiple commits with multiplier changes → totals reflect commit-time multiplier only.
- Negative commit → totals decrease correctly.
- Rewards deducted and applied properly.
- End session freezes totals and creates correct evaluation logs.
- Playtime calculated correctly from system=1 to endTime.

---

## 10. Operator & AI rules

- Do not modify existing SessionLog entries; always append.
- Any code changing commit semantics must update this document.
- System=9 (negative commit, - button) is a regular commit with negative delta, not an undo operation.
- Both system=8 and system=9 create normal SessionLog entries. There is no special undo lookup logic.

---
