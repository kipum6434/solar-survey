# Handover Document System - Implementation Progress

## Status: Phase 6/7 — Testing + Template Editing

## What's Done:
1. **DB Schema** — Added columns to `delivery_forms`: `selectedPhotoIds`, `customSections`, `handoverToken`, `handoverSentAt`, `customerSignatureKey`, `customerSignerName`
2. **DB Helpers** — `updateDeliveryFormSelectedPhotos`, `updateDeliveryFormCustomSections`, `generateHandoverToken`, `getDeliveryFormByToken`, `signDeliveryFormByCustomer`, `getDeliveryFormById`
3. **tRPC Procedures** (in deliveryFormRouter):
   - `updateSelectedPhotos` (protected) — save selected photo IDs
   - `updateCustomSections` (protected) — save custom sections
   - `generateHandoverLink` (protected) — generate/reuse token, set status to pending_signature
   - `getByHandoverToken` (public) — get handover data by token (for customer page)
   - `publicSignHandover` (public) — customer signs with signature data
   - `getHandoverData` (protected) — get full data for admin editor
4. **Frontend Pages**:
   - `HandoverEditor.tsx` — Admin page at `/delivery-forms/:id/handover` with photo selection, custom sections editor, link generation
   - `HandoverSign.tsx` — Public page at `/handover/:token` for customer to view and sign
5. **Routes** — Added in App.tsx
6. **DeliveryFormDetail.tsx** — Added "จัดการหนังสือส่งมอบ" button linking to HandoverEditor
7. **DeliveryForms.tsx** — Added `pending_signature` status to statusConfig and summary cards
8. **Tests** — `server/handover.test.ts` with 9 passing tests

## Key Design Decisions:
- Header info (ข้อมูลลูกค้า + เทคนิค) is auto-pulled from survey/customer data — NO price shown
- Admin selects which photos to include (not all installation photos)
- Custom sections are fully editable (add/remove/edit title+content)
- Public link uses nanoid(32) token for security
- Customer signs on mobile canvas (signature_pad library already installed)
- Signature uploaded to S3, URL stored in DB
- Status flow: draft → pending_signature → signed → completed

## Remaining:
- [x] Add pending_signature to DeliveryForms list page
- [ ] Verify TypeScript compiles cleanly
- [ ] Run all tests
- [ ] Save checkpoint
- [ ] Deliver to user

## User Requirements (from conversation):
- ส่วนหัว: ดึงจากข้อมูลเก่า (ลูกค้า+เทคนิค) ไม่มีราคา — ตามรูปที่ส่งมา
- Admin/หัวหน้าทีมเลือกรูป + แก้ไขเทมเพลต
- ลูกค้าเซ็นบนมือถือ (วาดลายเซ็น)
- เทมเพลตแก้ไขได้ทั้งหมด (เพิ่ม/ลด)
