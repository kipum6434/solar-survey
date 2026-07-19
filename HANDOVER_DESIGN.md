# Handover Document System Design

## Existing Tables (already in DB)
- `delivery_forms` — has surveyId, customerId, checklistTemplateId, checklistData (JSON), customerSignatureUrl/Key, technicianSignatureUrl/Key, technicianName, notes, pdfUrl, pdfFileKey, status (draft/signed/completed), signedAt, createdBy
- `delivery_checklist_templates` — has name, items (JSON array of strings), isDefault, createdBy

## What User Wants (New Feature)
1. After installer uploads photos → Admin/team lead selects which photos to include in handover doc
2. Admin can edit/add content to the handover form (header auto-fills from customer+survey data, no price shown)
3. Send link to customer → customer reads details + signs on mobile (canvas signature)
4. System generates complete PDF (info + selected photos + customer signature)
5. Template should be fully editable (add/remove/edit anything)

## Header Info (from existing data, auto-filled)
- Company: บริษัท ทีซีเอส พาวเวอร์ พลัส จำกัด (สำนักงานใหญ่)
- Address: 700/134 อาคารรีเจ้นท์ศรีนครินทร์ทาวเวอร์...
- Customer name, phone, address, area
- Roof type, electrical system (phase)
- Technical: system size (kW), panel count, panel brand, inverter model, system type
- NO price shown

## New DB Changes Needed
1. Add `selectedPhotoIds` (JSON text) to `delivery_forms` — which installation photos to show in handover doc
2. Add `additionalContent` (JSON text) to `delivery_forms` — custom sections/paragraphs added by admin
3. Add `handoverToken` (varchar) to `delivery_forms` — public link token for customer to sign
4. Add `customerName` (varchar) to `delivery_forms` — name of person who signed

## Flow
1. Admin creates handover doc from survey detail page → auto-fills header from customer+survey
2. Admin selects photos from installation photos (checkbox)
3. Admin edits checklist + adds custom content sections
4. Admin generates public link (handoverToken)
5. Customer opens link → sees document (read-only) with selected photos
6. Customer signs (canvas signature) + enters name
7. System saves signature → generates PDF → marks as completed
8. PDF stored in S3, link available in admin panel

## PDF Generation
- Use pdfmake + Sarabun font (already known from previous knowledge)
- Header: company info + logo + customer info + technical info
- Body: selected photos + checklist + custom content
- Footer: customer signature + date + technician signature (if any)
