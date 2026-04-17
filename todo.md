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

## User Request - Round 2

### 1. ระบบ Login ด้วย Username/Password
- [x] Schema: เพิ่ม username, passwordHash, role (superadmin/admin/sales) ใน users table
- [x] Backend: สร้าง API login ด้วย username/password
- [x] Backend: สร้าง API register/create user (superadmin เท่านั้น)
- [x] Frontend: หน้า Login ด้วย username/password
- [x] Frontend: หน้าจัดการ User สำหรับ superadmin
- [x] Seed: สร้าง user kipum / Abcd@2026 เป็น superadmin

### 2. แก้ไขหน้าแชร์ลิงก์
- [x] Backend: ซ่อนใบเสนอราคาจากหน้าแชร์ (ช่างติดตั้งไม่ควรเห็น)
- [x] Backend+Frontend: แก้ไฟล์ Access Denied - สร้าง proxy endpoint สำหรับดาวน์โหลดไฟล์ที่มีชื่อภาษาไทย
- [x] Frontend: เพิ่มข้อมูลทางเทคนิคในหน้าแชร์ (ค่าไฟ, ประเภทหลังคา, ระบบไฟ)
- [x] Frontend: filter ไม่แสดง quotation ในหน้าแชร์ (defense-in-depth)

### 3. ระบบ Role แยกข้อมูล
- [x] Backend: เซลล์เห็นเฉพาะลูกค้า/งานของตัวเอง (customer.list, survey.list filtered by createdBy)
- [x] Backend: superadmin/admin เห็นข้อมูลทุกคน
- [x] Backend: เพิ่ม assignedTo/createdBy field สำหรับ filter ตาม user
- [x] Frontend: filter ข้อมูลตาม role อัตโนมัติ
