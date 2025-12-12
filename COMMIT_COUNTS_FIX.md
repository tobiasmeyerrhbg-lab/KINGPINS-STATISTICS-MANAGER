# Commit Counts Fix - Code Changes

## Problem
Im SessionDetailsScreen werden die Commit-Zahlen für nachträglich hinzugefügte Spieler falsch angezeigt (immer 0).

## Root Cause
MemberSessionSummary wird nur bei Finalisierung erstellt. Für aktive Sessions oder nachträglich hinzugefügte Spieler gibt es keine Summary-Einträge → Commits zeigen 0.

## Solution
Commits direkt aus **SessionLog berechnen** (via `getCommitSummary()`), statt aus MemberSessionSummary zu lesen.

---

## Changed File: `src/screens/sessions/SessionDetailsScreen.tsx`

### Change 1: Import getCommitSummary (Line 17)

**LOCATION:** After existing imports from services

```typescript
// ADD THIS LINE:
import { getCommitSummary } from '../../services/sessionLogService';
```

---

### Change 2: Add commitCounts State (Line 33)

**LOCATION:** In `export function SessionDetailsScreen()` state initialization

**BEFORE:**
```typescript
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedClubId, setResolvedClubId] = useState<string | undefined>(clubId);
```

**AFTER:**
```typescript
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedClubId, setResolvedClubId] = useState<string | undefined>(clubId);
  // Commit counts now taken only from Commit Summary
  const [commitCounts, setCommitCounts] = useState<Record<string, Record<string, number>>>({});
```

---

### Change 3: Fetch commitCounts in load() (Line 43-58)

**LOCATION:** In `const load = async () => { ... }` function

**BEFORE:**
```typescript
  const load = async () => {
    try {
      setIsLoading(true);
      const s = await getSession(sessionId);
      if (!s) throw new Error('Session not found');
      setSession(s);
      
      const actualClubId = clubId || s.clubId;
      setResolvedClubId(actualClubId);
      
      const [summaryRows, clubMembers, clubPenalties] = await Promise.all([
        getSummariesBySession(sessionId),
        getMembersByClub(actualClubId),
        getPenaltiesByClub(actualClubId),
      ]);
      
      setSummaries(summaryRows);
      setMembers(clubMembers);
      setPenalties(clubPenalties);
    } catch (error: any) {
      console.error('Failed to load session details:', error);
    } finally {
      setIsLoading(false);
    }
  };
```

**AFTER:**
```typescript
  const load = async () => {
    try {
      setIsLoading(true);
      const s = await getSession(sessionId);
      if (!s) throw new Error('Session not found');
      setSession(s);
      
      const actualClubId = clubId || s.clubId;
      setResolvedClubId(actualClubId);
      
      const [summaryRows, clubMembers, clubPenalties, calculatedCommits] = await Promise.all([
        getSummariesBySession(sessionId),
        getMembersByClub(actualClubId),
        getPenaltiesByClub(actualClubId),
        getCommitSummary(sessionId),
      ]);
      
      setSummaries(summaryRows);
      setMembers(clubMembers);
      setPenalties(clubPenalties);
      // Commit counts now taken only from Commit Summary
      setCommitCounts(calculatedCommits);
    } catch (error: any) {
      console.error('Failed to load session details:', error);
    } finally {
      setIsLoading(false);
    }
  };
```

---

### Change 4: Update Member Commit Counts Render (Line 215-247)

**LOCATION:** "Member Commit Counts" section in render

**BEFORE:**
```typescript
        {/* Member Summaries */}
        {/* --- UPDATED SECTION START --- Member Commit Counts --- */}
        {session && session.activePlayers && session.activePlayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member Commit Counts</Text>
            {session.activePlayers.map(memberId => {
              const member = members.find(m => m.id === memberId);
              const summary = summaries.find(s => s.memberId === memberId);
              if (!member) return null;
              
              return (
                <View key={memberId} style={styles.summaryCard}>
                  <View style={styles.summaryCardHeader}>
                    <Image source={getMemberAvatar(memberId)} style={styles.avatarSmall} />
                    <Text style={styles.summaryMemberName}>{member.name}</Text>
                  </View>
                  <View style={styles.commitsGrid}>
                    {penalties.filter(p => p.active).map(penalty => (
                      <View key={penalty.id} style={styles.commitItemRow}>
                        <Text style={styles.commitLabel}>{penalty.name}:</Text>
                        <Text style={styles.commitValue}>
                          {summary?.commitCounts?.[penalty.id] || 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {/* --- UPDATED SECTION END --- */}
```

**AFTER:**
```typescript
        {/* Member Summaries */}
        {/* --- UPDATED SECTION START --- Member Commit Counts --- */}
        {session && session.activePlayers && session.activePlayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member Commit Counts</Text>
            {session.activePlayers.map(memberId => {
              const member = members.find(m => m.id === memberId);
              if (!member) return null;
              
              // Commit counts now taken only from Commit Summary
              const memberCommitCounts = commitCounts[memberId] || {};
              
              return (
                <View key={memberId} style={styles.summaryCard}>
                  <View style={styles.summaryCardHeader}>
                    <Image source={getMemberAvatar(memberId)} style={styles.avatarSmall} />
                    <Text style={styles.summaryMemberName}>{member.name}</Text>
                  </View>
                  <View style={styles.commitsGrid}>
                    {penalties.filter(p => p.active).map(penalty => (
                      <View key={penalty.id} style={styles.commitItemRow}>
                        <Text style={styles.commitLabel}>{penalty.name}:</Text>
                        <Text style={styles.commitValue}>
                          {memberCommitCounts[penalty.id] || 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {/* --- UPDATED SECTION END --- */}
```

---

## Summary of Changes

| Change | What | Where |
|--------|------|-------|
| Import | Add `getCommitSummary` | Top of SessionDetailsScreen.tsx |
| State | Add `commitCounts` state | Component state initialization |
| Load | Fetch commits from SessionLog | `load()` async function |
| Render | Use `commitCounts[memberId]` instead of `summary?.commitCounts` | Member Commit Counts section |

---

## Why This Fixes The Problem

1. **Before:** Commits came from `MemberSessionSummary`, which only exists after finalization
   - Active sessions → no summaries → show 0
   - Late-joined members → no summary entry → show 0

2. **After:** Commits come directly from `SessionLog` via `getCommitSummary()`
   - Reads ALL system=8 (+1) and system=9 (-1) logs
   - Works for ACTIVE and FINISHED sessions
   - Works for ALL members, regardless of join time
   - Always in sync with actual commits made

---

## Testing

### Quick Test
1. Create session with Member A
2. Add 3 commits from A on Penalty X
3. Add Member C (after A's commits)
4. Add 1 commit from C on Penalty X
5. Open SessionDetailsScreen
6. **Expected:** A shows 3, C shows 1 ✅

### Database Verification
```sql
-- Check logs were created
SELECT memberId, COUNT(*) as commitCount 
FROM SessionLog 
WHERE sessionId='<sessionId>' AND system IN (8, 9)
GROUP BY memberId;

-- Should show both A and C with correct counts
```

---

## No Breaking Changes
- MemberSessionSummary still used for finished sessions (backwards compatible)
- All other session functionality unchanged
- Commit counts now consistent across all session states
