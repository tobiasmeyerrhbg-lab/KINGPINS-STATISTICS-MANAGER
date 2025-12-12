Session Graph Engine — Full Specification

The Session Graph Engine is responsible for reconstructing and visualizing the evolution of a Session by replaying all SessionLog entries in chronological order.
This document defines how to calculate graph data, how to apply penalties, and how the visual layers must be rendered.

1. Data Sources
1.1 SessionLog (single source of truth)

Every graph is produced exclusively from SessionLog entries.
Each log entry contains at minimum:

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
extra TEXT
);


1.2 Members
Used to:
Track totals and counts during replay
Render player images at each data point

1.3 Penalties
Required to interpret:
penaltyType
base amount
multiplier rules

2. Graph Modes

The graph engine must support multiple visualization modes:

2.1 Count per Penalty Mode

Y-axis = commit count
Tracks how many times a selected penalty was committed over time
One line per penalty (or aggregated)


2.2 Total Amount per Player Mode

Y-axis = cumulative amount
Each player has a separate colored line
Values change depending on penalty type rules


2.3 Full Session Replay Mode

Purpose: Complete chronological visualization of session with cumulative totals

Y-Axis: Total cumulative session amount (sum of all member contributions)

Data Visualization:
- Single line representing total session amount
- Starts at 0, increases with each commit that adds amount
- Each data point shows timestamp and cumulative total to that point
- Graph jumps occur only at commit timestamps (step-wise, no interpolation)

Data Points:
- One point per commit that affects total amount
- Multiplier bands show active multiplier periods in background
- Member image displayed at each commit point (showing who committed)

Example Flow:
```
08:00 - Commit 1 (+$5) → line jumps from 0 to 5
08:05 - No commits → line stays at 5
08:10 - Commit 2 (+$3) → line jumps from 5 to 8
08:15 - Commit 3 (+$10) → line jumps from 8 to 18
```

2.4 Player Comparison per Penalty

Requires a selected penalty. The graph cannot be built without `selectedPenaltyId`.
Y-axis shows integer commit counts per player for the selected penalty, X-axis displays actual session time (HH:MM).
Graph behavior is step-wise with jumps at commit timestamps only.

3. Fullscreen Mode (All Graphs)

- All modes support a fullscreen view via the Session stack route `GraphFullscreen`.
- Fullscreen preserves interactivity: axis labels, multiplier visualization, tooltips with member images, and scrolling.
- Access: Tab 3 provides a “Fullscreen” button and a header action inside `SessionGraphView`.

4. Export Functions

- Formats: PNG, JPEG, PDF.
- PNG/JPEG: Capture the rendered graph using `react-native-view-shot` (includes legend, multiplier bands, and metadata footer).
- PDF: Export simple metadata via `expo-print`; image capture fallback used when available.
- Saving and sharing use `expo-file-system` and `expo-sharing` when available; code guards ensure graceful fallback if modules are missing.

2.4 Player Comparison per Penalty

Purpose: Compare players based on commit counts for a selected penalty.

Y-Axis: Commit count for the selected penalty (starts at 0, integers only)

Data Points:
- Each log with penaltyId = selectedPenalty
- One point per commit, showing (timestamp, currentCountOfPlayer)
- Graph jumps at commit timestamps only

Display:
- Each player has a separate colored line
- Member avatar image displayed at each commit point
- Integer Y-axis with dynamic spacing

Requirements:
- Penalty selector dropdown appears only in this mode
- Graph building is prevented without penalty selection
- Multiplier bands can be toggled ON/OFF
- Full legend showing all players

3. X-Axis Definition

X-axis represents time progression during the session.

Calculation: x = log.timestamp - session.startTime (relative milliseconds)

Display: X-axis labels show actual session time in HH:MM format (not relative time)
- Session startTime is converted to local time
- Labels calculated as: new Date(session.startTime + relativeMs)
- Format: "HH:MM" (24-hour format)
- Example: Session starts at 08:15 → labels show 08:15, 08:30, 08:45, etc.

Evenly spaced labels across the full session span with adaptive 5–120 minute steps. Step-wise behavior: Graph points jump at exact commit timestamps only, no interpolation between events. Timeline remains visible even if early commits are absent.

4. Y-Axis Definition

Y-axis normalization (all modes):
- Starts at 0 for every graph mode (counts, amounts, replay, comparison).
- Integer ticks only; labels auto-space to avoid overcrowding but never use decimals.
- Full Session Replay uses the cumulative session total from zero upward with the same integer tick generation.

Tooltips: Each data point exposes time, penalty name, member name + image (dummy fallback), multiplier at that moment, and the log’s amountTotal (falling back to applied amount/y-value).
- Starts at 0, increases monotonically with each commit

5. Replay Engine Logic

The replay engine processes every log entry in ascending timestamp order.

Pseudo-code:

initialize totals[playerId] = 0
initialize counts[playerId][penaltyId] = 0
initialize graphData = []

for each log in SessionLogs ORDER BY timestamp:
    applyPenalty(log)
    recordDataPoint(log)

