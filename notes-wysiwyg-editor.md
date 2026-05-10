# WYSIWYG Template Editor Implementation Notes

## What was done:
1. Rewrote SurveyTemplates.tsx completely
2. Template Editor now shows fields as a WYSIWYG form preview (like SurveyDetail)
3. Fields are grouped by section headers, displayed in a grid layout
4. Clicking any field opens a Sheet (side panel) on the right with clear title showing which field is being edited
5. Drag & drop still works via GripVertical handles
6. Settings (name, source, PDF config) moved to a separate dialog
7. Add field uses a dialog

## TS errors:
- All 8 errors are pre-existing from SourceManagement.tsx (not from this change)
- No new errors introduced

## Components used:
- Sheet (side panel) for field editing - shows field name clearly
- Card for form preview container
- DnD kit for drag & drop
- All field type renderers (text, number, textarea, select, checkbox, checkbox_group, radio, date, distance, yes_no, section_header)

## Status: Working, dev server running, HMR applied
