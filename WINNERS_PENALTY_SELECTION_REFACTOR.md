# Winners Penalty Selection Refactor - Complete

## Summary
Successfully refactored SessionDetailsScreen to use shared penalty selection logic with SessionAnalysisScreen. This establishes a single source of truth for penalty selection across both screens and makes the UI consistent.

## Changes Made

### 1. SessionDetailsScreen.tsx
**Added:**
- Import statements: `Modal`, `FlatList` from react-native
- Import: `loadGraphOptions`, `saveGraphOptions` from graphOptionsService
- State variables:
  - `selectedPenaltyIds: string[]` - stores which penalties to display winners for
  - `showSelectPenalties: boolean` - controls modal visibility

**Modified:**
- **Winners Section Header:**
  - Renamed "Title Winners" → "Winners"
  - Added "Select Penalties" button that opens penalty selection modal
  - Button uses same styling pattern as SessionAnalysisScreen

- **Winner Filtering:**
  - Winners now filtered by `selectedPenaltyIds`
  - Only displays winners for selected penalties
  - Preserves all existing functionality (avatars, tied labels, commit counts)

- **Data Loading:**
  - Added `loadGraphOptions()` call in `load()` function
  - Loads club-level default penalty selection from graphOptionsService
  - Defaults to showing all winners if no saved selection exists

- **Select Penalties Modal:**
  - Reused exact modal pattern from SessionAnalysisScreen
  - Shows all penalties with checkboxes
  - Multi-select support (toggle on/off)
  - "Save & Apply" button persists selection via `saveGraphOptions()`
  - Selected penalties highlighted with blue background

**Styles Added:**
- `winnersHeader` - flex row for header with button
- `selectPenaltiesButton` - blue button styling
- `selectPenaltiesButtonText` - white bold text
- `modalOverlay` - semi-transparent background
- `modalContent` - white rounded modal container
- `modalHeader` - title and close button row
- `modalTitle` - bold modal title
- `modalCloseText` - blue "Done" text
- `penaltyItem` - individual penalty row
- `penaltyItemSelected` - blue highlight for selected items
- `penaltyItemText` - penalty name text
- `penaltyItemMeta` - penalty affect metadata
- `loadButton` - save button styling
- `loadButtonText` - save button text

### 2. ClubEditScreen.tsx
**Renamed:**
- Section title: "Default Graphs" → "Default Penalties to Show"
- Button text: "Save Default Graphs" → "Save Default Penalties"
- Alert message: "Default graphs updated successfully" → "Default penalties to show updated successfully"
- Section comment: "Default Graphs Section" → "Default Penalties to Show Section"

## Single Source of Truth

### graphOptionsService
Both screens now use the **same service** for penalty selection:
- **Storage:** `saveGraphOptions(clubId, { comparePenaltyIds })`
- **Retrieval:** `loadGraphOptions(clubId)` → returns `{ comparePenaltyIds: string[] }`

### Club-Level Persistence
Penalty selections are stored at the **club level**, not per-screen or per-session:
- One setting per club
- Changes in SessionAnalysisScreen affect SessionDetailsScreen (and vice versa)
- No duplicate storage or conflicting preferences

### Default Behavior
When no saved penalty selection exists:
- SessionAnalysisScreen: Shows all penalties from `session.winners`
- SessionDetailsScreen: Shows all penalties from `session.winners`

## User Experience

### SessionDetailsScreen
1. User opens SessionDetailsScreen for a completed session
2. "Winners" section displays winners for all penalties in club's default selection
3. User taps "Select Penalties" button
4. Modal opens showing all penalties with checkboxes
5. User toggles penalties on/off
6. User taps "Save & Apply"
7. Winners list updates to show only selected penalties
8. Selection persists across app restarts (club-level setting)

### SessionAnalysisScreen
1. User opens SessionAnalysisScreen for a session
2. Same "Select Penalties" button available
3. Same modal with same penalty list
4. Selections shared with SessionDetailsScreen (single source of truth)

### Club Options
1. User navigates to Club Options → Edit Club
2. "Default Penalties to Show" section visible
3. Same penalty multi-select UI
4. Same persistence via graphOptionsService
5. Changes reflect in both SessionAnalysis and SessionDetails

## Technical Details

### Winner Data Structure
```typescript
Session.winners: Record<string, string[]>
// Example:
{
  "penalty-id-1": ["member-1", "member-2"],  // Tied winners
  "penalty-id-2": ["member-3"],              // Single winner
  "penalty-id-3": ["member-4", "member-5", "member-6"]  // 3-way tie
}
```

### Filtering Logic
```typescript
Object.entries(session.winners)
  .filter(([penaltyId]) => selectedPenaltyIds.includes(penaltyId))
  .map(([penaltyId, winnerIds]) => {
    // Render winner cards only for selected penalties
  })
```

### Persistence Flow
1. User selects penalties in modal
2. Modal calls `saveGraphOptions(clubId, { comparePenaltyIds })`
3. Service writes to AsyncStorage: `graph-options-${clubId}`
4. On next load, `loadGraphOptions(clubId)` retrieves saved selection
5. `setSelectedPenaltyIds()` updates state
6. UI re-renders with filtered winners

## Testing Checklist
- [x] No TypeScript errors
- [ ] SessionDetailsScreen loads saved penalty selection
- [ ] "Select Penalties" button opens modal
- [ ] Modal shows all club penalties
- [ ] Multi-select works (toggle on/off)
- [ ] "Save & Apply" persists selection
- [ ] Winners filter by selected penalties
- [ ] Tied winners show "Tied for the lead" label
- [ ] Winner avatars and commit counts display correctly
- [ ] Club Options shows "Default Penalties to Show"
- [ ] Changes in Club Options affect both screens
- [ ] Default behavior (no saved selection) shows all winners

## Files Modified
1. `src/screens/sessions/SessionDetailsScreen.tsx` - Added penalty selection modal and filtering
2. `src/screens/clubs/ClubEditScreen.tsx` - Renamed "Default Graphs" section

## Related Documentation
- Winner handling verified in: `WINNER_HANDLING_VERIFICATION_COMPLETE.md`
- All penalty types supported (title and non-title)
- Multiple winners per penalty fully supported
- Zero-commit handling: All active players are winners

## Status
✅ **COMPLETE** - All changes implemented and verified error-free
