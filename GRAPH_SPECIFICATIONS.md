# Session Analysis Graph Specifications (Updated Dec 12, 2025)

## Overview
Session Analysis graphs are used in:
- Statistics → Tab 3 (Session Analysis)
- SessionDetails → Session Analysis

## Graph Behavior

### Graph Titles
- **Compare graphs**: Display actual penalty name (e.g., "Zu spät gekommen") instead of mode string
- **Other modes**: Display mode name

### X-Axis (Timeline)
- **Range**: sessionStart → sessionEnd exactly (no extension beyond session end)
- **Format**: Uses Club.timeFormat setting:
  - HH:mm (default)
  - HH:mm:ss (with seconds)
  - 12-hour format (h:mm a)
- **Ticks**: Evenly spaced at adaptive intervals (5, 10, 15, 30, 60, or 120 minutes based on session duration)
- **Final Tick**: Always placed at exact session end timestamp
- **Display**: Full timeline visible from start to end in all modes

### Y-Axis
- **Start**: Always 0 in all modes (counters, amounts, replay, compare)
- **Ticks**: Integer values only
  - Counters: 0, 1, 2, 3, ...
  - Amounts: 0, 5, 10, 15, ... (rounded to nearest 5)
- **Currency**: Amount graphs append club currency symbol to Y-axis labels (e.g., "5 €", "10 €")
- **Max**: Dynamic, calculated from actual data with minimal padding

### Line Behavior
- **Jump-only**: Lines jump at commit timestamps (step-wise)
- **No interpolation**: No proportional/smooth curves between commits
- **Applies to**: All modes (count, amount, replay, compare)

### Data Points
- **Member images**: Displayed at every commit point with dummy fallback
- **Tooltips**: Tap any point to see:
  - Timestamp (formatted per Club.timeFormat)
  - Member name + picture
  - Penalty name
  - sessionLog.amountTotal (or applied amount/y-value fallback)

### Multiplier Bands
- **Optional**: Toggle ON/OFF in session analysis
- **Visual**: Background gradient bands showing active multiplier periods

## Fullscreen Mode

### Layout
- **Headers/Footers**: Completely removed
- **Visible**: Only graph + legend
- **Status Bar**: Hidden
- **Navigation Bar**: Hidden (native back remains)

### Scaling
- **Graph**: Maximizes to full screen dimensions
  - Width: 100% of screen width
  - Height: Screen height minus minimal legend space (~60px)
- **Padding**: Minimized in fullscreen
  - Left: 50px (for Y-axis labels)
  - Right: 10px
  - Top: 10px
  - Bottom: 40px (for X-axis labels)
- **Legend**: Scales proportionally
  - Font size: 14px (vs 12px normal)
  - Icon size: 16x16px (vs 12x12px normal)
  - Position: Bottom center or bottom-right

### Orientation
- **Landscape**: Primary fullscreen layout (preferred)
  - Max width for graph
  - Remaining height for labels and legend
- **Portrait**: Also supported with max viewport
  - Graph takes priority area
  - Legend below or overlaid in non-blocking corner

## Export Functions
- **Formats**: PNG, JPEG, PDF
- **Includes**:
  - Graph image
  - Legend
  - Timeline
  - Multiplier bands
- **Sharing**: Via expo-sharing and expo-file-system (when available)

## Modes

### Count per Penalty
- Y-axis: Commit count
- Lines: One per penalty
- Title: Mode name

### Total Amount per Player
- Y-axis: Cumulative amount with currency
- Lines: One per player
- Title: Mode name

### Full Session Replay
- Y-axis: Total cumulative session amount
- Lines: Single line (all members combined)
- Title: "Full Session Replay"

### Player Comparison per Penalty
- Y-axis: Commit count per player for selected penalty
- Lines: One per player
- Title: Actual penalty name
- Penalty Selection: Configurable per club (defaults to title penalties)

## Compare Graph Configuration
- **Location**: SessionDetails → Session Analysis
- **Selection**: Inline modal to choose which penalties appear as compare graphs
- **Persistence**: Saved per club via graphOptionsService
- **Defaults**: Title penalties from session.winners (if no custom selection)

## Technical Notes
- Graph rendering: `SessionGraphView.tsx`
- Data engine: `sessionGraphEngine.ts`
- Fullscreen screen: `GraphFullscreenScreen.tsx`
- Club settings integration: `ClubEditScreen.tsx` ("Options" → "Default Graph Penalties")
