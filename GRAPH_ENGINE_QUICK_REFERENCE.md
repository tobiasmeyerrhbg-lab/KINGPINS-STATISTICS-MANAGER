# Session Graph Engine - Quick Reference Guide

## Phase 2 Updates (Latest)

### New Features Added ✨
- **Member Images**: Avatar display at each data point with dummy fallback
- **Actual Session Time**: X-axis now shows real time (08:15, 08:30, etc.) not relative (0:00, 5:00)
- **Intelligent Y-Axis**: Dynamic integer labels for count modes with smart spacing
- **Full Session Replay**: Single cumulative line showing total session amount
- **Step-Wise Graphs**: Jump at commit timestamps only, no interpolation

---

## What Was Completed

### 1. Session Selection Dropdown ✅
- **Component**: SessionAnalysisTab
- **Features**:
  - Modal selector showing finished sessions
  - Display: Date, time, and player count
  - Visual highlighting of selected session
  - Required for all graph modes

### 2. X-Axis Time Labels (UPDATED) ✅
- **Component**: SessionGraphView
- **Format**: HH:MM (actual session time, not relative)
- **Count**: 5 evenly spaced labels
- **Calculation**: session.startTime + relative milliseconds
- **Example**: Session starts 08:15 → labels: 08:15, 08:22, 08:30, 08:37, 08:45
- **Previous**: 0:00, 5:00, 10:00, 15:00, 20:00

### 3. Member Images (NEW) ✅
- **Component**: SessionGraphView
- **Display**: 24x24 colored circles with member avatar
- **Fallback**: default-member.png if image unavailable
- **Modes**: All graph modes (Count, Amount, Full Replay, Comparison)
- **Color**: Matches series line color with white border
- **Data Source**: member.image field from database

### 4. Y-Axis Smart Scaling (ENHANCED) ✅
- **Count Modes**: 
  - Start at 0
  - Integer labels only (0, 1, 2, 3, ...)
  - Intelligent spacing: max=5 shows 0,1,2,3,4,5; max=100 shows 0,20,40,60,80,100
- **Amount Modes**: 
  - Auto-scale based on data
  - 3 labels: min, mid, max
  - Decimal format (1 decimal place)
- **Affected Modes**:
  - Count per Penalty
  - Player Comparison per Penalty
  - Full Session Replay (amount)
- **Implementation**: Memoized for performance

### 5. Penalty Selector Dropdown ✅
- **Component**: SessionAnalysisTab
- **Behavior**:
  - Only appears for "Player Comparison per Penalty" mode
  - Required for graph building in that mode
  - Modal interface with all penalties
  - Validation prevents graph without selection

### 6. Full Session Replay (NEW) ✅
- **Component**: SessionGraphView & sessionGraphEngine
- **Display**: Single cumulative line for total session amount
- **Y-Axis**: Starts at 0, integer or decimal based on amounts
- **Behavior**: Step-wise (jumps at commits, no interpolation)
- **Example**:
  ```
  08:00 +$5 → jumps to 5
  08:05 (no commits) → stays at 5
  08:10 +$3 → jumps to 8
  08:15 +$10 → jumps to 18
  ```

### 7. Multiplier Bands Visualization ✅
- **Toggle**: Options section
- **Display**: Background gradient behind graph data
- **Opacity**: Based on multiplier value
- **Enhancement**: Optional ON/OFF toggle

### 8. Favorites/Presets System ✅
- **Functionality**:
  - Save current configuration with custom name
  - Load saved presets to restore all settings
  - Delete presets
  - Storage: AsyncStorage (persistent)
- **UI**: Modal interface with manage button

### 9. Error Handling & Validation ✅
- Session required: All modes
- Penalty required: Player comparison mode only
- Loading feedback: Visual spinner
- Error alerts: Missing required selections

### 10. Step-Wise Graph Behavior (NEW) ✅
- Graphs jump only at commit timestamps
- No interpolation between events
- Applies to all count modes
- Applies to Full Session Replay
- All data points represent actual SessionLog commits

### 11. Documentation (UPDATED) ✅
- **Main File**: SESSION_GRAPH_ENGINE.md
- **Updates**:
  - Actual session time X-axis specification
  - Intelligent Y-axis label generation
  - Member image rendering details
  - Full Session Replay behavior
  - Step-wise graph behavior
  - All previous features verified

---

## How to Use

### Basic Workflow:
1. **Select Session** → Click session dropdown → Choose finished session
2. **Select Mode** → Click one of 4 mode buttons
3. **Select Penalty** (if player-comparison mode) → Click penalty dropdown
4. **Load Graph** → Press "Load Graph" to build
5. **Fullscreen** → Press "Fullscreen" to open large interactive view
6. **Export** → In fullscreen, use PNG/JPEG/PDF buttons to share or save

## Fullscreen Mode
- Opens `GraphFullscreen` screen.
- Preserves axes, member images, multiplier bands, and interactivity.
- Provides export buttons in header.

