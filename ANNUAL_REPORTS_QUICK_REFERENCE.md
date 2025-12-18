# Annual Reports Feature - Quick Reference

## User Features

### Year Selection
- Click year button to select any year from current year back to 10 years
- Selected year highlighted in blue
- All buttons disabled during export

### Four Export Types
1. **📥 Penalty Analysis** — Shows commit counts per penalty for selected year
2. **🏆 Top Winners** — Shows which members got each penalty most in selected year
3. **👥 Member Statistics** — Shows each member's stats (commits, sessions, amounts) for year
4. **📊 All Logs** — Complete raw logs (CSV + JSON) for selected year

### File Sharing
- After export: "Share" button opens system share dialog
- OR "View Location" to see file path
- Files automatically dated with YYYY-MM-DD format

## Developer Quick Reference

### File Locations
- **UI Component**: `src/screens/statistics/GlobalExportsTab.tsx` (lines 552-650)
- **Service Layer**: `src/services/globalExportsService.ts` (year filtering in SQL)
- **State Management**: `src/screens/statistics/GlobalExportsTab.tsx` (line 64)

### How to Add New Years
Edit `getAvailableYears()` in GlobalExportsTab.tsx (line 29):
```typescript
// Currently: current year - 10 years
// Change from 11 to 21 for current year - 20 years:
return Array.from({ length: 21 }, (_, i) => current - i);
```

### SQL Year Filtering Pattern
All export functions use this pattern:
```typescript
if (year) {
  query += ` AND strftime('%Y', timestamp) = ?`;
  params.push(year.toString());
}
```

### Testing a Year Export
1. Select year (e.g., 2024)
2. Tap "Export Penalty Analysis (2024)"
3. Verify filename includes `_2024`
4. Check data only includes sessions from 2024
5. Compare with Tab 1 statistics for same year

## File Naming

- All-Time: `penalty-analysis-[clubId]-[date].csv`
- Annual: Files include year automatically in handlers

## Error Scenarios

| Scenario | User Sees |
|----------|-----------|
| No data for year | Alert: "No data available for year 2024" |
| File system error | Alert with error message |
| Sharing unavailable | File location alert with path |
| Export in progress | All buttons disabled + loading spinner |

## Dependencies
- expo-sharing (already installed)
- expo-file-system (already installed)
- No new npm packages needed

## TypeScript Status
✅ 0 errors in GlobalExportsTab.tsx and globalExportsService.ts
