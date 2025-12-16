Statistics Screen (Session Analysis updated)

Overview:
- Location: Club menu → Statistics → Tab 3 (Session Analysis).
- Purpose: Analyze a single session with the Session Graph Engine (4 modes + fullscreen + export).

Layout:
- Safe area container with tab navigator.
- Session Analysis tab now embeds `SessionAnalysisTab` with graph, fullscreen entry, and export.

Tabs:
- All-Time: Placeholder.
- Cross-Session: Placeholder.
- Session Analysis: Active; contains graph modes, multiplier bands toggle, penalty selector (for comparison), presets.
- Exports: Placeholder.

Session Analysis (Tab 3) specifics:
- Modes: Count per Penalty, Total Amount per Player, Full Session Replay (cumulative), Player Comparison per Penalty.
- X-axis: Actual session time (HH:MM) with even spacing (auto 5–120 min step based on span); timeline always visible across the full session.
- Y-axis: Starts at 0 in all modes; integer ticks only (counts and amounts) for clean labels.
- Behavior: Step-wise lines (jump only at commit timestamps); multiplier bands optional.
- Member images: Shown at every data point with dummy fallback.
- Tooltips: Tap a point to see time, penalty, member name + picture, and that log’s amountTotal (falls back to applied amount/y-value).
- Fullscreen: “Fullscreen” button opens `GraphFullscreen` screen; unified layout for both Tab 3 and SessionDetails → SessionAnalysis.
- Export: PNG/JPEG via view-shot; PDF via expo-print; sharing/saving via expo-sharing and expo-file-system when available; export includes legend, timeline, multiplier bands, and session metadata footer.

Fullscreen Graph Layout (global: Tab 3 + SessionDetails):
- Layout stack: Navigation Header (app-level) → Graph → X-Axis → Legend.
- Header: shows back navigation and title. Title rules: Full Graph = “Session Graph – Full Timeline”; Compare = “{Penalty Name} – Player Comparison”. Header is visible in portrait and landscape.
- X-axis: Reserved space (48–56px) so labels/line/ticks never clip; final tick/session-end always visible; evenly spaced minute/timeline intervals.
- Legend: Always visible at bottom, minimal spacing (0–4px), no overlap with graph or axes; tap targets ≥44px.
- Scaling: Graph scales to available height after subtracting header + X-axis band + legend; Y-axis starts at 0, dynamic max; tooltips, multiplier bands, exports unchanged.
 - Margins: Fullscreen adds a small right-side padding (~16px) to avoid edge crowding; a small top spacer (8–12px) below the header improves readability.

Navigation:
- ClubDetail → Statistics route (unchanged).
- From Session Analysis tab, “Fullscreen” navigates to `GraphFullscreen` in Session stack.
 - Statistics Tab 3 fullscreen uses the same dynamic title logic as SessionDetails (Full Timeline vs Player Comparison) and shares the same layout template.

Notes:
- Favorites/presets remain available in Tab 3.
- Works also when opened from SessionDetails → SessionAnalysis path (same screen & config).
# UI-GUIDE.md  
PenaltyPro – UI Architecture & Component Registry
## 0. UI Overhaul — Visual Design System (2025-12-12)

This section defines the updated visual design language applied across the app. It improves aesthetics without changing any logic or data behavior.

### Colors
- Primary: #3B82F6 (blue)
- Accent: #10B981 (green)
- Warning: #F59E0B (amber)
- Danger: #EF4444 (red)
- Text primary: #0F172A
- Text secondary: #334155
- Muted: #64748B
- Border: #E2E8F0
- Background: #F8FAFC

### Typography
- Base font: System default (iOS San Francisco / Android Roboto)
- Title: 18–20, weight 700
- Section heading: 16, weight 700
- Body: 14, weight 500–600
- Caption: 12, weight 500

### Spacing
- Grid: 4px units
- Container padding: 12–16px
- Inter-section spacing: 12–16px
- Control touch target: ≥44px height

### Icons
- Size: 18–22px in lists, 22–28px on primary sections
- Baseline alignment with labels
- Uniform color: #0F172A (muted: #64748B)

### Components
- Cards: white background, border #E2E8F0 (1px), radius 10–12px, shadow subtle
- Buttons: filled (primary) or outline; padding 10–12px; radius 8–10px
- Lists: sticky headers where applicable; row height 48–56px

---

## 1. Club Screens — Overhaul

### Club Home Screen
**Fix:** Ensure Club Logo dummy displays correctly (use local fallback with proper aspect ratio and `resizeMode='contain'`), size ~72–96px, centered.

### Club Details Screen
**Goal:** Sessions placed at top; most prominent section.

**Sections (order):**
1. 📅 Sessions (primary)
2. 👥 Members
3. 💰 Financials
4. ⚠️ Penalties
5. 📊 Statistics
6. ⚙️ Options (rename “Edit Club” → “Options”)

**Implementation notes:**
- Each section uses a heading with the icon and title; heading row height ≥48px, icon ~22–24px.
- Use a prominent card for Sessions: larger title, short description, and quick action.
- Keep logic untouched; only layout and visuals.

---

## 2. Sessions — List Updates

### Sessions Screen
**Remove:** Top header with back-button + “Sessions” title; rely on global navigation top-bar.

**Add:** Year filter at top (default: current year). Control: dropdown or segmented buttons.
- Default behavior: Show sessions `startTime` in current year.
- Provide quick toggle to show “All years”.

**List styling:**
- Card rows with date, player count, and brief summary; divider color #E2E8F0.
- Right chevron (muted) for navigation.

---

## 3. Session Details — Layout Improvement

**Objective:** Cleaner, more structured, visually appealing, zero logic changes.

**Layout proposal:**
- Compact top bar (already present).
- Summary header card: session date, players, duration, multiplier overview.
- Two-column info blocks where appropriate; consistent spacing (12–16px).
- Clear section dividers with headings.
- Harmonized colors and typography per the design system.

**Notes:** Tooltips, counters, amounts, commit lines, multiplier bands — unchanged.

---

## 4. Statistics — Tabs Icons

Assign icons:
- 🕒 All-Time
- 🔄 Cross-Session
- 🧠 Session Analysis
- 📤 Exports

**Placement:** Tab bar icons alongside tab labels, size ~20–22px.

**Consistency:** Same icon set used wherever these tabs are referenced.

---

## 5. Fullscreen Graphs — Unified Template

**Layout stack:** Navigation Header → (8–12px spacer) → Graph → X-Axis (reserved 52–56px) → Legend (0–4px gap)

**Header (app-level):** Shows back and dynamic title
- Full Graph: “Session Graph – Full Timeline”
- Compare Graph: “{Penalty Name} – Player Comparison”

**X-axis:** Always visible; final tick (session end) fully visible; evenly spaced minute-based labels.

**Legend:** Compact, bottom placement; no overlap with X-axis; item tap targets ≥44px; items wrap (`maxWidth ~48%`).

**Portrait & landscape:** Same spacing rules; graph scales but never clips X-axis or legend.

**Unchanged behaviors:** Tooltips, multiplier bands, step-wise lines, Y-axis (starts at 0, dynamic max), exports, compare logic.

---

## 6. Minor UI Improvements (Global)
- Spacing normalization using 4px grid.
- Typography consistency (weights and sizes per section role).
- Button styles unified; hover/press feedback consistent.
- Color harmony across screens with the design palette.

---

## 7. Implementation Instructions

### Icons
- Add icons to each relevant header/section label:
  - Club Details: 📅 👥 💰 ⚠️ 📊 ⚙️
  - Statistics Tabs: 🕒 🔄 🧠 📤
- Use Text emoji icons (for MVP) or replace with vector icons later; font size ~20–22.

### Club Screens
- Update Club Details headings to include icons and reorder sections so Sessions is first.
- Rename “Edit Club” to “Options” in `ClubStackNavigator` and any labels.
- Ensure logo dummy fallback image is displayed with contain mode and padding.

### Sessions Screen
- Remove redundant “Sessions” top header; rely on global nav.
- Add year filter (UI-only): default to current year view; implement selection control without changing backend.

### Statistics Tabs
- Add icons to Tab 4 items; ensure consistent size and spacing.

### Fullscreen Graphs
- Ensure app-level header shows correct title and back; add small spacer below header.
- Reserve X-axis space and keep legend immediately below; apply compact legend styles.

---

## 8. Deliverables
- Visual design proposals: referenced by these rules; add screenshots in `/docs/screenshots/`.
- Implementation instructions: above sections provide step-by-step UI changes; no logic changes.
- Updated UI-GUIDE: this file is the canonical reference for the overhaul.

---

## 9. Implemented Changes Summary

### Club Details Screen
- Sections reordered: Sessions first (most prominent).
- Icons added to all actions: 📅 Sessions, 👥 Members, 💰 Financials, ⚠️ Penalties, 📊 Statistics, ⚙️ Options (renamed from "Edit Club").
- Club logo uses `resizeMode="contain"` with fallback placeholder (first letter in colored circle).
- File: `src/screens/clubs/ClubDetailScreen.tsx`

### Sessions List Screen
- Added year filter UI at top (default: current year, toggle to "All").
- Client-side filter; no backend changes.
- Removed redundant "Sessions" header; uses global navigation bar.
- File: `src/screens/sessions/SessionListScreen.tsx`

### Statistics Screen Tabs
- Tab icons added via `tabBarIcon`:
  - 🕒 All-Time
  - 🔄 Cross-Session
  - 🧠 Session Analysis
  - 📤 Exports
- Icon size: 18px, consistent alignment with labels.
- File: `src/screens/statistics/StatisticsScreen.tsx`