5.1 Applying Penalty Logic

Based on the penalty type:

(1) penaltyType = self
totals[committer] += amount * multiplier
counts[committer][penalty] += 1

(2) penaltyType = other
for each player != committer:
    totals[player] += amount * multiplier
    counts[player][penalty] += 1

(3) penaltyType = both
apply self rules
apply other rules

(4) penaltyType = none

Informational only — does NOT change totals, but creates a data point.

5.2 Recording Data Points

Every SessionLog becomes a graph data point.

Each point includes:

x: timestamp-relative
y: depends on mode
committerImage: members[committer].image
penaltyId
amountApplied
multiplierAtThisTime


These points form the line charts.

6. Multiplier Visualization

Multiplier changes (systemEventType = MULTIPLIER_CHANGE) create background timeline segments.

Rules:

Multiplier = 1 → transparent background

Multiplier > 1 → gradient:

Low multiplier = soft orange

High multiplier = red

Background is drawn behind all graph data.

Implementation Notes (Engine & Rendering)

Engine:
- Implemented in `src/services/sessionGraphEngine.ts`.
- Replays `SessionLog` in chronological order to build line `series` and multiplier `bands`.
- X-axis: relative time `timestamp - session.startTime`.
- Y-axis: per mode — counts (integer starting at 0), cumulative totals (amount), or session total.
- Negative commits (system=9) applied as `delta = -1`.
- Bands generated from system=5 logs with start/end boundaries.
- Full Session Replay: Single cumulative line tracking total session amount.
- Count modes: Step-wise graph jumping at commit timestamps only (no interpolation).
- Amount modes: Cumulative step-wise with proper member amount calculations.

Rendering:
- Session Graph Component: `src/components/graphs/SessionGraphView.tsx`
- Features implemented:
  - **Member Images**: 24x24 colored circles with member avatar at each data point
    - Image URI from member.image field
    - Fallback to default-member.png if unavailable
    - Display in all graph modes
  - **Multiplier Bands**: Background gradient visualization
  - **X-Axis Labels**: Actual session time in HH:MM format
    - Calculated from session.startTime + relative milliseconds
    - 5 evenly spaced labels
    - Example: Session starts 08:15 → shows 08:15, 08:22, 08:30, etc.
  - **Y-Axis Labels**: Mode-aware intelligent spacing
    - Count modes: Integer-only labels (0, 1, 2, 3, ...)
    - Amount modes: Decimal labels with 1 decimal place
    - Dynamic label generation to avoid overcrowding
  - **Line Segments**: Color-coded per series with proper transforms
  - **Data Points**: Member avatars with colored backgrounds
  - **Legend**: Series identification with color coding
  - **Grid Lines**: Reference lines at 25% intervals
  - **Horizontal Scrolling**: Support for wide graphs
- Future: Canvas rendering (React Native Skia/SVG), export pipeline (PNG/JPEG/PDF), fullscreen mode

Favorites:
- Presets service: `src/services/graphPresetsService.ts`
- Functionality:
  - Save current graph configuration as a preset with custom name
  - Load saved presets to restore configuration (mode, penalties, multiplier settings, etc.)
  - Delete saved presets
  - Storage: AsyncStorage for persistence
  - UI: Modal interface for managing presets

7. Favorites

Users can save and load favorite graph configurations:

Selected mode

Selected penalties

Selected players

Color scheme

Filters

Enabled multiplier shading

Y-axis type

Stored as JSON preset.

8. Export Functions

Every graph can be exported:

PNG

JPEG

PDF

Exports must include:

Graph image

Legend

Session metadata

Multiplier bands

Status: Export stub functions are defined in the service. Full implementation pending canvas integration.

9. Performance Considerations

- Pre-calculation caching for repeated session views
- Memoized calculations in SessionGraphView (minX, maxX, minY, maxY)
- Memoized replay logic in sessionGraphEngine
- Canvas-based rendering or RN Skia recommended for production deployment
- Avoid unnecessary re-renders of graph component

10. User Interface

SessionAnalysisTab Component (`src/screens/statistics/SessionAnalysisTab.tsx`):

Features:
- Session Selector: Modal dropdown showing finished sessions with date/time and player count
- Graph Mode Selection: 4 buttons for different visualization modes
  - Count per Penalty
  - Total Amount per Player
  - Full Session Replay
  - Player Comparison per Penalty
- Penalty Selector: Conditional dropdown appearing ONLY when "Player Comparison per Penalty" mode is selected
  - Required: Graph building is prevented without penalty selection in this mode
- Options:
  - Toggle Multiplier Bands visualization ON/OFF
- Favorites (Presets):
  - Save current configuration with custom name
  - Manage saved presets (view, apply, delete)
- Load Graph Button: Triggers graph calculation with validation
- Error Handling: Alerts user if required selections are missing

Modal Interfaces:
- Sessions Modal: Horizontal list of available finished sessions
- Penalties Modal: List of available penalties for selection
- Presets Modal: Save new preset, view saved presets with delete option