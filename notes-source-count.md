# Source Customer Count Investigation

## Findings
- The SourceManagement page loads correctly
- The backend `getSourcesWithStats()` already has a SQL subquery to count customers: `(SELECT COUNT(*) FROM customers WHERE customers.source = sources.name)`
- The frontend already uses `source.customerCount` to display the count
- The TypeScript errors about `listWithStats` and `listGroups` are **stale LSP errors** - actual `tsc --noEmit` passes with 0 errors
- The page IS rendering and working correctly in the browser

## Root Cause of "0" counts
Looking at the screenshot, the customer counts ARE showing as "👥 0" for all sources in the user's screenshot. But in my test, the page is rendering correctly with the kanban view.

The issue might be that the SQL query matches `customers.source = sources.name` but the actual customer records might have a different source value (e.g., source ID vs source name mismatch, or the source names in customers table don't exactly match the source names in sources table).

Let me check the actual data in the database.
