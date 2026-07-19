# Handover Bug Analysis

## Problem
User reports: หน้าลูกค้า (HandoverSign) ที่ https://tcssurvey.com/handover/sQiwOxodkdYFpgi5QpjqfczPnK8yErPn
- ไม่แสดงรูปที่เลือก
- ไม่แสดงเนื้อหาเพิ่มเติมที่กรอก
- Checklist ไม่ให้ติ๊ก

## Analysis

### Backend (routers.ts line 2881-2923)
`getByHandoverToken` procedure:
- Correctly fetches form by token
- Correctly parses `selectedPhotoIds` from JSON and filters photos
- Correctly parses `checklistData` and `customSections`
- Returns: photos, checklistItems, customSections, customerName, etc.

### Frontend (HandoverSign.tsx)
- Line 166: Shows photos only if `data.photos && data.photos.length > 0`
- Line 201: Shows checklist only if `data.checklistItems && data.checklistItems.length > 0`
- Line 229: Shows customSections only if `data.customSections && data.customSections.length > 0`

### Root Cause Hypothesis
The frontend code looks correct. The issue is likely:
1. **selectedPhotoIds not saved** - The HandoverEditor might not be saving selectedPhotoIds to the database when admin selects photos
2. **customSections not saved** - Same issue with custom sections
3. **checklistData empty** - The checklist data might not be populated in the delivery form

Need to check:
- HandoverEditor.tsx - does it call updateSelectedPhotos/updateCustomSections correctly?
- Does the generateHandoverLink procedure save the current state?
- Is the form ID correct (300003)?

## Test with actual token
Token: sQiwOxodkdYFpgi5QpjqfczPnK8yErPn
URL: https://tcssurvey.com/handover/sQiwOxodkdYFpgi5QpjqfczPnK8yErPn
