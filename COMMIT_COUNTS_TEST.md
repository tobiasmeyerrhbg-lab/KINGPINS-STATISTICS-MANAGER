# Commit Counts Test Plan

## Problem
Im SessionDetailsScreen werden die Commit-Zahlen für nachträglich hinzugefügte Spieler falsch angezeigt (immer 0), obwohl diese Spieler Commits hatten.

## Root Cause
- `MemberSessionSummary` wird nur bei Session-Finalisierung erstellt
- Für AKTIVE Sessions gibt es gar keine Summaries
- Für nachträglich hinzugefügte Spieler (vor Finalisierung) fehlten Summary-Einträge
- SessionDetailsScreen versuchte, Commits aus der Summary zu lesen → null → 0 angezeigt

## Solution
Commits werden jetzt **direkt aus SessionLog berechnet** (Commit Summary via `getCommitSummary()`):
- `getCommitSummary()` zählt alle system=8 (+1) und system=9 (-1) Logs pro Member-Penalty
- Funktioniert für AKTIVE UND finished Sessions
- Funktioniert für ALLE Spieler, egal wann sie hinzugefügt wurden

## Implementation
**Changed Files:**
1. `SessionDetailsScreen.tsx`
   - Import: `getCommitSummary` from sessionLogService
   - New state: `commitCounts` 
   - Load function: Fetch `getCommitSummary(sessionId)` 
   - Render: Use `commitCounts[memberId]` statt `summary?.commitCounts`

## Test Scenarios

### Test A: Late-Join Commit ✅
**Ziel:** Member C macht Commit, nachdem er hinzugefügt wurde → Commit sichtbar

**Schritte:**
1. Session starten mit Members A, B
2. A macht 2 Commits auf Penalty X
3. B macht 1 Commit auf Penalty Y
4. **Spieler C hinzufügen (jetzt sind 3 Members)**
5. C macht 1 Commit auf Penalty X
6. SessionDetailsScreen öffnen

**Erwartet:**
- A: Penalty X = 2, Penalty Y = 0
- B: Penalty X = 0, Penalty Y = 1
- C: Penalty X = 1, Penalty Y = 0 ✅ (WICHTIG!)
- D (nicht vorhanden): nicht angezeigt

**Warum Test A kritisch:** Testet, ob nachträglich hinzugefügte Spieler ihre Commits sehen

---

### Test B: Negative Commits (System=9) ✅
**Ziel:** Negative Commits werden korrekt gezählt (system=9 = -1)

**Schritte:**
1. Session starten mit Member A
2. A macht 3 Commits auf Penalty X (+1 +1 +1 = 3)
3. A macht 1 negativen Commit auf Penalty X (-1)
4. SessionDetailsScreen öffnen

**Erwartet:**
- A: Penalty X = 2 (3 - 1)

**Warum Test B kritisch:** Testet, dass negative Commits (-1) richtig gezählt werden

---

### Test C: Active Session (nicht finalisiert) ✅
**Ziel:** Commits sichtbar WÄHREND die Session noch aktiv ist (before finalization)

**Schritte:**
1. Session starten mit Member A
2. A macht 5 Commits auf verschiedenen Penalties
3. SessionDetailsScreen öffnen (Session AKTIV, noch nicht finalisiert)

**Erwartet:**
- Alle 5 Commits sichtbar
- Keine `MemberSessionSummary` in der DB (noch nicht finalisiert)
- Commits kommen aus SessionLog, nicht aus Summary ✅

**Warum Test C kritisch:** Testet, dass Commits aus Logs berechnet werden (nicht aus Summary)

---

### Test D: Reload / Re-navigation ✅
**Ziel:** Commits bleiben nach App-Reload konsistent

**Schritte:**
1. Session erstellen, Commits machen
2. SessionDetailsScreen öffnen → Commits sichtbar
3. App schließen / neu öffnen
4. SessionDetailsScreen wieder öffnen

**Erwartet:**
- Commits identisch wie zuvor
- Keine lokalen Caches, Daten kommen aus DB

**Warum Test D kritisch:** Testet, dass es kein Shadow-Cache-Problem gibt

---

## Code Changes Summary

### SessionDetailsScreen.tsx

**Line: Import section**
```tsx
import { getCommitSummary } from '../../services/sessionLogService';
```

**Line: State initialization**
```tsx
// Commit counts now taken only from Commit Summary
const [commitCounts, setCommitCounts] = useState<Record<string, Record<string, number>>>({});
```

**Line: Load function**
```tsx
const [summaryRows, clubMembers, clubPenalties, calculatedCommits] = await Promise.all([
  getSummariesBySession(sessionId),
  getMembersByClub(actualClubId),
  getPenaltiesByClub(actualClubId),
  getCommitSummary(sessionId),  // NEW: Fetch commits from logs
]);

// ...
// Commit counts now taken only from Commit Summary
setCommitCounts(calculatedCommits);
```

**Line: Render Member Commit Counts**
```tsx
{session.activePlayers.map(memberId => {
  const member = members.find(m => m.id === memberId);
  if (!member) return null;
  
  // Commit counts now taken only from Commit Summary
  const memberCommitCounts = commitCounts[memberId] || {};
  
  return (
    <View key={memberId} style={styles.summaryCard}>
      {/* ... header ... */}
      <View style={styles.commitsGrid}>
        {penalties.filter(p => p.active).map(penalty => (
          <View key={penalty.id} style={styles.commitItemRow}>
            <Text style={styles.commitLabel}>{penalty.name}:</Text>
            <Text style={styles.commitValue}>
              {memberCommitCounts[penalty.id] || 0}  {/* <- NOW: From commitCounts */}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
})}
```

## Eliminated Error Sources
✅ Commit Counts aus alten Snapshots → removed (use SessionLog)
✅ Commit Counts aus Events gefiltert nach Join-Time → removed (SessionLog already correct)
✅ Commit Counts aus momentanen UI-States → removed (use SessionLog)
✅ Commit Counts aus totalAmounts (falsch!) → removed (never used for counts anyway)
✅ lokale Arrays (commitCounts, filteredCommits, etc.) → removed (only use state.commitCounts from Logs)

## Data Flow
```
Session starts (active, no MemberSessionSummary yet)
  ↓
A macht Commit → createLog(system=8) → session.totalAmounts updated
  ↓
C wird hinzugefügt (nach A's Commit)
  ↓
C macht Commit → createLog(system=8) → session.totalAmounts updated
  ↓
SessionDetailsScreen öffnet:
  1. getSession(sessionId) → loads session
  2. getCommitSummary(sessionId) → scans ALL SessionLog system=8,9 entries
  3. Returns: { A: { X: 1 }, C: { X: 1 } }
  4. Render: Shows both A and C with correct counts
  ↓
Session finalisiert:
  createMemberSummaries() → creates MemberSessionSummary from same getCommitSummary()
  (Totals & Counts already correct from Logs!)
```

## Verification Command
To verify the fix works, check the database after Test A:
```sql
-- Should show 3 commits for C on penalty X
SELECT * FROM SessionLog WHERE sessionId='...' AND memberId='C' AND system IN (8, 9);
-- Should return 1 row with system=8 (positive commit)

-- SessionDetailsScreen will calculate: 
-- getCommitSummary() → { C: { penaltyX: 1 } }
-- Display: "Penalty X: 1" ✅
```