### Session Details Screen
- Visual polish: updated colors, typography, spacing per design system.
- Section cards: white bg, 1px border (#E2E8F0), radius 12, subtle shadow, 16px padding.
- Section titles: underlined, #0F172A, 18px weight 700.
- Labels: #64748B, 14px; values: #0F172A, 14px weight 600.
- Action buttons: primary (#3B82F6), secondary (#0F172A), 14px padding, radius 10, subtle shadows.
- Winner/summary cards: tighter borders, improved color hierarchy.
- Commit counts/totals: design system colors (debt #EF4444, credit #10B981, neutral #64748B).
- File: `src/screens/sessions/SessionDetailsScreen.tsx`

### Fullscreen Graphs
- Already unified: app-level header, reserved X-axis (52–56px), compact legend, dynamic title.
- No changes needed; already documented.

### Graph Tooltips (2025-12-12)
- **Timezone Support:** Tooltips now display time in the club's configured timezone (e.g., CET, UTC, EST).
- **Time Format:** Respects club's timeFormat setting (HH:mm, h:mm a, HH:mm:ss).
- **Implementation:**
  - Added `timezone` prop to SessionGraphView component.
  - Created `formatTooltipTime()` helper function with IANA timezone mapping.
  - CET automatically mapped to Europe/Paris for proper timezone conversion.
  - No AM/PM displayed unless timeFormat is `h:mm a`.
- **Files Modified:**
  - `src/components/graphs/SessionGraphView.tsx`: Added timezone prop and formatting logic.
  - `src/screens/sessions/SessionAnalysisScreen.tsx`: Loads and passes club timezone.
  - `src/screens/statistics/GraphFullscreenScreen.tsx`: Passes timezone to fullscreen graphs.

### Club Options Screen (formerly "Edit Club") (2025-12-12)
- **Layout Reorganization:** Improved visual hierarchy and clarity.
- **Default Graphs Section:**
  - Renamed from "Default Graph Penalties" to "Default Graphs".
  - Added explanation text: "Select which penalties should be displayed as comparison graphs by default in the Session Analysis screen."
  - Moved above Delete Club button for better UX flow.
  - Save button relabeled to "Save Default Graphs".
- **Delete Club Button:**
  - Moved to bottom of screen (below Default Graphs section).
  - Added visual separator with danger zone divider (red tint #FCA5A5).
  - Clear separation between settings and destructive action.
- **Visual Improvements:**
  - Section divider: 1px gray (#E2E8F0), 32px vertical margin.
  - Section title: 18px, weight 700, #0F172A.
  - Section description: 14px, #64748B, line height 20.
  - Danger zone divider: 1px red tint (#FCA5A5), 48px vertical margin.
- **File:** `src/screens/clubs/ClubEditScreen.tsx`

### Screenshots
- Placeholder: add screenshots to `/docs/screenshots/` showing:
  - Club Details with icons and reordered sections.
  - Sessions list with year filter.
  - Statistics tabs with icons.
  - Session Details polished layout.
  - Fullscreen graphs (portrait/landscape).


This document serves as the **single source of truth** for all UI-related structures, screens, components, and layout logic of the PenaltyPro application.

Every AI agent or developer must update this file whenever new UI elements are created or existing ones are changed.

---

## 9.a Photos & Logos — Camera/Gallery Integration (2025-12-16)

Purpose:
- Enable users to attach images via camera or gallery for Clubs (Logo) and Members (Photo).
- Ensure selected images appear everywhere a placeholder/dummy was previously shown.

User Entry Points:
- Clubs: Button label “+ Pick Logo” or “Change Logo”
- Members: Button label “+ Pick Photo” or “Change Photo”

Behavior:
- Tapping the button opens a prompt with options:
  - Take Photo (camera)
  - Choose from Library (gallery)
- Images are downscaled and compressed (max ~512×512, quality ~0.8) to save storage.
- Selected image URI is stored in the entity record and shown across the app.

Files:
- Service: `src/services/imagePickerService.ts` (shared camera/library prompt + compression)
- Clubs: `src/screens/clubs/ClubCreateScreen.tsx`, `src/screens/clubs/ClubEditScreen.tsx`
- Members: `src/screens/members/MemberCreateScreen.tsx`, `src/screens/members/MemberEditScreen.tsx`

Storage Fields:
- Club: `logoUri` (TEXT)
- Member: `photoUri` (TEXT)

Display Fallbacks:
- If no URI stored: fallback dummy images remain (e.g., `assets/images/dummy/default-member.png`).

Platform Notes:
- Uses `react-native-image-picker` for camera/gallery access.
- Android: ensure camera & external storage permissions are declared in `AndroidManifest.xml` if not already present.
- iOS: ensure `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` keys exist in `Info.plist`.

Developer Usage (example):
```ts
import { pickImageWithPrompt } from '../../services/imagePickerService';
const uri = await pickImageWithPrompt('photo');
if (uri) setPhotoUri(uri);
```

Result:
- “Pick Logo/Photo” now offers camera or gallery.
- Images persist and render wherever `logoUri`/`photoUri` are used throughout the app.


## 1. Core Principles

### 1.1 Modularity  
All UI is broken into discrete, reusable, testable blocks.  
Each block has:
- a dedicated file  
- clearly typed props  
- a simple input/output contract  
- no business logic inside the UI  

### 1.2 Club-Specific UI Layout  
Every club stores its own layout configuration under:

clubs/{clubId}/uiLayout/


Currently supported layout groups:
- `sessionSummary` – layout for the end-of-session summary screen  

Agents must extend this directory whenever new layouts become user-configurable.

### 1.3 Extensibility  
If new UI blocks or screens are required:
1. Create a new file in `/ui/{category}/`
2. Document the block in this guide (name, purpose, props)
3. Add it to the relevant layout group if configurable

---

## 2. UI Screens

### 2.0 ID Display Policy
**MANDATORY FOR ALL SCREENS:**
- Show **names** everywhere, never IDs
- Members → use `member.name`
- Penalties → use `penalty.name`
- Clubs → use `club.name`
- Sessions → use formatted date/time
- Lookups required: Pre-fetch members, penalties, and clubs by ID to resolve names before rendering

### 2.0a SessionLiveScreen — Table Grid Layout

**File:** `/src/screens/sessions/SessionLiveScreenNew.tsx`

**Purpose:** Display active session with real-time penalty commit grid, member totals, session timer, and multiplier control.

**IMPORTANT: Session Table Display Logic**
- **SessionTableScreen (view-only)** uses the **exact same display logic** as the Active Table
- Commit count format, penalty amount display, and member totals are **identical** between active and view-only modes
- See Section 2.2c for complete Session Table specification

**Mandatory Layout:**

1. **Compact Top Bar (single row only):**
   - **Layout:** Horizontal flex with three sections
   - **Left section (flex: 1, left-aligned):**
     - Display: `"<CLUBNAME> Session YYYY-MM-DD"`
     - Example: "Berka Kingpins Session 2025-12-06"
     - Font: 14pt, weight 600, color #000
   - **Center section (flex: 1, center-aligned):**
     - Display: **HH:MM:SS** elapsed time (e.g., "00:15:30", "02:30:00")
     - Updates every second
     - Font: 16pt, weight 700, color #007AFF
   - **Right section (right-aligned):**
     - **Multiplier button** showing current value ("1×", "2×", etc.)
     - Compact padding (12px horizontal, 6px vertical)
     - When tapped: opens slider modal (see below)
   - **Styling:** Minimal vertical height (paddingVertical: 8), backgroundColor #f9f9f9, borderBottomWidth 1
   - **No second row:** Back button removed entirely; only native navigation remains

2. **Main Grid Table:**
   - **Starts directly below top bar** (no spacing)
   - **Horizontal + Vertical scrollable area** (scrolling enabled as fallback when content exceeds screen)
   - **Y-axis (rows):** Members (one row per member)
     - Each row starts with: **member name** (left-aligned, sticky column)
     - NO "Club" column displayed
   - **X-axis (columns):** Penalties (one column per active penalty)
     - Penalty name as column header (sticky row)
   - **Each cell:** Commit counter for that member–penalty pair
     - Format: **[−] count [+]**
     - `−` button: taps to decrement (system=9 negative commit)
     - `count`: current commit counter for this pair
     - `+` button: taps to increment (system=8 positive commit)
     - Buttons: minWidth/minHeight 38px, paddingHorizontal 10, paddingVertical 8, backgroundColor #007AFF, color white
   - **Right edge of each row:** Member's **live total amount** (right-aligned, sticky)
   - **Dynamic column widths:** Member name 20%, penalties distributed, total 12% (optimized for landscape)
   - Grid scrolls horizontally (many penalties) and vertically (many members) when needed

3. **Live Session Summary (minimal footer):**
   - **Below the grid:**
   - Compact horizontal layout with minimal padding (8px vertical, 12px horizontal)
   - Left: Total session amount + player count ("Total: $X | Players: N")
   - Right: **+ Members button** (green, compact) + **End Session button** (blue, compact)
   - Background: #f9f9f9, borderTopWidth 1

4. **Add Members Button:**
   - Label: "+ Members"
   - Color: Green (#28a745), compact size (paddingHorizontal 12, paddingVertical 6)
   - Opens member selection/creation modal
   - Allows adding existing members OR creating new members during active session
   - After selection/creation: writes system=1 log for each new member added to session

5. **End Session Button:**
   - Label: "End Session"
   - Color: Blue (#007AFF), compact size
   - Enabled when session is active
   - Triggers finalization flow (title/reward resolution modals)

**Multiplier Slider Modal:**
- **Trigger:** Tap multiplier button in top bar (e.g., "1×")
- **Modal title:** "Select Multiplier"
- **Control:** Horizontal slider
  - Range: 1 to Club.maxMultiplier (default: 10)
  - Integer values only
  - Displayed value: "X×"
- **Behavior:** Slider applies immediately and updates Session.multiplier
- **Log:** Writes system=5 log on change if multiplier value actually changes
- **Close:** User swipes/taps outside modal or taps "Done"

**Add Members Modal:**
- **Trigger:** Tap "+ Members" button in footer
- **Modal title:** "Add Members to Session"
- **Content:** Allows selecting existing members OR creating new members
- **Behavior:** 
  - Selected members added to Session.activePlayers
  - System=1 log written for each added member (timestamp = now)
  - Modal closes after selection
  - Table refreshes to show new member rows

**Performance Rules:**
- Horizontal/vertical scrolling must be smooth (no lag)
- Grid cells must render efficiently (use memoization for cell components)
- Live updates (on commit) must not cause full re-render; update only affected cells
- Member totals must update in real-time
- Session total must update in real-time
- Table prioritized: Gets flex: 1 for maximum vertical space

### 2.1 `SessionLiveScreen`
**File:** `/src/screens/sessions/SessionLiveScreen.tsx`  
**Purpose:**  
Displays all real-time session interactions:
- penalty counters per member  
- active session timer  
- live session stats  
- end-session trigger  

**Receives:**  
`sessionState`, `members`, `livePenaltyCounts`

---

### 2.1a `SessionListScreen`
**File:** `/src/screens/sessions/SessionListScreen.tsx`  
**Purpose:**  
Displays all sessions (active and finished) for a single club with filtering and resume capability.

**Displays:**
- **Club-scoped list** of sessions (all sessions for the given clubId)
- **ORDERING**: Sessions sorted by **date/createdAt descending** (latest session on top)
- **Session cards** with:
  - **Session Name:** Formatted as `"Session YYYY-MM-DD HH:MM"` (e.g., "Session 2025-12-06 14:30")
    - YYYY-MM-DD from Session.date
    - HH:MM from Session.startTime (hours and minutes in local time)
  - Status badge ("active" / "finished")
  - Duration (formatted as "Xh Ym Zs" or "-" if active)
  - Total amount (sum of all member totals)
  - Participant count
  - **Resume button** (only for active sessions) - navigates to SessionLive with sessionId
  - Tap otherwise → SessionDetails

**Layout:**
- FlatList with horizontal separator
- Header: "Sessions for [clubName]"
- Pull-to-refresh enabled

**Header/Top CTA:**
- **"Start New Session"** button (prominent position at top or as FAB)
- Navigates to SessionCreate with clubId, clubName, maxMultiplier

**Receives:**  
`clubId`, `clubName`, `maxMultiplier`

**Navigation:**
- Resume active session → SessionLiveScreen with sessionId
- View session details → SessionDetailsScreen with sessionId
- Start new → SessionCreateScreen with clubId, clubName, maxMultiplier

---

### 2.1b `SessionCreateScreen`
**File:** `/ui/screens/sessions/SessionCreateScreen.tsx`  
**Purpose:**  
Allows creation of a new session by selecting participating members and validating penalty requirements.

**Workflow:**
1. **Header:** "Start New Session for [clubName]"
2. **Member selection:**
   - Checkbox list of all active members (for the club)
   - Each member shows: name, avatar
   - State: currently selected count displayed
   - **NEW: Inline "Add New Member" button/link**
     - Tapping opens the same Create Member modal/dialog used in Members module
     - After creation, new member appears in the list immediately (no navigation away)
     - New member is auto-selected (checked) after creation
3. **Validation checks** (before "Start" button):
   - ✓ At least 1 member selected
   - ✓ All selected members have at least 1 active penalty assigned
   - If validation fails: show inline error message (red text)
4. **"Start Session" button:**
   - Disabled if validation fails
   - On press: creates Session (multiplier=1, date=now), zeroes out MemberSessionSummary rows, writes system=1 logs
   - Navigates to SessionLiveScreen with sessionId, clubId, clubName, maxMultiplier

**Receives:**  
`clubId`, `clubName`, `maxMultiplier`

**Navigation:**
- Start → SessionLiveScreen with sessionId, clubId, clubName, maxMultiplier
- Cancel/back → SessionListScreen

---

### 2025-12-09 – Club-first Navigation Update

**Entry Flow**
- App now boots into `ClubStackNavigator` (single stack, no bottom tabs).
- `ClubsScreen` card tap navigates to `ClubDetail` instead of direct edit.

**`ClubDetailScreen`**
- File: `/src/screens/clubs/ClubDetailScreen.tsx`
- Purpose: Show club overview (name, logo/initial, created date, member count, penalty count) and route to scoped management screens.
- Layout: hero card with logo/placeholder + metadata; two action sections with list-style buttons.
- Actions: Members (`MemberList`), Financials (`Financials`), Penalties (`Penalties`), **Sessions** (`SessionList`), Edit Club.
- **NEW**: Sessions button navigates to SessionListScreen for the club (shows all sessions, sorted latest first).
- Params: `clubId` (required), `clubName` (optional for header).

**Scoped Financials**
- File: `/src/screens/financials/FinancialsScreen.tsx`
- Scope: Single club via `clubId` route param; removed cross-club filter UI.
- Features: Summary card (outstanding/collected/members with balance), member list with color-coded amounts, pull-to-refresh; tap shows placeholder alert for ledger detail.
- Navigation: launched from `ClubDetail` with `clubId`, `clubName` (for header only).

**Scoped Penalties**
- File: `/src/screens/penalties/PenaltiesScreen.tsx`
- Scope: Single club via `clubId` route param; removed club selector modal.
- Features: Active-only toggle, SectionList with a single club section (uses `clubName`), affect/title/reward/inactive badges, tap → `PenaltyEdit`, FAB → `PenaltyCreate` (keeps `clubId`).

**Members**
- Primary list now uses `MemberListScreen` (per-club) from `ClubDetail` → `MemberList` with `clubId`; FAB → `MemberCreate` with same club context.
- `MembersScreen` (all-club filter) remains for legacy reference but is no longer in the default flow.

**Sessions**
- **NEW**: ClubDetail shows one primary Sessions button → SessionListScreen
- SessionListScreen shows all club sessions sorted by date DESC (latest first), with "Start New Session" button at top
- SessionListScreen: tap session → SessionDetailsScreen; active sessions show "Resume" button → SessionLiveScreen
- SessionCreateScreen: inline "Add New Member" button opens member creation modal without navigation
- Nested under SessionStackNavigator with initialScreen routing (SessionList/Create/Live/EndSummary/Details)

**Navigation Map (simplified)**
- ClubsScreen → ClubDetail → {MemberList → MemberCreate/MemberEdit, Financials, Penalties → PenaltyCreate/PenaltyEdit, **Sessions** → SessionList → SessionCreate/SessionDetails/SessionLive, ClubEdit}.

### 2.2 `SessionEndModals` Component (NEW IMPLEMENTATION)
**File:** `/src/components/SessionEndModals.tsx`  
**Purpose:**  
Handles complete session finalization flow via sequential modals (confirmation, title resolution, reward input).

**Integration:**
- Imported and rendered by SessionLiveScreenNew
- Triggered when user taps "End Session" button
- Orchestrates with sessionFinalizationService for backend logic

**Modal Sequence:**

1. **Confirmation Modal:**
   - Title: "End Session?"
   - Text: "Are you sure you want to end this session? This cannot be undone."
   - Buttons: Cancel (returns to session) | Confirm (proceeds to title resolution)

2. **Title Resolution Modals** (one per tied penalty):
   - **Only shown if ties exist** (multiple members with same max commits)
   - Title: "Select Winner"
   - Subtitle: "Choose the winner for [penalty name]"
   - Progress indicator: "Title X of Y"
   - **Content:** Radio button list of tied members
     - Each option shows: member name + commit count (e.g., "John Doe - 5 commits")
     - Member names resolved from IDs (no ID display)
   - **Behavior:**
     - Exactly one selection required (confirm button disabled until selection)
     - Tapping radio button selects that member
     - Confirm button proceeds to next title (or to rewards if last)
   - **Backend:** Calls prepareTitleResolution(), writes system=2 logs via logTitleWinners()

3. **Reward Input Modals** (one per penalty with rewardEnabled but no rewardValue):
   - **Only shown if rewards need values**
   - Title: "Enter Reward Value"
   - Subtitle: "For [penalty name]"
   - Info text: "This will be deducted from [winner name]'s total"
   - Progress indicator: "Reward X of Y"
   - **Content:** Numeric input field
     - Placeholder: "Enter amount"
     - Validation: Must be positive number
     - Auto-focus on input
   - **Behavior:**
     - Confirm button disabled until valid number entered
     - Proceeds to next reward (or to finalization if last)
   - **Backend:** Calls prepareRewardResolution(), applies via applyRewards()

4. **Finalizing Modal:**
   - Shows spinner + "Finalizing session..." text
   - Displayed while backend processing occurs
   - Cannot be dismissed
   - Auto-navigates to SessionDetailsScreen when complete

**Props Interface:**
```typescript
interface SessionEndModalsProps {
  sessionId: string;
  clubId: string;
  members: Array<{ id: string; name: string }>;
  penalties: Array<{ id: string; name: string; isTitle: boolean; rewardEnabled: boolean; rewardValue?: number }>;
  visible: boolean;
  onClose: () => void;       // Called on cancel
  onFinalized: () => void;   // Called after successful finalization
}
```

**State Management:**
- Step tracking: 'confirm' | 'titles' | 'rewards' | 'finalizing'
- Index tracking for sequential modals (currentTitleIndex, currentRewardIndex)
- Resolution storage: resolvedWinners, resolvedRewards
- Processing flag to disable interactions during async operations

**Styling:**
- Modal overlay: semi-transparent black (rgba(0,0,0,0.5))
- Modal container: white, rounded corners (12px), padding 20px
- Radio buttons: 20px circles, blue (#007AFF) when selected
- Buttons: Full-width or flex:1, blue (#007AFF) for confirm, grey (#e0e0e0) for cancel
- Text hierarchy: 20pt bold title, 14pt subtitle, 13pt body text

**Navigation:**
- After finalization complete: calls onFinalized() prop
- SessionLiveScreenNew handles navigation to SessionDetailsScreen

---

### 2.2a `SessionDetailsScreen` (UPDATED IMPLEMENTATION)
**File:** `/src/screens/sessions/SessionDetailsScreen.tsx`  
**Purpose:**  
Displays comprehensive read-only view of finished (or active) session with all finalization data.

**Sections:**

1. **Session Information (compact):**
  - Status (badge color: green finished / orange active)
  - Date (YYYY-MM-DD)
  - Duration ("Xh Ym Zs" or "N/A")
  - Players (count only; no player list here)

2. **Title Winners** (if any):
  - Penalty name with tight card rows
  - Each winner row shows avatar on the left (member photoUri or dummy `default-member.png`), then member name, then commits of this penalty

3. **Final Totals:**
  - Member avatar on the left + member name + total amount on the right
  - Display rule (raw session output, no debt inversion):
    - Positive amount → red, no sign (e.g., `25.00`)
    - Negative amount → green, shown with minus (e.g., `-12.00`)
    - 2 decimal places

4. **Member Summaries:**
  - **Hidden** (kept in code but not rendered)

5. **Action Buttons (bottom of screen):**
  - Row/Wrap layout, four buttons:
    - "Event Logs" → opens EventLogsScreen
    - "Session Table" → opens SessionTableScreen (view-only commit matrix)
    - "Session Analysis" → opens SessionAnalysisScreen (placeholder for charts)
    - "Verify Totals" → opens SessionVerificationScreen (displays verification results)

6. **Event Logs:**
  - Now displayed in dedicated `EventLogsScreen` (not inline on SessionDetails)
  - Positive/Negative commits show timestamp, penalty, committer, and total (always rendered, fallback 0.00)
  - Player Added unchanged; Multiplier Changed shows old → new values

**Data Loading:**
- Fetches session, summaries, members, penalties (logs fetched only in EventLogsScreen)
- Resolves all IDs to names before rendering; avatars fall back to dummy assets when missing
- Shows loading spinner while fetching
- Shows "Session not found" error if sessionId invalid

**Receives:**  
`sessionId` (required), `clubId` (optional, uses session.clubId if not provided)

**Navigation:**
- Launched from SessionLiveScreenNew after finalization
- Also accessible from SessionListScreen by tapping any session card

### 2.2b `EventLogsScreen`
**File:** `/src/screens/sessions/EventLogsScreen.tsx`  
**Purpose:** Dedicated, read-only list of SessionLog entries for a session.

**Layout/Rules:**
- Player Added logs: unchanged from previous design.
- Positive/Negative Commit logs: show timestamp, penalty, committer, and total (always rendered; fallback 0.00).
- Multiplier Changed logs: show timestamp and old → new multiplier.
- Compact cards, color accents for positive/negative tags.

### 2.2c `SessionTableScreen`
**File:** `/src/screens/sessions/SessionTableScreen.tsx`  
**Purpose:** View-only grid displaying complete session commit matrix with amounts. **Uses the same display logic as the Active Table (SessionLiveScreenNew).**

**IMPORTANT: Display Logic (No Calculation Changes)**
- All data comes from existing sources: `Session.totalAmounts`, `getCommitSummaryWithMultipliers()`
- No business logic or calculations were modified
- This is purely a **visual/UI improvement** with better styling and layout

**Layout Structure:**

1. **Header Row (Blue background #3b82f6)**
   - First column (140px fixed): "Members"
   - Penalty columns (110px fixed each): penalty name + amount breakdown
   - Last column (100px fixed, yellow #fef3c7): "Total"
   - White text, bold, centered
   - 2px bottom border for visual separation

2. **Member Rows (White background, alternating with subtle borders)**
   - First column (140px): member name (left-aligned, dark text)
   - Penalty cells (110px each): commit count with multiplier breakdown (centered)
   - Last column (100px, yellow): member total amount €X.XX (green text #059669, centered)
   - 1px border between rows, 2px border before footer

3. **Footer Row (Dark background #1e293b)**
   - First column (140px): "Session Total" (white text, left-aligned)
   - **Penalty cells (110px each): Total commit count per penalty with multiplier breakdown** (light gray text, centered)
   - Last column (100px, yellow): Total session amount €X.XX (gold text #fbbf24, centered)
   - 3px top border for emphasis

**Column Width Rules (Fixed, No Overlap):**
- Members column: **140px** (fixed width, text truncates with ellipsis if needed)
- Penalty columns: **110px each** (fixed width, prevents overlap)
- Total column: **100px** (fixed width, yellow background)
- All columns use `numberOfLines` to prevent text overflow
- Horizontal scroll enabled for many penalties

**Commit Count Display (same as Active Table):**
- Format: `TOTAL_COUNT (COUNT × MULTIPLIER, COUNT × MULTIPLIER, ...)`
- Examples:
  - `0` → zero commits
  - `5` → 5 commits all with 1x multiplier
  - `3 (1 × 2x, 1 × 4x)` → 3 total commits: 1 with 2x multiplier, 1 with 4x multiplier
  - `7 (2 × 2x, 1 × 3x, 1 × 4x)` → 7 total commits with breakdown
- Zero commits: show `0`
- All commits with 1x multiplier: show only total count
- Multiplier breakdown only shown when commits have multiplier > 1
- Separator: `, ` (comma + space)

**Penalty Amount Display (same as Active Table):**
- Hidden when both `amountSelf` and `amountOther` are zero
- **SELF** affect: shows `amountSelf` only (e.g., `0.25`)
- **OTHER** affect: shows `amountOther (Other)` (e.g., `0.5 (Other)`)
- **BOTH** affect: shows `amountSelf / amountOther (Other)` (e.g., `-3.5 / 0.5 (Other)`)
- **NONE** affect: no amount shown (both zero)
- Zero amounts omitted from display
- Small light blue text below penalty name in header

**Member Total Amount (right column, each row):**
- Shows final total for each member from `Session.totalAmounts[memberId]`
- Format: **€X.XX** (2 decimal places, green text #059669)
- Yellow background (#fef3c7) for visual emphasis
- Centered alignment

**Penalty Total Counts (footer row, NEW FEATURE):**
- **Each penalty column in footer shows total commits across all members**
- Calculated by summing all member commits for that penalty (preserves multiplier breakdown)
- Format: Same as member cells (e.g., `12 (3 × 2x, 2 × 4x)`)
- Light gray text (#e2e8f0) on dark background
- Centered alignment
- **No calculation logic changed**: uses existing `commitSummary` data aggregated per penalty

**Session Total Amount (footer, last column):**
- Sum of all member totals: `SUM(Session.totalAmounts)`
- Format: **€X.XX** (2 decimal places, gold text #fbbf24)
- Yellow background (#fef3c7) on dark footer
- Centered alignment

**Styling Details:**
- **Container**: Light gray background (#f0f4f8)
- **Table wrapper**: Rounded corners (12px), shadow for depth
- **Header**: Blue gradient (#3b82f6), white bold text, uppercase letters
- **Body rows**: White background, 1px borders, subtle hover effect potential
- **Footer**: Dark slate (#1e293b), 3px top border, bold text
- **Total column**: Consistent yellow tint (#fef3c7) throughout all rows
- **Typography**: System font, weights 600-700 for hierarchy
- **Borders**: Consistent 1px light gray (#cbd5e1), thicker borders for sections

**Sorting:**
- Members: alphabetical (A–Z) by name
- Penalties: alphabetical (A–Z) by name
- Sorting applied before rendering (no user interaction)

**Scrolling:**
- **Horizontal scroll**: Enabled for tables with many penalties
- **Vertical scroll**: Enabled for tables with many members (max height 500px)
- Member column and Total column scroll with content (sticky columns not yet implemented)

**No Interactive Controls:**
- Read-only view, no buttons or commit actions
- Static snapshot of session data
- No real-time updates

**Data Sources (No Logic Changes):**
- Commit counts: `getCommitSummaryWithMultipliers(sessionId)` → existing service
- Member totals: `Session.totalAmounts[memberId]` → existing field
- Penalty info: `getPenaltiesByClub(clubId)` → existing service
- Member info: `getMembersByClub(clubId)` → existing service

**Example Display:**

**Header:**
| Members | Pudel<br>0.25 | Fötzken<br>0.5 | Kranz<br>-3.5 / 0.5 (Other) | **Total** |

**Body (Members):**
| Player 1 | 5 (2 × 2x) | 3 | 1 | **€12.50** |
| Player 2 | 2 | 1 (1 × 3x) | 0 | **€5.75** |
| Player 3 | 0 | 4 (1 × 2x, 1 × 4x) | 2 | **€8.00** |

**Footer (Session Total):**
| **Session Total** | **7 (2 × 2x)** | **8 (1 × 2x, 1 × 3x, 1 × 4x)** | **3** | **€26.25** |

**Notes:**
- Yellow columns highlight totals for quick scanning
- Dark footer provides visual anchor
- Fixed column widths prevent text overlap
- Multiplier breakdown helps understand session dynamics
- All amounts in Euro (€) with 2 decimal places

### 2.2d `SessionAnalysisScreen`
**File:** `/src/screens/sessions/SessionAnalysisScreen.tsx`  
**Purpose:** Placeholder for future analytics/graphs; navigation is wired, content minimal.

### 2.2e `SessionVerificationScreen` (NEW)
**File:** `/src/screens/sessions/SessionVerificationScreen.tsx`  
**Purpose:** Display verification results for Session.totalAmounts correctness.

**Layout/Rules:**
- **Status Card (top):**
  - Green background if all totals match, red if any mismatches found
  - Status text: "✓ Verification Passed" or "✗ Verification Failed"
  - Subtext: "All member totals match calculated values" or "X member(s) have mismatches"

- **Member Totals Section:**
  - One card per session member
  - Header: Member name + badge ("OK" or "MISMATCH")
  - Row 1: "Stored Total: " + amount (green if match, black if mismatch)
  - Row 2: "Calculated Total: " + amount (green if match, black if mismatch)
  - Row 3 (if mismatch): "Difference: " + amount (red text)
  - Left border: green for match, red for mismatch
  - Left-aligned labels, right-aligned values

- **Back Button (bottom):**
  - Returns to SessionDetailsScreen

**Data Loading:**
- Calls `verifySessionTotals(sessionId, clubId)` on mount
- Displays loading spinner while verification runs
- Verification recalculates all totals from logs respecting join times and applies all commit rules
- Writes system=99 log with verification results
- Results persist in database

**Navigation:**
- Launched from SessionDetailsScreen via "Verify Totals" button
- Returns to SessionDetailsScreen via "Back" button


**Styling:**
- Sections: white cards with shadow, rounded corners, margin between
- Content: padding 16px
- Scrollable container for long sessions
- Responsive layout (adapts to screen size)

---

### 2.2b `SessionLiveScreenNew` (UPDATED WITH FINALIZATION)
**File:** `/src/screens/sessions/SessionLiveScreenNew.tsx`  
**Purpose:**  
Active session screen with commit grid, now includes session end integration and UI locking.

**NEW: End Session Integration:**

1. **End Session Button:**
   - Location: Footer actions bar (right side)
   - Label: "End Session" (changes to "Locked" when session finished)
   - Color: Blue (#007AFF), compact size
   - **Disabled when:** `session?.locked === true`
   - **On press:** Shows SessionEndModals component

2. **UI Locking (when session locked):**
   - **Commit buttons:** Disabled (checks `session?.locked` in handleCommit)
   - **Multiplier slider:** Disabled (checks `session?.locked` in handleMultiplierChange)
   - **End Session button:** Shows "Locked" text, disabled state (grey, opacity 0.6)
   - Visual feedback: Disabled buttons grey with reduced opacity

3. **SessionEndModals Integration:**
   - Component imported and rendered at bottom of SafeAreaView
   - State: `showEndModals` boolean controls visibility
   - Props passed:
     - sessionId, clubId
     - activeMembers (filtered from members by activePlayers)
     - penalties (all active penalties)
     - visible={showEndModals}
     - onClose={() => setShowEndModals(false)}
     - onFinalized={() => navigation.replace('SessionDetails', { sessionId, clubId, clubName })}

4. **Navigation After Finalization:**
   - **Replaces** current screen with SessionDetailsScreen (not push)
   - Prevents back navigation to locked session
   - Passes sessionId, clubId, clubName to details screen

**Updated handleEndSession:**
```typescript
const handleEndSession = useCallback(() => {
  if (session?.locked) {
    Alert.alert('Session Locked', 'This session has already been finalized.');
    return;
  }
  setShowEndModals(true);
}, [session]);
```

**Updated commit handling:**
```typescript
if (isProcessing.current || session?.locked) return;
```

**Styling Updates:**
- endSessionButton: backgroundColor #007AFF, padding compact
- endSessionButtonDisabled: backgroundColor #999, opacity 0.6
- Disabled state applied conditionally based on `session?.locked`

**Receives:**  
`sessionId`, `clubId`, `clubName`, `maxMultiplier`

**Uses configurable UI blocks** from layout config to determine order and display.

---

### 2.3 `SessionDetailsScreen`
**File:** `/ui/screens/SessionDetailsScreen.tsx`  
**Purpose:**  
Shows past/finished sessions with complete details and statistics.

**Displays:**
- **Session metadata:**
  - Date, start/end time, duration (formatted as "Xh Ym Zs" from playingTimeSeconds)
  - Club name
  - Participant list with avatars
  - Status (finished)
  - Lock indicator (sessions are immutable once finished)
- **All final amounts per member**
- **All winners**
- **Expandable detail blocks** (configurable via layout)
- **Session notes** (read-only, can be edited only if allowed in future)

**Interactions:**
- **Notes editing:** Currently not supported (finalization is permanent)
- **Session reopening:** Not allowed (locked sessions cannot be unlocked per B5.1)
- **Delete/archive:** Not specified (future feature)

**Receives:**  
`sessionId`

**Note:** Sessions cannot be reopened or modified once finalized (status="finished", locked=true).

---

## 3. Layout Blocks (Configurable UI Modules)

All blocks live in `/ui/blocks/` and follow the naming convention:  
`<BlockName>Block.tsx`

Each block must provide:
- `id` (string) – used in layout config  
- `render(props)`  
- minimal, stable props structure  

### 3.1 `TotalPenaltyAmountBlock`
**File:** `/ui/blocks/TotalPenaltyAmountBlock.tsx`  
**Purpose:**  
Displays the total penalty amount of the entire session.

**Props:**  
`{ total: number }`

---

### 3.2 `TopOffenderBlock`
**File:** `/ui/blocks/TopOffenderBlock.tsx`  
**Purpose:**  
Shows the player with the highest penalty count and their stats.

**Props:**  
`{ memberId: string, count: number }`

---

### 3.3 `PenaltyTimelineBlock`
**File:** `/ui/blocks/PenaltyTimelineBlock.tsx`  
**Purpose:**  
Visual timeline showing penalties across the session duration.

**Props:**  
`{ timeline: Array<{ minute: number, penalties: number }> }`

---

### 3.4 `MemberStatsBlock`
**File:** `/ui/blocks/MemberStatsBlock.tsx`  
**Purpose:**  
Shows a table or card list of all members and their individual penalty distributions.

**Props:**  
`{ members: Array<MemberStats> }`

---

### 3.5 `SessionMetadataBlock`
**File:** `/ui/blocks/SessionMetadataBlock.tsx`  
**Purpose:**  
Shows general session data:  
start, end, duration, club info.

**Props:**  
`{ start: string, end: string, duration: number }`

---

## 4. Reusable Components

These live under `/ui/components/`.

### 4.1 `Card`  
Generic container used by all blocks.

### 4.2 `Badge`  
Used for counts, labels, statuses.

### 4.3 `MemberAvatar`  
Displays the member’s profile image or initials.

### 4.4 `PenaltyCounter`  
Interactive element for live penalty input.

### 4.5 `DataTable`  
Used for MemberStats and session detail tables.

---

## 5. Layout Configuration Logic

### 5.1 File Location  
Layouts are stored under each club:

clubs/{clubId}/uiLayout/sessionSummary.json

bash
Code kopieren

### 5.2 Layout Config Object
Example:

```json
{
  "sessionSummary": [
    { "block": "TotalPenaltyAmountBlock", "enabled": true },
    { "block": "TopOffenderBlock", "enabled": true },
    { "block": "MemberStatsBlock", "enabled": false }
  ]
}
5.3 Rules
Only blocks listed in this guide may be referenced

Blocks missing from the layout must be ignored

Unknown blocks must cause a warning, not a crash

New blocks require a corresponding update in this file

6. Adding New UI Blocks (Procedure)
When a new UI block is required:

Create file under:
/ui/blocks/<NewBlockName>Block.tsx

Define:

id

props

render logic

Add block description to this UI-GUIDE.md

Add block to relevant layout group in the Implementation Guide if needed

7. Pending / Planned UI Blocks
This section tracks upcoming UI modules.

PenaltyHeatmapBlock – shows penalty distribution heatmap

TrendComparisonBlock – compare this session vs season average

PenaltyReasonBreakdownBlock – if we add penalty reasons in the future

8. Rules for Agents
Every AI must:

check this file before writing UI code

document every new block here

---

## Club Management Screens

### ClubListScreen
**File:** `/src/screens/clubs/ClubListScreen.tsx`  
**Purpose:**  
Displays a list of all clubs in the system.

**Features:**
- Lists all clubs with logo and creation date
- FAB (Floating Action Button) for creating new club
- Tap on club item → navigate to ClubEditScreen
- Empty state message when no clubs exist

**Navigation:**
- Part of ClubStack navigator
- Navigates to: ClubCreate, ClubEdit

---

### ClubCreateScreen
**File:** `/src/screens/clubs/ClubCreateScreen.tsx`  
**Purpose:**  
Create a new club.

**Fields:**
- Club name (required, text input)
- Logo picker (optional, image picker)
- Currency, Timezone, Time Format, Max Multiplier — same options and order as Edit Club
- Section heading/description added to clarify setup flow

**Buttons:**
- Save: validates and creates club, returns to list
- Cancel: returns to list without saving

**Validation:**
- Name field is required
- Shows error alert if name is empty

---

### ClubEditScreen
**File:** `/src/screens/clubs/ClubEditScreen.tsx`  
**Purpose:**  
Edit an existing club.

**Fields:**
- Club name (required, text input)
- Logo picker (optional, image picker)

**Buttons:**
- Save: validates and updates club, returns to list
- Delete: confirms deletion with alert, removes club, returns to list
- Cancel: returns to list without saving

**Validation:**
- Name field is required
- Shows error alert if name is empty
- Confirms before deletion

---

### ClubStackNavigator
**File:** `/src/navigation/ClubStackNavigator.tsx`  
**Purpose:**  
Navigation stack for Club Management screens.

**Routes:**
- ClubList (initial route)
- ClubCreate
- ClubEdit (requires clubId param)

**Integration:**
Should be added to main navigator under "Admin" section.

---

## Member Management Screens

### MemberListScreen
**File:** `/src/screens/members/MemberListScreen.tsx`  
**Purpose:**  
Displays a list of all members for a specific club.

**Features:**
- Lists all members with profile photo, name, and guest indicator
- Shows "(Guest)" badge for guest members
- Displays birthdate and join date
- Alphabetical sorting (A → Z)
- FAB (Floating Action Button) for creating new member
- Tap on member item → navigate to MemberEditScreen
- Empty state message when no members exist

**Props:**
- Requires `clubId` (passed via route params)

**Navigation:**
- Part of MemberStack navigator
- Navigates to: MemberCreate, MemberEdit

---

### MemberCreateScreen
**File:** `/src/screens/members/MemberCreateScreen.tsx`  
**Purpose:**  
Create a new member for a club.

**Fields:**
- Member name (required, text input)
- Guest toggle (boolean switch)
- Profile photo picker (optional, image picker)
- Birthdate (optional, text input - YYYY-MM-DD format)

**Auto-set Fields:**
- `joinedAt` = current timestamp (set automatically on save)

**Buttons:**
- Save: validates and creates member, returns to list
- Cancel: returns to list without saving

**Validation:**
- Name field is required
- Shows error alert if name is empty

---

### MemberEditScreen
**File:** `/src/screens/members/MemberEditScreen.tsx`  
**Purpose:**  
Edit an existing member.

**Fields:**
- Member name (required, text input)
- Guest toggle (boolean switch)
- Profile photo picker (optional, image picker)
- Birthdate (optional, text input - YYYY-MM-DD format)

**Buttons:**
- Save: validates and updates member, returns to list
- Delete: confirms deletion with alert, removes member, returns to list
- Cancel: returns to list without saving

**Validation:**
- Name field is required
- Shows error alert if name is empty
- Confirms before deletion

---

### MemberStackNavigator
**File:** `/src/navigation/MemberStackNavigator.tsx`  
**Purpose:**  
Navigation stack for Member Management screens.

**Routes:**
- MemberList (requires clubId param)
- MemberCreate (requires clubId param)
- MemberEdit (requires memberId param)

**Integration:**
Should be added to main navigator under "Admin" section or inside "Club Details" screen when available.

---

## Penalty Management Screens

### PenaltyListScreen
**File:** `/src/screens/penalties/PenaltyListScreen.tsx`  
**Purpose:**  
Displays a list of all penalties for a specific club.

**Features:**
- Lists all penalties with name, affect badge, active/inactive indicator, reward tag
- Shows description (truncated), amounts for SELF and OTHER
- Color-coded affect badges: SELF (blue), OTHER (orange), BOTH (green), NONE (gray)
- Displays "Inactive" badge for inactive penalties
- Shows "Title" badge for title penalties
- Shows "Reward" badge (gold) for reward-enabled penalties
- Alphabetical sorting (A → Z)
- FAB (Floating Action Button) for creating new penalty
- Tap on penalty item → navigate to PenaltyEditScreen
- Empty state message when no penalties exist

**Props:**
- Requires `clubId` (passed via route params)

**Navigation:**
- Part of PenaltyStack navigator
- Navigates to: PenaltyCreate, PenaltyEdit

---

### PenaltyCreateScreen
**File:** `/src/screens/penalties/PenaltyCreateScreen.tsx`  
**Purpose:**  
Create a new penalty for a club.

**Fields:**
- Penalty name (required, text input)
- Description (optional, multiline text input)
- Amount SELF (required, numeric input)
- Amount OTHER (required, numeric input)
- Affect (required, button group selector: SELF / OTHER / BOTH / NONE)
- Title penalty (boolean toggle with helper text)
- Active (boolean toggle, defaults to true)
- Reward enabled (boolean toggle)
- Reward value (optional numeric input, shown only if rewardEnabled = true)

**Buttons:**
- Save: validates and creates penalty, returns to list
- Cancel: returns to list without saving

**Validation:**
- Name is required (non-empty)
- Amount SELF must be numeric ≥ 0
- Amount OTHER must be numeric ≥ 0
- Affect must be one of: SELF, OTHER, BOTH, NONE
- Reward value (if rewardEnabled) must be numeric > 0

**Props:**
- Requires `clubId` (passed via route params)

**Navigation:**
- Part of PenaltyStack navigator
- Returns to PenaltyListScreen on save/cancel

---

### PenaltyEditScreen
**File:** `/src/screens/penalties/PenaltyEditScreen.tsx`  
**Purpose:**  
Edit or delete an existing penalty.

**Same fields as PenaltyCreateScreen** plus:
- Delete button (bottom, red, with confirmation dialog)
- Warning box (yellow background) shown if penalty is a title penalty:
  - Message: "This is a title penalty. Changes may affect active sessions."

**Delete Confirmation:**
- Title: "Delete [penalty name]?"
- Message: "This action cannot be undone. All session history will remain, but this penalty will no longer be available for new sessions."
- Buttons: "Delete" (red), "Cancel"

**Props:**
- Requires `penaltyId` (passed via route params)

**Navigation:**
- Part of PenaltyStack navigator
- Returns to PenaltyListScreen on save/delete/cancel

---

## 11. UI Interaction Specifications (Session-Related)

This section documents all UI interaction patterns and design decisions for session-related screens.

### 11.1 Commit Counter Interaction (SessionLiveScreen)

**Decision:** Tap-based increment/decrement buttons (Option C1.1)

**Layout:**
- Each member-penalty cell displays: `[−] [count] [+]`
- Minus button (−): 40x40 touchable area, left side
- Counter display: centered text showing current commit count (can be 0 or negative)
- Plus button (+): 40x40 touchable area, right side

**Behavior:**
- Tap **+** → calls `onCommit(memberId, penaltyId)` → writes system=8 log
- Tap **−** → calls `onUndo(memberId, penaltyId)` → writes system=9 log (or shows error if no commit to undo)
- Counter updates immediately after successful commit/undo
- Buttons disabled during commit processing (prevent double-tap)
- Negative counts allowed (from undos exceeding commits)

**Styling:**
- Plus button: green background, white "+" icon
- Minus button: red background, white "−" icon
- Counter: bold text, 16pt
- Disabled state: 50% opacity

---

### 11.2 Multiplier Selector (SessionLiveScreen)

**Decision:** Slider control (Option C2 - custom)

**Layout:**
- Horizontal slider component
- Label above slider: "Multiplier: X" (displays current value)
- Range: 1 to `Club.maxMultiplier` (default: 10)
- Step: 1 (integer values only)
- Positioned: Top section of SessionLiveScreen, below header

**Behavior:**
- User drags slider → value updates in real-time in label
- On release (onSlidingComplete):
  - If value changed: writes system=5 log
  - Updates `Session.multiplier` in database
  - Updates in-memory `currentMultiplier`
  - Does NOT affect previous commits
- All future commits use new multiplier value

**Styling:**
- Track: gray background
- Active track: blue
- Thumb: large circular handle (48x48 touchable area)
- Label: 18pt, bold

---

### 11.3 Session Timer Display (SessionLiveScreen)

**Decision:** HH:MM:SS format always (Option C3.1)

**Format:**
- Always show hours: `HH:MM:SS`
- Examples: `00:15:30`, `02:30:00`, `10:45:12`
- Leading zeros always included

**Behavior:**
- Updates every 1 second
- Calculation: `currentTime - Session.startTime`
- Displayed in header of SessionLiveScreen
- Does not pause or stop (runs continuously while session is active)

**Styling:**
- Monospace font for alignment
- 20pt, bold
- Icon: clock/timer icon to left of time

---

### 11.4 Title Resolution UI (SessionEndSummaryScreen)

**Decision:** Modal dialog with radio buttons (Option C4.1)

**When triggered:**
- After user presses "End Session"
- For each penalty with `isTitle=true` that has a tie in commit counts

**Modal structure:**
- **Title:** "Select winner for [penalty name]"
- **Content:**
  - List of tied members (2+ members with same highest commit count)
  - Each member row:
    - Avatar (left)
    - Name (center)
    - Commit count (right, in badge)
    - Radio button (far right)
- **Buttons:**
  - "Confirm" (enabled only when one member selected)
  - "Cancel" (closes modal, blocks finalization)

**Behavior:**
- User must select exactly one winner
- Tap on member row → selects radio button
- Tap "Confirm" → writes system=2 log, updates Session.winners, proceeds to next title or reward
- If user cancels → returns to SessionLiveScreen (does not finalize)

**Styling:**
- Modal: centered, 80% screen width, rounded corners
- Radio buttons: standard native component
- Confirm button: blue, prominent
- Cancel button: gray, secondary

---

### 11.5 Reward Value Input (SessionEndSummaryScreen)

**Decision:** Modal prompt per reward penalty (Option C5.1)

**When triggered:**
- After title resolution complete
- For each penalty with `rewardEnabled=true` AND `rewardValue=null`

**Modal structure:**
- **Title:** "Enter reward value for [penalty name]"
- **Content:**
  - Explanatory text: "This will be deducted from [winner name]'s total"
  - Number input field (numeric keyboard)
  - Live preview: "Current total: X → New total: Y" (updates as user types)
  - Helper text: "Reward is deducted from winner only, not from all players"
- **Buttons:**
  - "Confirm" (enabled only when valid number > 0 entered)
  - "Cancel" (blocks finalization)

**Behavior:**
- User enters reward value
- Live preview updates: `newTotal = currentTotal - rewardValue`
- Tap "Confirm" → writes system=6 log, deducts from Session.totalAmounts[winnerId], proceeds to next reward or finalization
- If user cancels → returns to SessionLiveScreen (does not finalize)

**Validation:**
- Must be numeric
- Must be > 0
- No upper limit (can create negative totals, which are allowed)

**Styling:**
- Modal: centered, 80% screen width
- Input field: large, prominent, numeric keyboard
- Live preview: bold text, color-coded (green if positive, red if negative result)
- Confirm button: blue
- Cancel button: gray

---

### 11.6 Crash Recovery Prompt

**Decision:** Auto-recovery modal on app launch (Option D1.1)

**When triggered:**
- On app launch, if any session has `status="active"`

**Modal structure:**
- **Title:** "Resume unfinished session?"
- **Content:**
  - Session details: club name, date, player count
  - Warning: "This session was interrupted. Would you like to resume where you left off?"
- **Buttons:**
  - "Resume" → reconstructs session state from SessionLog, opens SessionLiveScreen
  - "Discard" → marks session as viewable in history only, no ledger entries

**Behavior:**
- On "Resume":
  - Replays all SessionLog entries (system=8/9 for totals, system=5 for multiplier)
  - Restores SessionLiveScreen with recovered state
  - User can continue adding commits normally
- On "Discard":
  - Session remains in database for audit
  - Visible in SessionDetailsScreen
  - Cannot be resumed later

**Styling:**
- Modal: centered, prominent
- Resume button: blue, primary action
- Discard button: red, destructive action

---

## 12. Session Error Handling UI

### 12.1 Undo Without Commit (SessionLiveScreen)

**Scenario:** User taps minus button (−) but no matching system=8 commit exists for that member-penalty

**Decision:** Show alert (strict rejection, Option B2.1)

**Alert:**
- Title: "Cannot undo"
- Message: "No recent commit found for this penalty. You can only undo commits that were previously added."
- Button: "OK" (dismisses alert)

**No state change:** Session.totalAmounts and counters remain unchanged

---

### 12.2 Negative Totals Display

**Decision:** Allow and display negative amounts (Option D2.1)

**Display:**
- Negative amounts shown with minus sign prefix: "−15.50"
- Color-coded: red text for negative, black for positive
- Member row background: light red tint if total < 0

**Semantics:**
- Negative total = member is owed money or has overpaid
- Can occur from undos or manual corrections (future feature)
- Allowed in ledger calculations

---

### 12.3 Concurrent Sessions

**Decision:** Allow multiple concurrent sessions per club (Option D3.1)

**UI implications:**
- Session list must clearly show status: "Active" badge (green) for active sessions
- Tap on active session → resumes that session (opens SessionLiveScreen)
- Multiple "Active" badges possible
- Session list sorted by: Active first (by startTime desc), then Finished (by endTime desc)

---

## 13. Main Navigation Screens

These are the primary navigation screens accessible from the main app tab bar or drawer.

### 13.1 ClubsScreen (Tab: "Clubs")
**File:** `/src/screens/clubs/ClubsScreen.tsx`  
**Purpose:**  
Main landing screen showing all clubs. No tabs on home. Acts as the entry point to club management.

**Features:**
- Lists all clubs with logo, name, and member count
- Tap club → navigate to ClubDetailScreen (shows Members, Financials, Penalties for that club)
- FAB → navigate to ClubCreateScreen
- Empty state when no clubs exist

**Layout:**
- Card-based list
- Each card shows: logo (left), club name (center), member count badge (right)
- Creation date shown below name (gray text)
- Sorted alphabetically by name

**Navigation:**
- Uses existing ClubStackNavigator
- Entry point: shown on app launch, no top-level tabs

---

### 13.2 ClubDetailScreen (New)
**File:** `/src/screens/clubs/ClubDetailScreen.tsx`  
**Purpose:**  
Shows a single club’s dashboard with access to its Members, Financials, and Penalties. (More coming up in the future: Session and Statistics)

**Features:**
- Displays club logo, name, total members, and basic stats
- Main navigation buttons/cards:
    - Members → MemberStackNavigator for this club
    - Financials → FinancialsScreen for this club
    - Penalties → PenaltyStackNavigator for this club
- Optional summary cards: total penalties, outstanding balances, recent sessions


**Navigation:**
- Entry point from ClubsScreen (tap on a club)
- Each button navigates into the corresponding stack
- Back button returns to ClubsScreen

---

### 13.3 MembersScreen ("Members")
**File:** `/src/screens/members/MembersScreen.tsx`  
**Purpose:**  
Shows all members of the club

**Features:**
- Lists all members with photo, name, birthdate
- Shows guest badge for guest members
- Tap member → navigate to MemberEditScreen
- FAB → navigate to MemberCreateScreen
- Empty state when no members exist

**Layout:**
- List view with member cards
- Each card shows: photo (left), name, guest indicator
- Sorted alphabetically by name 


**Navigation:**
- Links to MemberStack navigator

**Notes:**
- This screen are now accessed only from ClubDetailScreen, not from main tab bar
- Club context (clubId) is always passed via route params
- All club-specific filters (dropdowns) removed; club is fixed
- FABs continue to create new entries for the current club
- Empty states and list sorting unchanged

---

## 14. Demo Loaders

Demo Loaders are special development/demonstration features that populate the app with pre-defined test data. They appear as green buttons in specific screens.

### 14.1 Purpose
- Quickly populate test data for development
- Demonstrate app functionality with realistic examples
- Onboard new users with sample club/members/penalties
- Avoid manual data entry during testing

### 14.2 Visual Design
All demo loader buttons share consistent styling:
- **Background:** #4CAF50 (Material Design Green 500)
- **Text color:** #FFFFFF (white)
- **Font weight:** 600 (semi-bold)
- **Border radius:** 8px
- **Padding:** Horizontal 16-20px, Vertical 10px
- **Font size:** 13-14px

**Distinguishing from other buttons:**
- Primary actions (FAB, create): Blue (#007AFF)
- Filter toggles: Blue when active, gray when inactive
- Demo loaders: Always green
- Delete/danger: Red (#FF3B30)

### 14.3 ClubsScreen Demo Loader

**Button Label:** "Load Demo-Club"

**Location:** Header container above club list
- White background (#FFFFFF)
- Centered horizontally
- 12px padding all sides
- 1px bottom border (#E0E0E0)

**Behavior:**
1. Check if "Berka Kingpins" club exists
2. If exists: Navigate to that club's ClubDetailScreen
3. If not exists: Create club with:
   - name: "Berka Kingpins"
   - maxMultiplier: 10
   - Auto-generated UUID, timestamps
4. Reload club list
5. Navigate to newly created club

**User Feedback:**
- Loading state: Button disabled, spinner shown
- Success: Immediate navigation to club
- Error: Alert dialog with error message

**File:** `src/screens/clubs/ClubsScreen.tsx`
**Function:** `handleLoadDemoClub()`

---

### 14.4 MemberListScreen Demo Loader

**Button Label:** "Load Demo-Members"

**Location:** Header container above member list
- White background (#FFFFFF)
- Centered horizontally
- 12px padding all sides
- 1px bottom border (#E0E0E0)

**Behavior:**
Creates 3 members for current club:
1. **Player 1**
   - name: "Player 1"
   - isGuest: false
   - clubId: current club
   - Auto-generated UUID, joinedAt timestamp

2. **Player 2**
   - name: "Player 2"
   - isGuest: false
   - clubId: current club
   - Auto-generated UUID, joinedAt timestamp

3. **Player 3**
   - name: "Player 3"
   - isGuest: true (guest member)
   - clubId: current club
   - Auto-generated UUID, joinedAt timestamp

**User Feedback:**
- Loading state: Button disabled, list shows loading spinner
- Success: Member list automatically refreshes and shows new members
- Error: Alert dialog with error message

**File:** `src/screens/members/MemberListScreen.tsx`
**Function:** `handleLoadDemoMembers()`

---

### 14.5 PenaltiesScreen Demo Loader

**Button Label:** "Load Demo-Penalties"

**Location:** Filter container (alongside "Show Active Only" toggle)
- White background (#FFFFFF)
- Right side of flex row
- 12px padding all sides
- 1px bottom border (#E0E0E0)
- Space-around alignment with filter toggle

**Layout Change:**
Filter container changed from single centered item to horizontal row:
```
[Show Active Only]    [Load Demo-Penalties]
     (blue)                  (green)
```

**Behavior:**
Creates 4 penalties for current club:

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
   - amount: -3.5 (negative self amount)
   - amountOther: 0.5
   - isTitle: true
   - active: true
   - rewardEnabled: false

**Special Notes:**
- **Kranz** demonstrates negative SELF amount (reward scenario)
- **Kegelkönig-Pkt.** demonstrates NONE affect with reward enabled
- All penalties are title penalties (isTitle=true)
- All penalties are active by default
- Names are German bowling club terminology

**User Feedback:**
- Loading state: Button disabled, list shows loading spinner
- Success: Penalty list automatically refreshes and shows new penalties
- Error: Alert dialog with error message

**File:** `src/screens/penalties/PenaltiesScreen.tsx`
**Function:** `handleLoadDemoPenalties()`

---

### 14.6 Demo Loader Best Practices

**When to use:**
- First-time app setup
- Development testing
- User demonstrations
- Training sessions

**When NOT to use:**
- Production environments with real data
- After users have created their own data (may cause confusion)

**Future Enhancements:**
- Add confirmation dialog before creating demo data
- Option to clear demo data
- Multiple demo scenarios (beginner, advanced, etc.)
- Localized demo data for different regions

---


### 13.4 FinancialsScreen ("Financials")
**File:** `/src/screens/financials/FinancialsScreen.tsx`  
**Purpose:**  
Shows financial overview for all members of the club, sorted by outstanding amount.

**Features:**
- Lists all members with outstanding balances (ledger-based calculation)
- Each row shows: member avatar + name + outstanding amount
- Color-coded amounts: **red for debt (positive outstanding, displayed as `-€amount`)**, **green for credit (negative outstanding, displayed as `Credit €amount`)**, gray for zero
- Sorting options: 
  - Outstanding Descending (highest debt first)
  - Outstanding Ascending (lowest debt first)
  - Alphabetical (A–Z)
- Tap member → navigate to MemberLedgerScreen (shows all ledger entries with timestamps)
- Summary card at top showing:
  - **Total Outstanding:** SUM(all member outstanding balances), red for net debt, green for net credit
  - **Total Collected:** SUM of `member.paidPenaltyAmount` across all club members (increments only on **positive payments**; negative payments do **not** change this)
  - Members with Balance: count of members with non-zero outstanding

**Layout:**
- Summary card (top):
  - Total Outstanding: €X.XX (or "Credit €X.XX" if negative)
  - Total Collected: €Y.YY
  - (Members with Balance label may be hidden)
- Member list below summary:
  - Each row: avatar (left, default `dummy/default-member.png` if no photo), name (center), outstanding (right, color-coded)
- Pull-to-refresh to reload data

**Data Source:**
- Queries Ledger table: `SUM(amount) WHERE memberId = X GROUP BY memberId` (includes sessions, payments, adjustments, refunds)
- Outstanding semantics: positive = debt, negative = credit
- **Ledger preserves timestamps for audit trail** (session timestamp = session endTime, payment timestamp = payment time)

**Empty State:**
- "No financial data yet. Complete a session to see member balances."

**Navigation:**
- Tapping member opens MemberLedgerScreen

**Notes:**
- This screen accessed only from ClubDetailScreen, not from main tab bar
- Club context (clubId) always passed via route params
- FABs continue to create new entries for the current club
- Avatar fallback: `require('../../../assets/images/dummy/default-member.png')`

---

### 13.4a MemberLedgerScreen
**File:** `/src/screens/financials/MemberLedgerScreen.tsx`  
**Purpose:**  
Displays complete ledger history for a single member with manual payment entry form.

**Features:**
- Shows member avatar + name in header with total outstanding (debt red `-€amount` or credit green `Credit €amount`)
- Chronological list of all ledger entries (newest first)
- **Ledger entries preserve timestamps for audit trail** (session timestamp = session endTime, payment timestamp = payment time)
- Manual payment entry form at top (full-width modal)
- Session entries link to SessionDetailsScreen
- European date format (DD.MM.YYYY)
- Time format follows club.timeFormat setting

**Header:**
- Member avatar (default `dummy/default-member.png` if no photo)
- Member name (center)
- Total Outstanding: formatted per debt/credit rules (red `-€amount` for debt, green `Credit €amount` for credit)

**Manual Payment Entry Form:**
- **Title:** "Record Payment"
- **Help text:** "Positive reduces debt (shown green), Negative adds debt (shown red)"
- **Fields:**
  - Amount: Numeric input (positive or negative)
  - Note: Optional text input
  - Add button: Creates ledger entry
- **Behavior:**
  - Positive input → stored as negative amount (reduces outstanding, shown green as `€amount` in list)
  - Negative input → stored as positive amount (adds debt, shown red as `€amount` in list)
  - Creates type='payment' ledger entry with timestamp = current time
  - **paidPenaltyAmount:** Only **positive inputs** increment `member.paidPenaltyAmount` by the entered amount; **negative inputs do not change** `paidPenaltyAmount`.
  - Refreshes list after successful entry
- **Validation:**
  - Amount must be non-zero number
  - Shows error alert if invalid
- **Form Width:** Full-width modal or full-width input section (not constrained)

**Ledger Entry Display:**
Each entry shows: timestamp (DD.MM.YYYY HH:MM), type (session/payment), name, amount (color-coded), action (tap → SessionDetails if session)

| Entry Type | Display Format | Color | Amount Format |
|---|---|---|---|
| Session (positive ledger) | Session DD.MM.YYYY | Red (Debt) | `-€X.XX` |
| Session (negative ledger) | Session DD.MM.YYYY | Green (Credit) | `Credit €X.XX` |
| Payment (reduces debt) | Note or "Payment" | Green | `€X.XX` |
| Payment (adds debt) | Note or "Payment" | Red | `€X.XX` |

**Timestamp Preservation:**
- **Session entries:** timestamp = session.endTime (when session closed)
- **Payment entries:** timestamp = payment created time (NOW)
- **Display:** All timestamps shown as DD.MM.YYYY HH:MM using club.timeFormat

**Amount Display Rules:**
- Debt (positive ledger): red `-€X.XX`
- Credit (negative ledger): green `Credit €X.XX`
- Payments reducing debt (negative stored): green `€X.XX`
- Payments adding debt (positive stored): red `€X.XX`
- Font: 18pt, bold

**Date/Time Formatting:**
- Date: DD.MM.YYYY (European format)
- Time: HH:MM or h:mm a (based on club.timeFormat setting)
- Example: "10.12.2025 18:30" or "10.12.2025 6:30 PM"

**Empty State:**
- "No ledger entries yet"
- "Entries will appear here after sessions or manual payments"

**Navigation:**
- Entry point: Tap member in FinancialsScreen
- Session entries: Tap to navigate to SessionDetails with sessionId
- Back button: Returns to FinancialsScreen

**Data Loading:**
- Loads member data (name, photo)
- Loads club settings (timeFormat)
- Loads all ledger entries for member (queries by memberId, ordered by timestamp DESC)
- Loads session names for session-type entries
- Calculates outstanding as SUM(ledger.amount WHERE memberId = X)

**Known TODO:**
- Update `paidPenaltyAmount` on payment record creation (currently not updated; pending penalty module integration)

---

### 13.5 PenaltiesScreen ("Penalties")
**File:** `/src/screens/penalties/PenaltiesScreen.tsx`  
**Purpose:**  
Shows all penalties of the club for quick overview and management.

**Features:**
- Lists all penalties of the club
- Each penalty shows: name, affect badge, active/inactive status, title badge
- Filter by active/inactive toggle
- Tap penalty → navigate to PenaltyEditScreen
- FAB → navigate to PenaltyCreateScreen
- Empty state when no penalties exist

**Layout:**
- Section headers for the club
- Penalty cards within each section
- Each card shows:
  - Penalty name (bold)
  - Affect badge (SELF/OTHER/BOTH/NONE, color-coded)
  - Active/Inactive badge
  - Title badge (if isTitle=true)
  - Reward badge (if rewardEnabled=true)
  - Amount info: "Self: €X | Other: €Y"

**Filter Controls:**
- Active toggle: "Show Active Only" (default: true)

**Sorting:**
- alphabetical by name
- Inactive penalties shown at bottom (if filter allows)

**Navigation:**
- Links to PenaltyStack navigator

**Notes:**
- This screen are now accessed only from ClubDetailScreen, not from main tab bar
- Club context (clubId) is always passed via route params
- FABs continue to create new entries for the current club

---

## 14. Navigation Structure

### 14.1 Main App Navigator (Club-First Flow)

**Type:** Stack Navigator (no bottom tabs on home)

Flow:

1. ClubsScreen – main landing screen, lists all clubs
  - Tap club card → ClubDetailScreen
  - FAB → ClubCreateScreen

2. ClubDetailScreen – club dashboard
  - Shows club info, stats
  - Main buttons:
        1. Members → MemberStackNavigator (club-scoped)
        2. Financials → FinancialsScreen (club-scoped)
        3. Penalties → PenaltyStackNavigator (club-scoped)

3. MemberStackNavigator – for managing members of current club
  - MemberListScreen
  - MemberCreateScreen
  - MemberEditScreen

4. PenaltyStackNavigator – for managing penalties of current club
  - PenaltyListScreen
  - PenaltyCreateScreen
  - PenaltyEditScreen

5. FinancialsScreen – overview for current club only
  - MemberLedgerScreen (future)

**Navigation Notes:**
- All sub-screens receive clubId via route params from ClubDetailScreen
- FABs automatically create entries scoped to current club
- No global tabs; navigation is stack-based and context-aware

**Icons (Recommendations):**
- Clubs: group/people icon
- Members: person icon
- Sessions: play/timer icon
- Financials: money/wallet icon
- Penalties: warning/flag icon

### 14.2 Navigation Rules

**From ClubsScreen:**
- Tap club card → navigate to ClubDetailScreen
- FAB → ClubCreateScreen

**From ClubDetailScreen:**
- Tap Members → MemberStackNavigator for this club
- Tap Financials → FinancialsScreen for this club
- Tap Penalties → PenaltyStackNavigator for this club

**From MemberStackNavigator:**
- Tap member → MemberEditScreen
- FAB → MemberCreateScreen (automatically scoped to current club)

**From FinancialsScreen:**
- Tap member row → MemberLedgerScreen
- No FAB (ledger is read-only from this view)

**From PenaltyStackNavigator:**
- Tap penalty → PenaltyEditScreen
- FAB → PenaltyCreateScreen (automatically scoped to current club)

### 14.3 Club Selection Modal (Reusable Component)

**File:** `/src/components/ClubSelectorModal.tsx`  
**Purpose:**  
Reusable modal for selecting a club when creating members or penalties from the main tabs.

**Props:**
- `visible: boolean`
- `onSelect: (clubId: string) => void`
- `onCancel: () => void`

**Layout:**
- Modal overlay with centered dialog
- Title: "Select Club"
- List of clubs (with logos and names)
- Tap club → calls onSelect(clubId), closes modal
- Cancel button at bottom

**Usage:**
- MembersScreen: before navigating to MemberCreate
- PenaltiesScreen: before navigating to PenaltyCreate

---
- Cancel: returns to list without saving

**Validation:**
- Name field is required
- Amount SELF must be a valid number
- Amount OTHER must be a valid number
- Affect must be one of: SELF, OTHER, BOTH, NONE
- Shows error alert if validation fails

---

### PenaltyEditScreen
**File:** `/src/screens/penalties/PenaltyEditScreen.tsx`  
**Purpose:**  
Edit an existing penalty.

**Fields:**
- Penalty name (required, text input)
- Description (optional, multiline text input)
- Amount SELF (required, numeric input)
- Amount OTHER (required, numeric input)
- Affect (required, button group selector: SELF / OTHER / BOTH / NONE)
- Title penalty (boolean toggle with helper text)
- Active (boolean toggle)
- Reward enabled (boolean toggle)
- Reward value (optional numeric input, shown only if rewardEnabled = true)

**Special UI Elements:**
- Warning box displayed when isTitle = true:
  "⚠️ Title penalties require selecting exactly one winner at session end."

**Buttons:**
- Save: validates and updates penalty, returns to list
- Delete: confirms deletion with alert, removes penalty, returns to list
- Cancel: returns to list without saving

**Validation:**
- Name field is required
- Amount SELF must be a valid number
- Amount OTHER must be a valid number
- Affect must be one of: SELF, OTHER, BOTH, NONE
- Shows error alert if validation fails
- Confirms before deletion

---

### PenaltyStackNavigator
**File:** `/src/navigation/PenaltyStackNavigator.tsx`  
**Purpose:**  
Navigation stack for Penalty Management screens.

**Routes:**
- PenaltyList (requires clubId param)
- PenaltyCreate (requires clubId param)
- PenaltyEdit (requires penaltyId param)

**Integration:**
Should be added to main navigator under "Admin" section alongside Club and Member management.

