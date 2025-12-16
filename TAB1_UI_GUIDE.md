# Tab 1 — All-Time Statistics — UI/UX Guide

## Overview

Tab 1 displays cumulative club and member statistics across all sessions. It's divided into two sub-tabs: **Club-Level** and **Member-Level**, each with filters, sorting, and CSV export.

**Location:** Club Detail → Statistics → Tab 1: "All-Time"

**Navigation:**
- StatisticsScreen (parent) contains Tab Navigator
- AllTimeStatisticsTab component renders content
- Two sub-tabs controlled by button selection at top

---

## Club-Level Tab

### Layout Structure

```
┌─────────────────────────────────────────┐
│  [Club Level Button]  [Member Level]    │  ← Tab Selector
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Summary Card ──────────────────┐   │
│  │ Total Amount:        €1,234.56  │   │
│  │ Total Playtime:      12h 30m    │   │
│  │ Total Commits:       156        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Penalty Filter ─────────────────┐  │
│  │ [Yellow Card]  [Red Card] [...]  │  │
│  │ Selected chips in blue, others gray │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Commits by Penalty Table ──────┐   │
│  │ Penalty Name        Count  📝 ⬆️  │   │  ← Sort controls
│  │ ─────────────────────────────    │   │
│  │ Yellow Card           42         │   │
│  │ Red Card              28         │   │
│  │ Blue Card             15         │   │
│  │                                  │   │
│  │             [📥 Export as CSV]   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Top Winners by Penalty ────────┐   │
│  │ Yellow Card                      │   │
│  │ #1 John Doe (42 commits)         │   │
│  │ #2 Jane Smith (38 commits)       │   │
│  │ #3 Bob Johnson (36 commits)      │   │
│  │                                  │   │
│  │ Red Card                         │   │
│  │ #1 Alice Brown (28 commits)      │   │
│  │ #2 Charlie Davis (22 commits)    │   │
│  │ #3 Eve Wilson (18 commits)       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Commit Matrix ──────────────────┐  │
│  │ Member      │ YC │ RC │ BC │ ...│  │  ← Horizontally scrollable
│  │ ─────────────────────────────────  │
│  │ John Doe    │42  │ 8  │ 5  │ ...│  │
│  │ Jane Smith  │38  │12  │ 3  │ ...│  │
│  │ Bob Johnson │36  │ 8  │ 2  │ ...│  │
│  │ ...         │... │... │... │ ...│  │
│  │                                  │  │
│  │             [📥 Export as CSV]   │  │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Summary Card

**Style:**
- White background
- Blue left border (4px)
- Rounded corners (12px)
- Padding: 16px
- Margin bottom: 12px

**Content:**
- Rows separated by thin gray dividers
- Each row: label (left) + value (right, bold)
- Values include currency (€, $, etc.) from Club.currency
- Playtime formatted as human-readable (e.g., "2h 30m")

**Font:**
- Label: 14px, gray (#64748b), weight 500
- Value: 14px, dark (#1e293b), weight 700

---

### Penalty Filter Section

**Style:**
- Margin bottom: 16px
- Label: "Filter by Penalties:" (13px, gray #475569, weight 600)

**Chips:**
- Display: Flex row, wrap
- Gap: 8px
- Each chip: 
  - Padding: 12px horizontal, 6px vertical
  - Border radius: 16px
  - Border: 1px
  - Default: light gray background (#e2e8f0), gray text (#475569), gray border (#cbd5e1)
  - Selected: blue background (#3b82f6), white text, blue border

**Behavior:**
- Tap to toggle inclusion/exclusion
- Filters all tables below
- Multiple selections allowed
- Empty filter = show all

---

### Commits by Penalty Table

**Style:**
- White background, rounded corners (12px)
- Margin bottom: 16px

**Header:**
- Row with divider below
- Left: "Commits by Penalty" (15px, bold, dark #1e293b)
- Right: Sort controls
  - Button 1: 📝 (name) / 📊 (count) — toggles sort column
  - Button 2: ⬆️ (ascending) / ⬇️ (descending) — toggles sort order
  - Font: 16px

**Data Rows:**
- Flex row: penalty name (flex 1) | commit count (right-aligned, 40px min, bold)
- Padding: 16px horizontal, 12px vertical
- Border-bottom: 1px light gray (#f1f5f9)
- Font: 14px dark (#1e293b), count in blue (#3b82f6) weight 700

**Sortable:**
- Default: by count descending
- Click 📝 to sort by name
- Click 📊 to sort by count
- Click ⬆️/⬇️ to toggle order

**Filterable:**
- Rows filtered by `selectedPenalties` set
- Hidden rows excluded from display

**Export:**
- Button: "📥 Export as CSV" (14px, white, on blue background #3b82f6)
- Padding: 16px, margin: 12px
- Rounded corners: 8px
- Calls `handleExportClubStats()`

---

### Top Winners by Penalty Section

**Style:**
- White background, rounded corners (12px)
- Margin bottom: 16px

**Header:**
- "Top Winners by Penalty" (15px, bold, dark)
- Padding: 16px, border-bottom: 1px light gray

**Per Penalty Block:**
- Penalty name header (14px, bold, dark)
- 3 winner rows:
  - Format: `#{rank} {memberName} ({commitCount} commits)`
  - Font: 13px dark, with rank in blue (#3b82f6), count in gray (#64748b)
  - Padding: 6px vertical, 12px left padding
- Padding: 12px bottom between penalties

**Display Logic:**
- Only show penalties with at least 1 commit
- Top 3 members per penalty
- If fewer than 3: show available
- Sorted descending by commit count

---

### Commit Matrix Grid

**Style:**
- White background, rounded corners (12px)
- Margin bottom: 16px
- Horizontal scroll (penalty columns may exceed screen width)

**Header:**
- "Commit Matrix (Member × Penalty)" (15px, bold)
- Padding: 16px, border-bottom: 1px light gray

**Layout:**
- Flex row (horizontal scroll)
- Fixed left column: member names (width: 100px, padding-right: 8px)
- Flex: penalty columns
- Each cell: 
  - Minimum height: 32px
  - Padding: 4px
  - Border: 1px #e2e8f0
  - Content: centered, bold, dark text
  - Background: green (#d1fae5) if count > 0, gray (#f3f4f6) if 0
  - Text: "—" if 0, otherwise commit count

**Text:**
- Member name: 12px, weight 600, dark
- Cell content: 12px, weight 600, dark

**Features:**
- Scrollable horizontally
- Shows all members × all penalties
- Color-coded for easy scanning
- Filterable by member/penalty selections

**Export:**
- Button at bottom: "📥 Export as CSV"

---

## Member-Level Tab

### Layout Structure

```
┌─────────────────────────────────────────┐
│  [Club Level]  [Member Level Button]    │  ← Tab Selector
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Member Filter ──────────────────┐  │
│  │ [John Doe]  [Jane Smith] [...]   │  │
│  │ Selected chips in blue, others gray │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Sort Controls ───────────────────┐ │
│  │ [Amount]  [Playtime]  [Attendance]│ │
│  │ [Name]                            │ │
│  │ Active: blue, shows ⬆️ or ⬇️     │ │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Member Cards (FlatList) ────────┐  │
│  │                                  │  │
│  │ ┌─ John Doe ──────────────────┐ │  │
│  │ │ Total Amount:     €234.50    │ │  │
│  │ │ Playtime:         5h 30m     │ │  │
│  │ │ Attendance:       12 sessions│ │  │
│  │ │                   (85.5%)    │ │  │
│  │ └──────────────────────────────┘ │  │
│  │                                  │  │
│  │ ┌─ Jane Smith ─────────────────┐ │  │
│  │ │ Total Amount:     €189.75    │ │  │
│  │ │ Playtime:         4h 15m     │ │  │
│  │ │ Attendance:       11 sessions│ │  │
│  │ │                   (72.3%)    │ │  │
│  │ └──────────────────────────────┘ │  │
│  │                                  │  │
│  │ ... (more members)               │  │
│  │                                  │  │
│  │             [📥 Export as CSV]   │  │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Member Filter Section

**Style:**
- Same as club-level filter
- Margin bottom: 16px
- Label: "Filter by Members:"

**Chips:**
- Flex row, wrap
- Gap: 8px
- Selected = blue, not selected = gray

**Behavior:**
- Tap to toggle
- Filters member cards
- Empty filter = show all members

---

### Sort Controls Section

**Style:**
- Margin bottom: 16px
- Label: "Sort By:" (13px, gray #475569, weight 600)

**Buttons:**
- Flex row, wrap
- Gap: 8px
- Each button:
  - Padding: 12px horizontal, 6px vertical
  - Border radius: 6px
  - Border: 1px
  - Default: light gray background (#e2e8f0), gray text (#475569)
  - Active: blue background (#3b82f6), white text, blue border
  - Font: 12px, weight 500

**Buttons:**
- Amount
- Playtime
- Attendance
- Name

**Behavior:**
- Click active button to toggle sort order (asc ↔ desc)
- Click inactive button to switch sort column (and reset to descending)
- Active button shows: `{label} {⬆️ or ⬇️}`
- Sorts member cards below

---

### Member Statistics Cards

**Container:**
- FlatList, scrollable
- Margin bottom: 16px

**Card Style:**
- White background
- Padding: 16px horizontal, 12px vertical
- Border-bottom: 1px light gray (#f1f5f9)

**Header:**
- Member name (15px, bold, dark #1e293b)
- Margin bottom: 8px

**Stats Row:**
- Flex row: label (flex 1) | value (right)
- Padding: 4px vertical
- Label: 13px, gray (#64748b)
- Value: 13px, dark (#1e293b), weight 600
- Format: `Label: {value}`
  - "Total Amount: €234.50"
  - "Playtime: 5h 30m"
  - "Attendance: 12 sessions (85%)"

**Gap between cards:**
- Row divider (1px light gray)

**Sorting:**
- Default: by amount descending
- Affected by `playerSortKey` and `playerSortOrder` state
- FlatList re-sorts when sort controls are clicked

---

### Export Button

**Style:**
- Same as club-level
- Button: "📥 Export as CSV"
- Padding: 16px, margin: 16px
- Rounded corners: 8px
- Blue background (#3b82f6), white text
- Font: 14px, weight 700

**Behavior:**
- Calls `handleExportMemberStats()`
- Generates CSV with currently visible members (filtered/sorted)

---

## Global Styling

### Colors
- Primary blue: #3b82f6
- Dark text: #1e293b
- Gray text: #64748b, #475569
- Light gray background: #f0f4f8 (page), #e2e8f0 (chips), #f3f4f6 (matrix cells)
- Dividers: #f1f5f9, #e2e8f0
- Green cells (matrix): #d1fae5
- White: #ffffff

### Typography
- Headers: 15px, weight 700
- Labels: 13px, weight 600 or 500
- Body: 13px, weight 500 or 400
- Values: 13-14px, weight 600-700

### Spacing
- Page padding: 12px
- Section margin-bottom: 12-16px
- Row padding: 12px vertical, 16px horizontal
- Chip gap: 8px
- Text gap: 4px vertical, 8px horizontal

### Rounded Corners
- Cards/sections: 12px
- Chips/buttons: 6-16px
- Buttons: 8px

### Borders
- Dividers: 1px solid light gray
- Sections: 1px solid gray, border-bottom
- Chips/buttons: 1px solid gray/blue (depending on state)

---

## Interactions & Animations

### Filter Chips
- Tap: Toggle selection
- Visual feedback: Color change (gray → blue)
- Immediate effect: Tables/cards update

### Sort Buttons
- Tap: Switch sort column or toggle order
- Visual feedback: Color change (gray → blue) and icon update
- Immediate effect: Cards re-sort

### Export Button
- Tap: Generate CSV
- Loading state: Optional spinner (not shown in current design)
- Success: Share sheet appears; user can save or email

### Table/Card Scrolling
- Smooth scroll (FlatList)
- Horizontal scroll for matrix
- No snap behavior

---

## Responsive Behavior

### Landscape Mode
- All layouts remain responsive
- Fixed member column in matrix still visible
- Cards stack vertically

### Tablet
- Same layout, scaled up
- Matrix may have more penalty columns visible without scroll
- Sections remain full-width with padding

---

## Accessibility

### Text Contrast
- All text meets WCAG AA (4.5:1 minimum)

### Touch Targets
- Chips: min 44px (tap area)
- Sort buttons: min 44px
- Card rows: clickable area (not implemented, for future)

### Semantic HTML
- Use `<Text>` components for all text
- Use `<TouchableOpacity>` for all interactive elements
- Use `<View>` for sections/containers
- Use `<FlatList>` for scrollable lists

### Screen Reader
- Tab names announced
- Button labels clear ("Filter by Penalties", "Sort By", etc.)
- Card structure clear with headers and rows