## Export Functions
- **PNG/JPEG**: Uses `react-native-view-shot` to capture the graph image, shares via `expo-sharing`.
- **PDF**: Uses `expo-print` to generate a simple PDF with session metadata; captured image includes legend and multiplier bands.
- **Saving/Sharing**: Uses `expo-file-system` and `expo-sharing` when available; code guards ensure fallback behavior.
4. **Toggle Options** → Multiplier bands ON/OFF
5. **Load Graph** → Click "Load Graph" button
6. **Save to Favorites** → Enter name and click Save in Presets modal

### Modes Overview:
| Mode | Y-Axis | Purpose | Requires Penalty |
|------|--------|---------|------------------|
| Count per Penalty | Integer (0+) | Frequency of penalty | No |
| Total Amount per Player | Cumulative amount | Financial impact per player | No |
| Full Session Replay | Total amount | Cumulative session total | No |
| Player Comparison | Integer (0+) | Compare players on penalty | **YES** |
| Full Session Replay | Mixed/metric | Complete chronology | No |
| Player Comparison per Penalty | Integer count | Compare players | ✅ YES |

---

## Code Locations

### UI Components:
- **SessionAnalysisTab**: `src/screens/statistics/SessionAnalysisTab.tsx` (404 lines)
- **SessionGraphView**: `src/components/graphs/SessionGraphView.tsx` (282 lines)

### Services:
- **Graph Engine**: `src/services/sessionGraphEngine.ts`
- **Presets Service**: `src/services/graphPresetsService.ts`
- **Penalty Service**: `src/services/penaltyService.ts`
- **Session Service**: `src/services/sessionService.ts`

### Documentation:
- **Specification**: `SESSION_GRAPH_ENGINE.md` (281 lines)
- **Implementation Report**: `IMPLEMENTATION_COMPLETE.md`

---

## Key Features Summary

### SessionAnalysisTab
```
✅ Session selector modal
✅ 4 graph mode buttons
✅ Conditional penalty selector
✅ Multiplier bands toggle
✅ Presets save/load/delete
✅ Load graph with validation
✅ Error alerts for missing selections
```

### SessionGraphView
```
✅ Automatic axis scaling
✅ Time labels on X-axis (HH:MM)
✅ Integer labels on Y-axis (count modes)
✅ Colored line segments per series
✅ Data points with automatic colors
✅ Legend display
✅ Multiplier bands background
✅ Grid lines for reference
✅ Horizontal scrolling
✅ Memoized calculations
```

---

## Testing Tips

### Must Verify:
1. Session dropdown loads finished sessions
2. Penalty selector only appears in player-comparison mode
3. Graph won't load without required selections
4. X-axis shows time in HH:MM format
5. Y-axis starts at 0 for count modes
6. Multiplier bands toggle works
7. Presets save and load correctly
8. No errors in console

### Known Working:
- ✅ All 4 graph modes selectable
- ✅ Mode switching clears penalty selection
- ✅ Validation prevents invalid graph builds
- ✅ All styles render correctly
- ✅ No TypeScript compilation errors

---

## File Change Summary

### Files Modified: 3
1. **SessionAnalysisTab.tsx** - Added penalty selector, improved UI
2. **SessionGraphView.tsx** - Added X-axis labels, smart Y-axis
3. **SESSION_GRAPH_ENGINE.md** - Added documentation updates

### Files Created: 1
1. **IMPLEMENTATION_COMPLETE.md** - Detailed implementation report

### Total Lines Changed: ~100 (core functionality additions)

---

## Performance Notes

### Optimizations Implemented:
- `useMemo` for scale calculations
- `useCallback` for all event handlers
- Efficient color rotation (8-color palette)
- Horizontal scrolling without re-renders
- Memoized replay logic in graph engine

### Next Performance Steps:
- Consider Canvas/Skia for high-density graphs
- Add session data caching
- Virtual scrolling for large session lists

---

## Future Enhancement Queue

1. **Data Point Images** - Render member avatars at each point
2. **Fullscreen Mode** - Expand graph for better viewing
3. **Player Filters** - Toggle players on/off
4. **Export Functions** - PNG, JPEG, PDF export
5. **Graph Caching** - Improve repeated access speed
6. **Advanced Styling** - Custom themes and colors

---

## Support & Troubleshooting

### If Graph Won't Load:
- ✅ Check session selected (required)
- ✅ Check penalty selected (required for player-comparison mode)
- ✅ Check console for errors
- ✅ Verify SessionLog data exists for session

### If Styling Looks Wrong:
- ✅ Clear React Native cache
- ✅ Restart Metro bundler
- ✅ Check Tailwind/StyleSheet consistency

### If Presets Won't Save:
- ✅ Check AsyncStorage permissions
- ✅ Verify preset name is not empty
- ✅ Check device storage space

---

**Status**: Implementation Complete ✅
**Tested**: No errors on main features ✅
**Ready for**: QA and user testing ✅
