# Installation Prep Date Range Filter - Implementation Notes

## Summary
- Home page now loads without S3 usage card (moved to Storage Settings)
- InstallationPrep.tsx rewritten with 4 filter modes: month, week, day, custom
- Backend API (installation.list) now accepts startDate/endDate (YYYY-MM-DD format)
- getInstallations in db.ts handles date range with Asia/Bangkok timezone (+07:00)
- URL sync implemented for all filter modes
- Quick filters: วันนี้, สัปดาห์นี้, สัปดาห์หน้า (highlighted)
- Equipment summary updates based on filtered results
- Badge shows count of filtered installations
- Thai Buddhist year (พ.ศ.) displayed in UI, API uses Gregorian (ค.ศ.)

## Files Modified
- server/routers.ts: Added startDate/endDate to installation.list input
- server/db.ts: Added date range filter logic to getInstallations
- client/src/pages/InstallationPrep.tsx: Complete rewrite with filter modes
- client/src/pages/Home.tsx: Removed S3 usage card
- client/src/pages/StorageSettings.tsx: New page with S3 usage card

## Testing Needed
- Monthly filter still works as before
- Weekly filter shows correct 7-day range
- "สัปดาห์หน้า" button works correctly
- Badge count matches filtered results
- Equipment summary recalculates per filter
- URL persists filter state on refresh
