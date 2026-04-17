# Solar Survey Management System - TODO

## Status: COMPLETE

## Database Schema & Migration
- [x] customers table (ชื่อ, ที่อยู่, เบอร์โทร, lat/lng, รายละเอียด, source)
- [x] surveys table (งานสำรวจ, สถานะ, วันนัด, ผู้รับผิดชอบ, หมายเหตุ)
- [x] survey_photos table (รูปถ่ายหน้างาน, S3 URL, หมวดหมู่)
- [x] survey_documents table (ใบเสนอราคา, simulation, S3 URL)
- [x] follow_ups table (นัด follow-up, สถานะ, หมายเหตุ)
- [x] share_links table (ลิงก์แชร์, token, วันหมดอายุ)
- [x] notifications table (แจ้งเตือน, ประเภท, อ่าน/ยังไม่อ่าน)
- [x] Generate migration SQL and apply

## Backend API (tRPC Routers)
- [x] Customer CRUD (create, read, update, delete, list with filters)
- [x] Survey CRUD (create, read, update, change status)
- [x] Photo upload/delete/list (S3 integration)
- [x] Document upload/delete/list (S3 integration)
- [x] Follow-up CRUD (create, update, complete, list by date)
- [x] Share link generate/validate/revoke
- [x] Calendar data (by day/week/month/year)
- [x] Notifications (create, list, mark read)
- [x] Dashboard stats (summary counts, recent activities)
- [x] Role-based access control (admin vs surveyor)

## Frontend Pages
- [x] Theme setup (elegant warm theme - navy blue sidebar + amber accent)
- [x] DashboardLayout with sidebar navigation
- [x] Dashboard page (stats, upcoming surveys, recent activities)
- [x] Customer list page (search, filter, pagination, grid cards)
- [x] Customer detail page (info, surveys list, edit dialog)
- [x] Add/Edit customer form (full fields including electricity, roof, phase)
- [x] Survey detail page (status workflow, tabs for photos/docs/followup/share)
- [x] Photo upload with batch support (categorized by roof/meter/panel/etc)
- [x] Document upload (quotation, simulation files - upload only, no creation)
- [x] Follow-up management (create, list, complete, overdue detection)
- [x] Calendar page (month/week views with navigation)
- [x] Share link page (public view for installers, no auth required)
- [x] Notifications page (list, mark read, mark all read, unread badge)

## Polish & Testing
- [x] Responsive design
- [x] Loading states and empty states (skeletons, empty messages)
- [x] Error handling (toast notifications)
- [x] Status change with auto-notification
- [x] Notification triggers on status change and follow-up creation
- [x] Google Maps location links for customers
- [x] Lightbox for photo preview
- [x] TypeScript - zero errors

## Known Limitations
- Photo upload limited to 10MB per file
- Document upload limited to 16MB per file
- Share links expire after 7 days by default

## Storage Management Features (New)
- [x] Backend API: คำนวณพื้นที่จัดเก็บที่ใช้ไปแล้ว (รูป + เอกสาร)
- [x] Backend API: ลบรูปถ่าย (พร้อมลบจาก S3)
- [x] Backend API: ลบเอกสาร (พร้อมลบจาก S3)
- [x] Frontend: แสดงขนาดไฟล์แต่ละรายการในหน้า SurveyDetail
- [x] Frontend: ปุ่มลบรูปถ่ายพร้อม confirm dialog ในหน้า SurveyDetail
- [x] Frontend: ปุ่มลบเอกสารพร้อม confirm dialog ในหน้า SurveyDetail
- [x] Frontend: แสดง Storage Usage ใน Dashboard (จำนวนรูป, เอกสาร, ขนาดรวม)
- [x] Vitest: ทดสอบ storage.stats, photo.delete auth, document.delete auth (17 tests passed)
- [x] Schema: เพิ่ม fileSize column ให้ survey_photos table
- [x] Backend: บันทึก fileSize ตอนอัพโหลดรูป
- [x] Dashboard: แสดงขนาดรวม (รูป + เอกสาร) พร้อมแปลงหน่วยอัตโนมัติ (KB/MB/GB)
