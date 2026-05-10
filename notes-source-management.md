# Source Management - Design Notes

## Current State

### `sources` table already exists:
- id (int, PK, auto_increment)
- name (varchar 255, unique)
- category (varchar 100, nullable) — currently only "partner" for Gulf and MEA, NULL for rest
- usageCount (int, default 0)
- createdAt (timestamp)

### Current data (35 rows):
- Gulf (category="partner") — id 810004
- MEA (category="partner") — id 810008
- All others have category=NULL → these are "TCS" sources

### Key insight:
The `category` field is already there but only used for "partner" (Gulf/MEA).
We can repurpose this as the "group" field.

## Design Decision:
Instead of creating new tables, we'll use the existing `sources` table and add a `groupName` column:
- `groupName` = "Gulf" → belongs to Gulf group
- `groupName` = "MEA" → belongs to MEA group  
- `groupName` = NULL or "TCS" → belongs to TCS group (default)

Actually, looking at it more carefully, we should create a `source_groups` table for flexibility:
- source_groups: id, name (TCS/Gulf/MEA), color, icon, sortOrder
- sources.groupId → FK to source_groups.id (nullable, NULL = TCS)

But simpler approach: just add `groupName` varchar to sources table.
Since there are only 3 groups now and may grow slowly, a simple varchar is fine.

## Plan:
1. Add `groupName` column to sources table (varchar, nullable, default NULL = TCS)
2. Set Gulf → groupName="Gulf", MEA → groupName="MEA"
3. Build UI to manage sources and assign groups
4. Update sidebar filter logic to use this mapping
