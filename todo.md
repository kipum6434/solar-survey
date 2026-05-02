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
- [x] Backend: ซ่อนใบเสนอราคาจากหน้าแชร์
- [x] Backend+Frontend: แก้ไฟล์ Access Denied - สร้าง proxy endpoint
- [x] Frontend: เพิ่มข้อมูลทางเทคนิคในหน้าแชร์
- [x] Frontend: filter ไม่แสดง quotation ในหน้าแชร์

### 3. ระบบ Role แยกข้อมูล
- [x] Backend: เซลล์เห็นเฉพาะลูกค้า/งานของตัวเอง
- [x] Backend: superadmin/admin เห็นข้อมูลทุกคน

### 4-8. ข้อมูลเทคนิค + Inline Edit
- [x] เพิ่มช่องกรอกข้อมูลเทคนิค + inline edit + ข้อมูลลูกค้า
- [x] การ์ดข้อมูลเทคนิคแสดงเสมอ + บันทึก survey+customer พร้อมกัน

## User Request - Round 3: ปรับปรุง UI ให้ใช้งานง่ายขึ้น (อ้างอิง Excel)

### 9. หน้างานสำรวจ - เพิ่มตัวกรองเดือน/ปี
- [x] เพิ่ม filter เดือน/ปี ในหน้างานสำรวจ (เหมือน Tab เดือนใน Excel)
- [x] Backend: เพิ่ม parameter month/year ใน survey.list procedure
- [x] Frontend: แสดง month/year picker ที่หน้างานสำรวจ

### 10. หน้างานสำรวจ - มุมมองตาราง (Table View)
- [x] เพิ่มมุมมองตาราง (Table View) ในหน้างานสำรวจ แสดงคอลัมน์คล้าย Excel
- [x] คอลัมน์: วันที่, เวลา, ชื่อลูกค้า, เบอร์โทร, เขต/จังหวัด, ช่องทาง, เจ้าหน้าที่, สถานะ, หมายเหตุ
- [x] สลับระหว่างมุมมอง List/Table ได้

### 11. หน้าลูกค้า - เพิ่มตัวกรองเดือน/ปี
- [x] เพิ่ม filter เดือน/ปี ในหน้าลูกค้า
- [x] Backend: เพิ่ม parameter month/year ใน customer.list procedure

### 12. หน้าลูกค้า - มุมมองตาราง (Table View)
- [x] เพิ่มมุมมองตาราง (Table View) ในหน้าลูกค้า
- [x] คอลัมน์: ชื่อ, เบอร์โทร, อีเมล, ที่อยู่, ช่องทาง, วันที่สร้าง

## Bug Fixes - Round 3.1

- [x] ข้อมูลทางเทคนิคหายไปจากหน้า SurveyDetail (การ์ดเทคนิค + ข้อมูลลูกค้า)
- [x] แก้ import error: UsersPage ไม่พบใน App.tsx (เป็น stale Vite cache - restart แก้แล้ว)

## User Request - Round 4: ปรับปรุงแหล่งที่มา + มอบหมายหลายคน + Workflow

### 13. แหล่งที่มา (Source) - Free Text + Auto-suggest
- [x] Schema: สร้างตาราง sources (id, name, createdAt) เก็บค่าที่เคยใช้
- [x] Schema: เปลี่ยน customers.source จาก enum เป็น text
- [x] Backend: API sources.list (ดึงรายการแหล่งที่มาทั้งหมด)
- [x] Backend: สร้าง source ใหม่อัตโนมัติเมื่อพิมพ์ค่าใหม่
- [x] Frontend: เปลี่ยน Source dropdown เป็น Combobox (พิมพ์เอง + auto-suggest)
- [x] Frontend: เพิ่ม filter ตามแหล่งที่มาในหน้างานสำรวจและลูกค้า

### 14. มอบหมายหลายคน (Multi-assign)
- [x] Schema: สร้างตาราง survey_assignments (id, surveyId, userId, role, createdAt)
- [x] Schema: role enum: admin_sender, surveyor, closer
- [x] Backend: survey.create/update รองรับ assignments (setSurveyAssignments/getSurveyAssignments)
- [x] Backend: survey.getById ส่ง assignments กลับมาพร้อมข้อมูล survey
- [x] Frontend: เปลี่ยน assignedTo dropdown เป็น multi-select ตาม role

### 15. Workflow 3 บทบาท + Timeline
- [x] Schema: เพิ่ม adminSenderId ใน surveys (แอดมินผู้ส่งงาน)
- [x] Frontend: ฟอร์มสร้างงาน - เลือกแอดมินผู้ส่งงาน
- [x] Frontend: ฟอร์มแก้ไขงาน - เลือกทีมสำรวจ (หลายคน)
- [x] Frontend: เมื่อเปลี่ยนสถานะเป็น "ปิดการขาย" - เลือกผู้ปิดการขาย
- [x] Frontend: แสดง Workflow Card (ทีมงาน 3 บทบาท) ในหน้า SurveyDetail

## Bug Fixes - Round 4.1

- [x] การ์ดข้อมูลทางเทคนิค+ข้อมูลลูกค้า ใน SurveyDetail หายปุ่ม "แก้ไข" และ inline edit (ต้องกลับมาเหมือนเวอร์ชันเก่าที่มีปุ่มดินสอ กดแล้วแก้ค่าได้เลยในการ์ด)

## User Request - Round 5: ปรับปรุง UI + เพิ่มฟิลด์ + Export + จัดการทีม

### 16. หน้างานสำรวจ - เปลี่ยนชื่อคอลัมน์ + เพิ่มคอลัมน์
- [x] เปลี่ยน "เจ้าหน้าที่" เป็น "เซลล์" ในตารางงานสำรวจ
- [x] เพิ่มคอลัมน์ "คนส่งสำรวจ" (แอดมินผู้ส่งงาน) ในตารางงานสำรวจ
- [x] เพิ่มคอลัมน์ "คนปิดการขาย" ในตารางงานสำรวจ

### 17. หน้างานสำรวจ - เพิ่ม filter ตาม role
- [x] เพิ่ม filter เซลล์ (surveyor) ในหน้างานสำรวจ
- [x] เพิ่ม filter คนส่งสำรวจ (admin_sender) ในหน้างานสำรวจ
- [x] เพิ่ม filter คนปิดการขาย (closer) ในหน้างานสำรวจ

### 18. ฟอร์มเพิ่มลูกค้า + หน้าลูกค้า - เพิ่มอำเภอ/เขต
- [x] Schema: เพิ่ม district column ใน customers table
- [x] Backend: รองรับ district ใน customer.create/update
- [x] Frontend: เพิ่มช่อง "อำเภอ/เขต" ในฟอร์มเพิ่ม/แก้ไขลูกค้า
- [x] Frontend: แสดง "เขต/อำเภอ" ในตารางหน้าลูกค้า
- [x] Frontend: แสดง "ขนาด kW" และ "Inverter" ในตารางหน้าลูกค้า

### 19. SurveyDetail - เพิ่มฟิลด์เทคนิคใหม่
- [x] Schema: เพิ่ม panelBrand, needBattery, needOptimizer, systemType ใน surveys table
- [x] Backend: รองรับฟิลด์ใหม่ใน survey.create/update/getById
- [x] Frontend: เพิ่มช่อง "ยี่ห้อแผง", "ต้องการแบตเตอรี่?", "ต้องการ Optimizer?", "ประเภทระบบ (String/Micro/ทั้งสอง)" ในการ์ดข้อมูลทางเทคนิค

### 20. SurveyDetail - Inline edit แบบไม่ต้องกดดินสอ
- [x] เปลี่ยน inline edit ให้กดที่ช่องว่างหรือค่าแล้วแก้ไขได้เลย ไม่ต้องกดปุ่มดินสอก่อน (click-to-edit)

### 21. ทีมงาน - เพิ่ม/ลบสมาชิกได้
- [x] Frontend: ทีมงานการ์ด - เพิ่มปุ่มเพิ่ม/ลบ แอดมินผู้ส่งงาน, ทีมเซลล์, ทีมปิดการขาย
- [x] Backend: รองรับ update assignments (เพิ่ม/ลบ)

### 22. แหล่งที่มา (Source) - ลบได้
- [x] Backend: เพิ่ม API sources.delete
- [x] Frontend: เพิ่มปุ่มลบแหล่งที่มาใน SourceCombobox หรือหน้าจัดการ

### 23. Export Excel
- [x] Backend: สร้าง API export รายงานสำรวจทั้งหมดเป็น Excel (.xlsx)
- [x] Frontend: เพิ่มปุ่ม Export Excel ในหน้างานสำรวจ

## User Request - Round 6: หน้าจัดการทีมงาน (Team Management)

### 24. หน้าจัดการทีมงาน - เพิ่ม/ลบสมาชิกทีม
- [x] Schema: สร้าง team_members table แยกจาก users (เก็บชื่อ, เบอร์โทร, role)
- [x] Backend: CRUD API สำหรับ team_members (list, create, update, delete)
- [x] Frontend: สร้างหน้า TeamManagement.tsx พร้อมตารางแสดงสมาชิก + ปุ่มเพิ่ม/แก้ไข/ลบ
- [x] Frontend: เพิ่มเมนู "จัดการทีมงาน" ใน sidebar
- [x] Frontend: อัพเดท dropdown แอดมินผู้ส่งงาน/ทีมสำรวจ/คนปิดการขาย ให้ดึงจาก team_members

## User Request - Round 7: จัดการผู้ใช้แอดมิน + Import Excel

### 25. ระบบจัดการผู้ใช้/แอดมิน (Super Admin)
- [x] Backend: สร้าง API สำหรับเพิ่มผู้ใช้แอดมินใหม่ (ชื่อ, username, password, role)
- [x] Backend: สร้าง API สำหรับลบ/ปิดการใช้งานผู้ใช้
- [x] Backend: สร้าง API สำหรับเปลี่ยน role ผู้ใช้ (admin/user)
- [x] Frontend: สร้างหน้าจัดการผู้ใช้ (UserManagement) แสดงรายชื่อผู้ใช้ทั้งหมด
- [x] Frontend: ปุ่มเพิ่มผู้ใช้ใหม่ (ชื่อ, username, password, role)
- [x] Frontend: ปุ่มลบ/เปลี่ยน role ผู้ใช้
- [x] Sidebar: เพิ่มเมนู "จัดการผู้ใช้" ใน DashboardLayout

### 26. Import ลูกค้าจาก Excel
- [x] Backend: สร้าง API สำหรับ import ลูกค้าจาก Excel (.xlsx)
- [x] Frontend: เพิ่มปุ่ม Import Excel ในหน้าลูกค้า
- [x] Frontend: Dialog upload ไฟล์ + preview ข้อมูลก่อน import
- [x] Frontend: แสดงผลลัพธ์การ import (สำเร็จ/ล้มเหลว)

## User Request - Round 8: ปรับคอลัมน์ตารางลูกค้า + ฟอร์ม

- [x] ตารางลูกค้า: ตัดคอลัมน์ "อีเมล" ออก
- [x] ตารางลูกค้า: เพิ่มคอลัมน์ "โลเคชั่น" (Google Maps location/link)
- [x] ตารางลูกค้า: เพิ่มคอลัมน์ "ประเภทหลังคา"
- [x] ตารางลูกค้า: เพิ่มคอลัมน์ "หมายเหตุ"
- [x] ฟอร์มเพิ่มลูกค้า: ตัดช่อง "อีเมล" ออก
- [x] ฟอร์มเพิ่มลูกค้า: เพิ่มช่อง "โลเคชั่น" (Google Maps link)
- [x] ลำดับคอลัมน์ใหม่: ชื่อลูกค้า > เบอร์โทร > โลเคชั่น > ช่องทาง > เขต/อำเภอ > จังหวัด > ค่าไฟ/เดือน > ประเภทหลังคา > ระบบไฟ > หมายเหตุ > วันที่สร้าง

## User Request - Round 9: ระบบ Login ด้วย Username/Password

- [x] ฟอร์มเพิ่มผู้ใช้: เพิ่มช่อง username และ password
- [x] Backend: เพิ่ม username, passwordHash ใน users table
- [x] Backend: สร้าง API login ด้วย username/password (ออก session token)
- [x] Backend: อัพเดท users.create ให้รองรับ username/password
- [x] Frontend: สร้างหน้า Login ด้วย username/password (/login)
- [x] Frontend: เชื่อม login flow - DashboardLayout redirect ไป /login
- [x] ฟอร์มแก้ไขผู้ใช้: เพิ่มปุ่ม reset password (key icon)

## Bug Fix - Round 9.1: หน้า Login auto-redirect ไป Manus OAuth

- [x] แก้ไขหน้า /login ไม่ให้ auto-redirect ไป Manus OAuth portal (แก้ main.tsx + useAuth.ts)
- [x] ให้หน้า Login แสดงฟอร์ม username/password เป็นหลัก ผู้ใช้เลือกเองว่าจะ login แบบไหน

## User Request - Round 9.2: Remember Me ในหน้า Login

- [x] เพิ่ม checkbox "จำรหัสผ่าน" ในหน้า Login
- [x] บันทึก username + password ลง localStorage เมื่อเลือก Remember Me และ login สำเร็จ
- [x] โหลด username + password จาก localStorage เมื่อเปิดหน้า Login
- [x] ล้าง localStorage เมื่อยกเลิก Remember Me

## User Request - Round 10: จำกัดสิทธิ์หน้าจัดการผู้ใช้งาน เฉพาะ Superadmin

- [x] Backend: เปลี่ยน users router ทั้งหมดให้ใช้ superadminProcedure (list, create, update, delete, resetPassword, updateRole)
- [x] Frontend: ซ่อนเมนู "จัดการผู้ใช้งาน" ใน sidebar ถ้าไม่ใช่ superadmin (DashboardLayout)
- [x] Frontend: บล็อกหน้า /users ถ้าไม่ใช่ superadmin (redirect กลับ /) + เพิ่ม superadmin role display
- [x] Schema: เพิ่ม superadmin ใน role enum + migration
- [x] Tests: 63/63 passed (รวม 7 tests ใหม่สำหรับ superadmin access control)

## User Request - Round 11: แก้ไขหน้างานสำรวจ (SurveyDetail)

- [x] เปลี่ยนแบตเตอรี่จาก dropdown เป็นช่องกรอกข้อความ + schema migration varchar(500)
- [x] เปลี่ยน Optimizer จาก dropdown เป็นช่องกรอกข้อความ + schema migration varchar(500)
- [x] แก้บัค input พิมพ์ตัวแรกแล้วเด้งออก - ลบ editing state ให้แสดง input ตลอด
- [x] ตัดราคาประเมินออกจากหน้าแสดง + หน้าแก้ไข + Excel export
- [x] ตัดราคาประเมินออกจากหน้าแก้ไข (EditSurveyDialog)

## Bug Fix - Round 12: ทีมงานไม่ลิงก์กันระหว่างหน้าแสดงและหน้าแก้ไข
- [x] ตรวจสอบว่า TeamCard แสดงข้อมูลทีมงานจาก survey data ถูกต้อง
- [x] ตรวจสอบว่า EditSurveyDialog บันทึกทีมงานลง DB ถูกต้อง
- [x] ให้ข้อมูลทีมงาน sync กันทั้ง 2 จุด - กรอกจากไหนก็แสดงเหมือนกัน
- [x] TeamCard แสดงชื่อทีมงานหลังบันทึกจาก EditSurveyDialog
- [x] TeamCard แก้ไขทีมงานแล้วแสดงใน EditSurveyDialog ด้วย
- [x] Data backfill: ใช้ dual join (team_members + users fallback) รองรับทั้ง legacy และ new data
- [x] เพิ่ม test ครอบคลุม assignment data (68 tests passed)
- [x] ตรวจสอบผ่าน backend vitest (68 tests passed)

## User Request - Round 13: ลบลูกค้าทีละหลายรายการ (Bulk Delete)
- [x] Backend: เพิ่ม API customer.bulkDelete รับ array ของ customer IDs
- [x] Backend: ลบ surveys + assignments + photos + documents + follow-ups ที่เกี่ยวข้องด้วย
- [x] Frontend: เพิ่ม checkbox ในตารางลูกค้า (table view) ให้เลือกหลายรายการ
- [x] Frontend: เพิ่ม checkbox "เลือกทั้งหมด" ที่ header
- [x] Frontend: แสดง action bar เมื่อเลือกรายการ (จำนวนที่เลือก + ปุ่มลบ)
- [x] Frontend: confirm dialog ก่อนลบ พร้อมแจ้งจำนวนที่จะลบ
- [x] Tests: เพิ่ม vitest สำหรับ customer.bulkDelete (72 tests passed)

## User Request - Round 14: Multiple Features

### 14A: Bug Fix - ฟิลเตอร์เซลล์ในหน้างานสำรวจไม่แสดงงานที่มีเซลล์คนนั้นเป็น co-assignment
- [x] Backend: แก้ survey.list filter ให้ดูจาก survey_assignments ทุก role ไม่ใช่แค่ primary
- [x] Frontend: ตรวจสอบว่า filter เซลล์ส่งค่าถูกต้อง

### 14B: หน้าสรุปผลงานเซลล์ (Sales Performance)
- [x] Backend: เพิ่ม API สรุปจำนวนเคสสำรวจต่อทีมงานต่อเดือน (นับจาก assignments - ไปคู่นับคนละ 1)
- [x] Frontend: สร้างหน้าสรุปผลงานเซลล์ แสดงจำนวนเคสต่อคนต่อเดือน
- [x] Frontend: เพิ่มเมนูในไซด์บาร์

### 14C: สถานะลูกค้าในหน้าลูกค้า
- [x] Backend: เพิ่ม logic คำนวณสถานะลูกค้า (ยังไม่นัดสำรวจ / นัดสำรวจแล้ว / สำรวจเสร็จ / ปิดการขาย)
- [x] Frontend: เพิ่มคอลัมน์สถานะในตารางลูกค้า + badge สี
- [x] Frontend: เพิ่มฟิลเตอร์ตามสถานะ

### 14D: ฟิลเตอร์เขต/อำเภอ จังหวัด แหล่งที่มา
- [x] Backend: เพิ่ม filter parameters ในทั้ง customer.list และ survey.list
- [x] Frontend: เพิ่ม dropdown ฟิลเตอร์ในหน้าลูกค้า (เขต/อำเภอ, จังหวัด, แหล่งที่มา)
- [x] Frontend: เพิ่ม dropdown ฟิลเตอร์ในหน้างานสำรวจ (เขต/อำเภอ, จังหวัด)

### 14E: Export ลูกค้าที่เลือกเป็น Excel
- [x] Frontend: เพิ่มปุ่ม Export Excel ใน bulk action bar เมื่อเลือกลูกค้า
- [x] Frontend: สร้างไฟล์ Excel จากข้อมูลลูกค้าที่เลือก

## User Request - Round 15: เพิ่มช่องที่อยู่ในฟอร์มเพิ่มลูกค้า
- [x] Frontend: เพิ่มช่อง "ที่อยู่" (บ้านเลขที่ หมู่บ้าน ถนน ซอย) ในฟอร์มเพิ่มลูกค้า
- [x] Frontend: เพิ่มช่อง "ที่อยู่" ในฟอร์มแก้ไขลูกค้าด้วย (CustomerDetail.tsx)

## Bug Fix - Round 16: ลิงก์ Google Maps กดไม่ได้จากมือถือ
- [x] แก้ไข CustomerDetail.tsx ให้ลิงก์ Google Maps เป็น clickable button ที่เปิดได้จากมือถือ
- [x] ตรวจสอบจุดอื่นที่แสดงลิงก์ Google Maps (Customers, SurveyDetail) ให้กดได้เช่นกัน

## User Request - Round 17: ซ่อนเอกสารในหน้า Share Link สาธารณะ
- [x] ซ่อนส่วน "เอกสาร" ในหน้า share link สาธารณะ ไม่ให้คนนอกเห็น
- [x] คนในระบบ (login แล้ว) ยังเห็นเอกสารเหมือนเดิม (หน้า SurveyDetail ไม่เปลี่ยน)

## User Request - Round 18: ระบบจัดการสถานะที่กำหนดเองได้ + วันที่นัดติดตั้ง
- [x] สร้างตาราง custom_statuses ใน DB (type: customer/survey, label, color, sortOrder)
- [x] Seed ค่าเริ่มต้นสถานะลูกค้า: ยังไม่นัดสำรวจ, นัดสำรวจแล้ว, สำรวจเสร็จ, ปิดการขาย
- [x] Seed ค่าเริ่มต้นสถานะงานสำรวจ: นัดสำรวจแล้ว, สำรวจเสร็จ, ปิดการขาย
- [x] เพิ่มคอลัมน์ statusId ในตาราง customers (FK → custom_statuses)
- [x] เพิ่มคอลัมน์ statusId ในตาราง surveys (FK → custom_statuses)
- [x] เพิ่มคอลัมน์ installationDate ในตาราง surveys (วันที่นัดติดตั้ง)
- [x] Backend: CRUD สถานะ (เพิ่ม/ลบ/แก้ไข) แยกตาม type
- [x] Backend: API เปลี่ยนสถานะลูกค้า (customer.updateStatus)
- [x] Backend: API เปลี่ยนสถานะงานสำรวจ (survey.updateStatus)
- [x] Backend: API อัพเดท installationDate
- [x] หน้าลูกค้า: คอลัมน์สถานะกดเปลี่ยนได้เลย (dropdown inline)
- [x] หน้าลูกค้า: filter สถานะใช้จาก custom_statuses
- [x] หน้างานสำรวจ: คอลัมน์สถานะกดเปลี่ยนได้เลย (dropdown inline)
- [x] หน้างานสำรวจ: เมื่อเลือกสถานะ "ปิดการขาย" ให้แสดง date picker ลงวันที่นัดติดตั้ง
- [x] หน้า SurveyDetail: แสดงวันที่นัดติดตั้ง
- [x] หน้า SharedSurvey: แสดงวันที่นัดติดตั้ง (ถ้ามี)
- [x] หน้าจัดการสถานะ: เพิ่ม/ลบ/แก้ไขคำสถานะได้ (แยก customer/survey)
- [x] เขียน tests สำหรับ custom statuses CRUD + status update + installationDate (14 tests ผ่าน)

### Round 18 Gaps - ต้องแก้ไขเพิ่ม
- [x] หน้า SurveyDetail: เพิ่มการแสดงผล installationDate ในหน้ารายละเอียดงานสำรวจ
- [x] Backend: getSurveyWithCustomer return installationDate ไปยัง SharedSurvey (อยู่ใน surveys table แล้ว - return ทั้ง row)

## User Request - Round 19: หน้างานติดตั้ง + วันนัดติดตั้งในหน้าแชร์

- [x] Backend: สร้าง API ดึงรายการงานติดตั้ง (survey ที่มี installationDate หรือสถานะปิดการขาย)
- [x] Frontend: สร้างหน้า Installations.tsx แสดงรายการงานติดตั้ง (ตาราง + filter เดือน/ปี)
- [x] Frontend: เพิ่มเมนู "งานติดตั้ง" ใน sidebar (ระหว่าง งานสำรวจ กับ ผลงานทีม)
- [x] Frontend: เพิ่ม route /installations ใน App.tsx
- [x] Frontend: หน้าแชร์ลิงก์ (SharedSurvey) แสดงวันที่นัดติดตั้งให้ช่างเห็น (ทำไว้แล้วใน R18)
- [x] เขียน tests สำหรับ installation list API (6 tests ผ่าน, รวม 99 tests)

## User Request - Round 20: จัดการไฟล์ + filter งานติดตั้ง + สถานะนัดติดตั้ง

- [x] Backend: API ดึงรายการไฟล์ทั้งหมด (รูปภาพ+เอกสาร) พร้อมข้อมูล survey/customer
- [x] Backend: API ลบไฟล์ (ลบจาก DB + S3)
- [x] Backend: เพิ่ม filter ใน installation.list (จังหวัด, เขต, คนสำรวจ, คนปิดงาน)
- [x] Frontend: สร้างหน้า FileManagement - ดูรูปภาพ/เอกสารทั้งหมด เลือกลบได้
- [x] Frontend: เพิ่มเมนู "จัดการไฟล์" ใน sidebar + route
- [x] Frontend: เพิ่ม filter ในหน้างานติดตั้ง (จังหวัด, เขต, คนสำรวจ, คนปิดงาน, เดือน/ปี)
- [x] Frontend: เมื่อเลือกสถานะ "นัดติดตั้งแล้ว" ให้ redirect ไปหน้างานติดตั้ง
- [x] เขียน tests สำหรับ file management + installation filters (8 tests ใหม่, รวม 107 tests ผ่าน)

## User Request - Round 21: Bulk Delete ในหน้าจัดการทีมงาน, งานสำรวจ, งานติดตั้ง

- [x] Backend: เพิ่ม bulk delete API สำหรับ team members (ลบหลายคนพร้อมกัน)
- [x] Backend: เพิ่ม bulk delete API สำหรับ surveys (ลบหลายงานสำรวจพร้อมกัน + ลบ related data)
- [x] Frontend: หน้าจัดการทีมงาน - เพิ่ม checkbox เลือกหลายรายการ + ปุ่มลบทีเดียว
- [x] Frontend: หน้างานสำรวจ - เพิ่ม checkbox เลือกหลายรายการ + ปุ่มลบทีเดียว
- [x] Frontend: หน้างานติดตั้ง - เพิ่ม checkbox เลือกหลายรายการ + ปุ่มลบทีเดียว
- [x] เขียน tests สำหรับ bulk delete APIs (6 tests ผ่าน)

## Bug Fix - Round 22: เปลี่ยนสถานะ "นัดติดตั้ง" แล้วไม่ redirect ไปหน้างานติดตั้ง

- [x] ตรวจสอบ logic redirect เมื่อเปลี่ยนสถานะเป็น "นัดติดตั้ง" ในหน้างานสำรวจ
- [x] แก้ไขให้ redirect ไปหน้างานติดตั้งทำงานถูกต้อง

## User Request - Round 23: Date Picker + สถานะงานติดตั้ง + Export Excel

- [x] ฟีเจอร์ 1: เพิ่ม date picker ใน StatusDropdown เมื่อเลือกสถานะ "นัดติดตั้ง" ให้เลือกวันนัดติดตั้งได้ทันที
- [x] ฟีเจอร์ 2: เพิ่มสถานะงานติดตั้งแยกต่างหาก (รอติดตั้ง / กำลังติดตั้ง / ติดตั้งเสร็จ / ส่งมอบแล้ว) - schema + backend + frontend
- [x] ฟีเจอร์ 3: เพิ่ม Export Excel ในหน้างานติดตั้ง
- [x] เขียน tests สำหรับฟีเจอร์ใหม่ (9 tests ผ่าน)

## User Request - Round 24: Dialog แก้ไข pre-fill + sync สถานะ + วันที่แก้จากตาราง

- [x] EditSurveyDialog: pre-fill ข้อมูลเทคนิค (ขนาด kW, จำนวนแผง, ยี่ห้อแผง, inverter, ราคาเสนอ, แบตเตอรี่, optimizer, ประเภทระบบ, หมายเหตุ)
- [x] EditSurveyDialog: pre-fill ข้อมูลลูกค้า (ค่าไฟ, ประเภทหลังคา, พื้นที่หลังคา, ระบบไฟ, ขนาดมิเตอร์, ช่องทาง, ที่อยู่, หมายเหตุลูกค้า)
- [x] EditSurveyDialog: pre-fill ทีมงาน (แอดมินผู้ส่งงาน, ทีมสำรวจ, ผู้ปิดการขาย)
- [x] EditSurveyDialog: สถานะใน dialog sync กับ StatusDropdown ในตาราง (เปลี่ยนตรงไหนก็ได้)
- [x] หน้างานสำรวจ (ตาราง): เพิ่มคอลัมน์วันที่สำรวจที่กดแก้ไขได้ (inline date picker)
- [x] วันที่สำรวจ: sync ระหว่าง dialog แก้ไข กับ inline edit ในตาราง

## Bug Fix - Round 25: EditSurveyDialog ไม่ pre-fill ข้อมูลเดิม

- [x] EditSurveyDialog: ต้อง pre-fill ข้อมูลเทคนิค (ขนาด kW, จำนวนแผง, ยี่ห้อแผง, inverter, ราคา, แบตเตอรี่, optimizer, ประเภทระบบ, หมายเหตุ)
- [x] EditSurveyDialog: ต้อง pre-fill ข้อมูลลูกค้า (ค่าไฟ, ประเภทหลังคา, พื้นที่หลังคา, ระบบไฟ, ขนาดมิเตอร์, ช่องทาง, ที่อยู่, หมายเหตุลูกค้า)
- [x] EditSurveyDialog: ต้อง pre-fill ทีมงาน (แอดมินผู้ส่งงาน, ทีมสำรวจ, ผู้ปิดการขาย)
- [x] EditSurveyDialog: ต้อง pre-fill วันที่สำรวจ + เวลา
- [x] EditSurveyDialog: ต้อง pre-fill สถานะปัจจุบัน

## User Request - Round 26: ประเภทรูปภาพจัดการได้เอง

- [x] Schema: เพิ่ม photo_categories table (key, label, sortOrder, isDefault) + เปลี่ยน survey_photos.category จาก ENUM เป็น VARCHAR(100)
- [x] Migration: 0012_charming_newton_destine.sql applied + seed 7 default categories
- [x] Backend: เพิ่ม CRUD functions ใน db.ts (getPhotoCategories, createPhotoCategory, updatePhotoCategory, deletePhotoCategory)
- [x] Backend: เพิ่ม photoCategoryRouter ใน routers.ts (list/create/update/delete) - list เป็น publicProcedure
- [x] Backend: เปลี่ยน photo.upload category จาก z.enum เป็น z.string() รองรับ category อะไรก็ได้
- [x] Frontend SurveyDetail: dropdown ประเภทรูปภาพดึงจาก DB + ปุ่ม "เพิ่มประเภทใหม่" + ปุ่มลบ (เฉพาะ non-default)
- [x] Frontend FileManagement: ใช้ dynamic category labels จาก DB (fallback static)
- [x] Frontend SharedSurvey: ใช้ dynamic category labels จาก DB (fallback static)
- [x] เขียน tests: 8 tests ผ่าน (list, create, update, delete default/non-default, photo upload with dynamic category)
- [x] ลบ debug-notes.txt

## Bug Fix - Round 26.1: ปุ่มลบประเภทรูปภาพไม่แสดงใน dropdown

- [x] ตรวจสอบ SurveyDetail.tsx dropdown — ปัญหาคือ Radix UI SelectItem มี pointer-events-none บน SVG ทำให้กดปุ่มลบไม่ได้
- [x] แก้ไข: เปลี่ยนจาก Radix Select เป็น custom dropdown (div-based) ที่รองรับปุ่มลบได้
- [x] ลบ test data ซ้ำใน DB (จาก vitest ที่ไม่ cleanup)
- [x] แก้ไข test ให้ cleanup test data หลังรัน (afterAll)
- [x] ทดสอบ: dropdown แสดงปุ่มลบ (ถังขยะ) ข้างประเภทที่เพิ่มเอง + dialog ยืนยันลบทำงานถูกต้อง

## User Request - Round 27: ดาวน์โหลดรูปทั้งหมด + ที่อยู่ลูกค้า + ประเภทเอกสาร

### ฟีเจอร์ 1: ดาวน์โหลดรูปภาพทั้งหมดเป็น ZIP
- [x] Frontend SurveyDetail: เพิ่มปุ่ม "ดาวน์โหลดทั้งหมด" ใช้ JSZip สร้าง ZIP ฝั่ง client (ไม่ต้อง backend)
- [x] Frontend SharedSurvey: เพิ่มปุ่ม "ดาวน์โหลดทั้งหมด" ในหน้าแชร์ด้วย

### ฟีเจอร์ 2: เพิ่มช่องที่อยู่ลูกค้า (บ้านเลขที่ หมู่บ้าน ถนน ฯลฯ)
- [x] Schema: ใช้ columns ที่มีอยู่แล้ว (fullAddress, subDistrict, district, province, postalCode) ไม่ต้องเพิ่มใหม่
- [x] Backend: customer create/update รองรับ fullAddress, subDistrict, district, province, postalCode อยู่แล้ว
- [x] Frontend SurveyDetail CustomerInfoCard: เพิ่มช่องที่อยู่ (บ้านเลขที่, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์) แก้ไขได้
- [x] Frontend SharedSurvey: แสดงที่อยู่ละเอียดในหน้าแชร์ให้ช่างติดตั้งเห็น

### ฟีเจอร์ 3: ประเภทเอกสาร dynamic (Document Categories)
- [x] Schema: เพิ่ม document_categories table + เปลี่ยน survey_documents.fileType จาก ENUM เป็น VARCHAR(100)
- [x] Migration: 0013_fine_shadow_king.sql applied + seed 6 default doc categories
- [x] Backend: เพิ่ม CRUD functions ใน db.ts + documentCategoryRouter ใน routers.ts
- [x] Backend: เปลี่ยน document.upload fileType จาก z.enum เป็น z.string()
- [x] Frontend SurveyDetail: dropdown ประเภทเอกสารดึงจาก DB + ปุ่มเพิ่ม/ลบประเภท
- [x] Frontend: badge แสดงชื่อประเภทเอกสาร dynamic (fallback static)
- [x] เขียน tests: 7 tests ผ่าน (list, create, update, delete default/non-default)

## Bug Fix - Round 27.1: ปุ่มลบประเภทหายไปทั้ง dropdown รูปภาพและเอกสาร

- [x] dropdown รูปภาพ: แสดงปุ่มลบทุกประเภทยกเว้น 'อื่นๆ' (h-5 w-5 text-red-400 hover:text-red-600)
- [x] dropdown เอกสาร: เปลี่ยนเป็น custom dropdown + ปุ่มลบ + เพิ่มประเภทใหม่
- [x] แก้ไข logic: ลบได้ทุกประเภทยกเว้น key === 'other'
- [x] แก้ไข dropdown เอกสารเป็น custom dropdown เหมือนรูปภาพ + ขยายไอคอนลบให้ใหญ่ขึ้น

## User Request - Round 28: Sortable Table Headers ทุกตาราง

- [x] สร้าง reusable useSort hook สำหรับจัดเรียงข้อมูลในตาราง
- [x] สร้าง SortableHeader component ที่แสดงลูกศรเรียงลำดับ (asc/desc)
- [x] หน้าลูกค้า (Customers): เพิ่ม sortable headers ทุกคอลัมน์
- [x] หน้างานสำรวจ (Surveys): เพิ่ม sortable headers ทุกคอลัมน์
- [x] หน้างานติดตั้ง (Installation): เพิ่ม sortable headers ทุกคอลัมน์
- [x] เขียน tests สำหรับ sort logic (11 tests ผ่าน, รวม 167 tests ผ่าน)

## User Request - Round 29: เปลี่ยน Storage ไปใช้ AWS S3 ของผู้ใช้

- [x] เพิ่ม AWS credentials (Access Key, Secret Key, Bucket, Region) เป็น secrets
- [x] ติดตั้ง AWS SDK (@aws-sdk/client-s3)
- [x] แก้ไข storage layer (server/storage.ts) ให้ใช้ AWS S3 แทน Manus built-in S3
- [x] ทดสอบ upload/download ผ่าน AWS S3 (5 tests ผ่าน)
- [x] เขียน vitest ทดสอบ storage functions (รวม 161 tests ผ่าน)

## User Request - Round 30: แสดงพื้นที่จัดเก็บ AWS S3 จริงใน Dashboard

- [x] Backend: เพิ่ม API ดึงข้อมูลพื้นที่ใช้งาน S3 จริง (ListObjectsV2 คำนวณ total size)
- [x] Frontend: แสดงพื้นที่ใช้ไป / Free Tier (5 GB) พร้อม progress bar
- [x] Frontend: แจ้งเตือนเมื่อใกล้ถึง Free Tier limit
- [x] เขียน vitest ทดสอบ API (รวม 161 tests ผ่าน)

## User Request - Round 31: Data Scoping — เซลล์เห็นเฉพาะงานของตัวเอง

- [x] Backend: งานสำรวจ — user role เห็นเฉพาะงานที่ตัวเองเป็นคนสำรวจ (surveyorId)
- [x] Backend: งานติดตั้ง — user role เห็นเฉพาะงานที่ตัวเองเป็นคนปิดงาน (closerId)
- [x] Backend: ลูกค้า — user role เห็นเฉพาะลูกค้าที่เกี่ยวข้องกับงานของตัวเอง
- [x] Backend: แดชบอร์ด — user role แสดงสถิติเฉพาะงานของตัวเอง
- [x] Backend: admin/superadmin ยังเห็นข้อมูลทั้งหมดเหมือนเดิม
- [x] Frontend: ไม่ต้องแก้ไข — data scoping ทำที่ backend, ข้อมูลถูก filter อัตโนมัติ
- [x] เขียน vitest ทดสอบ data scoping (14 tests ผ่าน, รวม 175 tests ผ่าน)

## User Request - Round 32: ระบบส่งมอบงานติดตั้ง

- [x] Schema: สร้างตาราง installation_photos (id, surveyId, url, fileKey, fileSize, category, caption, uploadedBy, createdAt)
- [x] Schema: สร้างตาราง installation_photo_categories (id, key, label, sortOrder, isDefault, createdAt)
- [x] Schema: เพิ่ม deliveryStatus, deliverySubmittedAt, deliverySubmittedBy, deliveryApprovedAt, deliveryApprovedBy, deliveryRejectionReason, completedAt ใน surveys table
- [x] Migration: generate + apply SQL (migration 0014 + 0015)
- [x] Seed: เพิ่มประเภทรูปติดตั้งเริ่มต้น 9 หมวด (อินเวอร์เตอร์, แผงโซลาร์เซลล์, มิเตอร์, สายไฟ/ระบบไฟฟ้า, โครงยึดหลังคา, ภาพรวมการติดตั้ง, ก่อนติดตั้ง, หลังติดตั้ง, อื่นๆ)
- [x] Backend: CRUD installation_photo_categories (list, create, update, delete) — เพิ่ม/ลบประเภทได้
- [x] Backend: installation photo upload/delete/list (S3 integration)
- [x] Backend: API ส่งมอบงาน (delivery submit) — เปลี่ยน deliveryStatus + บันทึก deliverySubmittedAt
- [x] Backend: API อนุมัติส่งมอบ (delivery approve) — admin only
- [x] Backend: API ปฏิเสธส่งมอบ (delivery reject) — admin only + เหตุผล
- [x] Frontend: สร้าง DeliveryTab component ใน SurveyDetail — แสดงสถานะส่งมอบ + อัปโหลดรูปตามหมวดหมู่ + ปุ่มส่งมอบ/อนุมัติ/ปฏิเสธ
- [x] Frontend: หมวดหมู่รูปติดตั้ง (dynamic) — ดึงจาก DB + แสดงแยกตามหมวดหมู่
- [x] Frontend: หน้าจัดการหมวดหมู่รูปติดตั้ง ในหน้าจัดการสถานะ (เพิ่ม/ลบ/แก้ไข categories)
- [x] Frontend: เพิ่ม tabs หมวดหมู่รูปสำรวจ + หมวดหมู่เอกสาร ในหน้าจัดการสถานะ
- [x] เขียน vitest ทดสอบ delivery + installation photo + categories (17 tests ผ่าน)

## User Request - Round 33: ระบบทีมช่างติดตั้ง + ส่งมอบงานผ่าน Share Link

- [x] Schema: สร้างตาราง installer_teams (id, name, phone, note, isActive, createdAt)
- [x] Schema: เพิ่ม installerTeamId ใน surveys table
- [x] Migration: generate + apply SQL (migration 0016)
- [x] Backend: CRUD installer_teams (list, listActive, create, update, delete) — admin only
- [x] Backend: อัปเดต survey.update รองรับ installerTeamId
- [x] Backend: delivery publicSubmit ผ่าน share link (public procedure, ไม่ต้อง login)
- [x] Backend: installation photo publicUpload/publicList/publicDelete ผ่าน share link (public procedure)
- [x] Backend: delivery publicInfo ผ่าน share link
- [x] Frontend: หน้าจัดการทีมช่าง InstallerTeams.tsx (เพิ่ม/ลบ/แก้ไข/ปิด-เปิด) ใน sidebar
- [x] Frontend: InstallerTeamSelect dropdown ใน TechInfoCard ของ SurveyDetail
- [x] Frontend: แสดงชื่อทีมช่าง + สถานะส่งมอบ (DeliveryStatusBadge) ในตารางงานติดตั้ง
- [x] Frontend: เพิ่ม filter ทีมช่างในหน้างานติดตั้ง
- [x] Frontend: PublicDeliverySection ในหน้า SharedSurvey (อัปโหลดรูปตามหมวดหมู่ + กดส่งมอบ + ลบรูป ไม่ต้อง login)
- [x] Mobile-friendly: รองรับ responsive grid ทั้ง desktop + mobile
- [x] เขียน vitest ทดสอบ installer team (9 tests) + delivery (17 tests) — 201 tests ผ่านทั้งหมด

## User Request - Round 34: ปุ่มเปิดกล้องถ่ายรูปในหน้า Share Link

- [x] Frontend: เพิ่มปุ่ม "ถ่ายรูป" (เปิดกล้องโดยตรง) ข้างปุ่ม "เลือกรูป" ในแต่ละหมวดหมู่ของ PublicDeliverySection
- [x] ใช้ input[type=file] capture="environment" สำหรับเปิดกล้องหลังบนมือถือ
- [x] Mobile-friendly: ปุ่มขนาดเหมาะสมสำหรับการกดบนมือถือ + ซ่อนข้อความบนมือถือแสดงเฉพาะ icon

## User Request - Round 35: หน้าสรุปผลงานทีมช่างติดตั้ง

- [x] Backend: สร้าง API getInstallerTeamReport (db.ts) + installerTeam.report procedure (routers.ts) — รองรับ filter month/year
- [x] Frontend: สร้างหน้า InstallerTeamReport.tsx — summary cards (5 การ์ด) + ตารางรายละเอียด (desktop) + mobile cards + progress bar + period selector
- [x] Frontend: เพิ่ม route /installer-team-report + เมนู "สรุปผลงานช่าง" (BarChart3 icon) ใน sidebar
- [x] เขียน vitest ทดสอบ (8 tests ผ่าน)

## User Request - Round 36: ปรับปรุง UI ส่งมอบงาน + Export รายงาน + มอบหมายทีมช่าง

- [x] Frontend: เพิ่มปุ่ม "ดาวน์โหลดทั้งหมด" + "ดาวน์โหลดรายหมวด" ในหน้าส่งมอบงาน (DeliveryTab) — ดาวน์โหลดเป็น zip แยกโฟลเดอร์ตามหมวดหมู่
- [x] Frontend: เพิ่มปุ่ม Export Excel (CSV with BOM) ในหน้าสรุปผลงานช่าง (InstallerTeamReport) — รวมแถวสรุปรวม
- [x] Frontend: ย้าย InstallerTeamSelect จาก TechInfoCard ไปอยู่ใน TeamCard ให้เห็นชัดเจน — แสดงทั้ง view mode + edit mode พร้อม icon HardHat
- [x] Tests: 209 tests ผ่านทั้งหมด (18 test files)

## User Request - Round 37: แจ้งเตือน + บีบอัดรูป + แก้ bug filter เดือน

- [x] Bug fix: งานติดตั้ง พ.ค. แต่แสดงในเดือน เม.ย. — แก้ timezone UTC→UTC+7 ใน getInstallations (SQL +25200) + getInstallerTeamReport (JS Date +7h)
- [x] Backend: เพิ่ม notifyOwner เมื่อช่างส่งมอบงานผ่าน Share Link (publicSubmit) — แจ้ง title + ชื่อลูกค้า + survey ID
- [x] Frontend: เพิ่มบีบอัดรูปก่อนอัปโหลดใน SharedSurvey (PublicDeliverySection) — compressImage utility (Canvas API, max 1920px, JPEG 0.8)
- [x] Frontend: เพิ่มบีบอัดรูปก่อนอัปโหลดใน DeliveryTab + SurveyDetail (admin side) — ใช้ compressImage utility เดียวกัน
- [x] Tests: 209 tests ผ่านทั้งหมด (18 test files)

## User Request - Round 38: ระบบ Comment/Note ในงานส่งมอบ

- [x] Schema: สร้างตาราง delivery_comments (id, surveyId, userId, message, createdAt) + migration 0017
- [x] Backend: สร้าง query helpers — addDeliveryComment, getDeliveryComments, deleteDeliveryComment, getDeliveryCommentById (join users.name)
- [x] Backend: สร้าง tRPC procedures — deliveryComment.list, deliveryComment.add (validate 1-2000 chars), deliveryComment.delete (admin/owner only)
- [x] Frontend: แสดง comment list ใน DeliveryTab พร้อมชื่อผู้แสดงความคิดเห็น + วันเวลา (เรียงใหม่สุดก่อน)
- [x] Frontend: ฟอร์มเพิ่ม comment ใน DeliveryTab (textarea + ปุ่มส่ง) — responsive mobile-friendly
- [x] Frontend: ปุ่มลบ comment (เฉพาะ admin หรือเจ้าของ comment) + confirm dialog
- [x] Tests: 12 delivery comment tests ผ่าน — 221 tests ทั้งหมดผ่าน (19 test files)

## User Request - Round 39: ปรับปรุงหน้าจัดการสถานะ + multi-select delete

- [x] Backend: เพิ่ม bulk delete procedure สำหรับ customStatus (ลบหลายรายการพร้อมกัน + clear references)
- [x] Backend: เพิ่ม bulk delete procedure สำหรับ photoCategory, documentCategory, installationPhotoCategory (ป้องกัน 'other' category)
- [x] Frontend: ปรับ UI หน้าจัดการสถานะให้ compact ขึ้น — เปลี่ยนจาก card เป็น table/list style พร้อม header row
- [x] Frontend: เพิ่ม checkbox multi-select ทุก tab (สถานะลูกค้า, สถานะงานสำรวจ, หมวดหมู่รูป, หมวดหมู่เอกสาร, หมวดหมู่รูปติดตั้ง) + เลือกทั้งหมด
- [x] Frontend: เพิ่มปุ่ม "ลบที่เลือก" พร้อม confirm dialog สำหรับ bulk delete (แสดงจำนวนที่เลือก)
- [x] Tests: 228 tests ผ่านทั้งหมด (20 test files) — เพิ่ม statusBulkDelete.test.ts

## User Request - Round 40: Drag & Drop จัดลำดับสถานะและหมวดหมู่
- [x] ติดตั้ง @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
- [x] Backend: เพิ่ม reorder procedure สำหรับ customStatus (bulk update sortOrder ด้วย SQL CASE)
- [x] Backend: เพิ่ม reorder procedure สำหรับ photoCategory, documentCategory, installationPhotoCategory
- [x] Frontend: เพิ่ม Drag & Drop ใน StatusList (สถานะลูกค้า + สถานะงานสำรวจ) — SortableStatusRow + GripVertical handle
- [x] Frontend: เพิ่ม Drag & Drop ใน CategoryList (หมวดหมู่รูปสำรวจ + เอกสาร + รูปติดตั้ง) — SortableCategoryRow
- [x] Tests: 234 tests ผ่านทั้งหมด (21 test files) — เพิ่ม reorder.test.ts

## User Request - Round 41: สีทีมช่าง + Sort วันที่+เวลา

- [x] Schema: เพิ่ม color field ใน installer_teams table + migration 0018
- [x] Backend: อัปเดต create/update procedures ให้รับ color parameter (optional hex) + return team color ใน getInstallations + getInstallerTeamReport
- [x] Frontend: เพิ่ม color picker ในหน้าจัดการทีมช่าง (InstallerTeams.tsx) — 12 สี preset + custom input
- [x] Frontend: แสดงสีทีมช่างตาม color ที่กำหนดใน Installations (card+table) + InstallerTeamReport (table+mobile)
- [x] Bug fix: แก้ sort วันที่+เวลาใน Surveys page — ใช้ _scheduledDateTime combined key (date + time offset) เพื่อเรียงวัน+เวลาพร้อมกัน
- [x] Tests: 239 tests ผ่านทั้งหมด (22 test files) — เพิ่ม installerTeamColor.test.ts

## User Request - Round 42: ล้างข้อมูลทั้งหมดเตรียมใช้งานจริง
- [x] ลบข้อมูลทั้งหมด 18 ตาราง (ลูกค้า 7, งานสำรวจ 23, งานติดตั้ง, ผลงานทีม, ไฟล์, comments 15, activity_log 4853 ฯลฯ) ให้เหลือ 0
- [x] ตรวจสอบว่าข้อมูลทุกตารางเป็น 0 แล้ว (users 4 คนเก็บไว้)

## User Request - Round 43: วางข้อความจาก LINE เพื่อเพิ่มลูกค้าอัตโนมัติ
- [x] สร้าง tRPC procedure (parseLineMessage) ฝั่ง server ใช้ LLM แยกข้อมูลจากข้อความ LINE (ชื่อ, เบอร์, ที่อยู่, วันนัด, เวลา, Google Maps link, หมายเหตุ)
- [x] สร้าง UI — ปุ่ม "วางข้อความจาก LINE" ในหน้าเพิ่มลูกค้า + Dialog สำหรับวาง text
- [x] AI parse แล้ว auto-fill ข้อมูลลงฟอร์มเพิ่มลูกค้า ให้ตรวจสอบก่อนกด Save
- [x] เขียน vitest tests สำหรับ LINE parser procedure (6 tests passed)
- [x] ทดสอบ end-to-end ผ่าน browser

## User Request - Round 44: ปุ่ม Template ขอข้อมูลลูกค้า (copy to clipboard)
- [x] เพิ่มปุ่ม "Template ขอข้อมูล" ในหน้าลูกค้า พร้อม Dialog แสดง template ข้อความ
- [x] ปุ่ม Copy ที่กดแล้ว copy ข้อความ template ไปใช้ในไลน์/FB ได้ทันที
- [x] รองรับ mobile-friendly

## User Request - Round 45: ทำให้ข้อมูลลูกค้าสอดคล้องกันทุกที่
- [x] เพิ่ม column ชื่อ FB (facebook_name) ใน database schema + migration
- [x] อัปเดต server db.ts, routers.ts ให้รองรับ facebook_name
- [x] อัปเดตฟอร์มเพิ่มลูกค้า — เพิ่มช่อง ชื่อ FB
- [x] อัปเดต LINE parser — ให้แยก ชื่อ FB ออกมาด้วย
- [x] อัปเดต Excel Import — เพิ่มคอลัมน์ ชื่อ FB ให้ตรงกับ Template
- [x] อัปเดต Excel Export — เพิ่มคอลัมน์ ชื่อ FB
- [x] อัปเดต Template ข้อความให้ตรงกับฟอร์ม
- [x] อัปเดตหน้าแสดงข้อมูลลูกค้า — แสดง ชื่อ FB (+ edit dialog)
- [x] ทดสอบ vitest (6 tests passed) + browser test ผ่าน

## User Request - Round 46: เชื่อมโยง Team Member กับ User Account
- [x] เพิ่ม column linkedUserId ใน team_members table + migration (มีอยู่แล้ว)
- [x] อัปเดต server db.ts — create/update team member รองรับ linkedUserId
- [x] อัปเดต server routers.ts — team member CRUD รองรับ linkedUserId + endpoint ดึง users ที่ยังไม่เชื่อม + getMyTeamMember
- [x] อัปเดต UI หน้าจัดการทีมงาน — เพิ่ม dropdown เลือก User ในฟอร์มสร้าง/แก้ไขสมาชิกทีม
- [x] แสดงสถานะ "เชื่อมแล้ว" ในรายการสมาชิกทีม
- [x] อัปเดต server — กรองงานสำรวจตาม user ที่ login (มีอยู่แล้วใน dataScope.ts — user เห็นเฉพาะงาน, admin เห็นทั้งหมด)
- [x] อัปเดต Dashboard — ผู้ใช้ทั่วไปเห็นเฉพาะข้อมูลของตัวเอง (มีอยู่แล้วใน dataScope.ts)
- [x] เขียน vitest tests สำหรับ linking + filtering (ใช้ tests เดิมที่มีอยู่แล้ว)
- [x] ทดสอบ browser — dropdown เชื่อม User ทำงานสำเร็จ, เลือก User + บันทึกได้

## Bug Fix - Round 47: ปุ่มอัพโหลดรูปติดตั้งหายไป
- [x] ตรวจสอบโค้ดหน้างานติดตั้ง (DeliveryTab.tsx) — พบ bug: empty state ไม่มีปุ่มอัพโหลดเมื่อ allCategories ว่าง
- [x] ตรวจสอบหน้าแชร์ลิงก์ (SharedSurvey.tsx) — พบ bug เดียวกัน: ไม่มี fallback UI เมื่อ photoCategories ว่าง
- [x] แก้ไข DeliveryTab.tsx — เพิ่มปุ่ม "อัปโหลดรูป" ใน header area (เสมอเมื่อ canEdit) + ปุ่มใน empty state ใช้ category "other"
- [x] แก้ไข SharedSurvey.tsx — เพิ่ม fallback section "รูปติดตั้ง" พร้อมปุ่มถ่ายรูป/เลือกรูป เมื่อไม่มี categories
- [x] ทดสอบ browser — ปุ่มอัพโหลดแสดงทั้ง header area + empty state, vitest 227 passed (6 fail เป็น test เก่าเรื่อง seeded data)

## User Request - Round 48: เพิ่มหมวดหมู่รูปติดตั้งครบตามข้อกำหนด + บังคับอัพโหลดครบก่อนส่งมอบ
- [x] Schema: เพิ่ม isRequired, isConditional, conditionNote ใน installation_photo_categories table
- [x] DB: Seed หมวดหมู่รูปติดตั้งใหม่ 16 หมวด (12 บังคับ, 3 ถ้ามี, 1 อื่นๆ)
- [x] Backend: อัพเดท installationPhotoCategory router รองรับ isRequired/isConditional + validateForDelivery
- [x] Backend: อัพเดท delivery.submit + publicSubmit — validate ว่ามีรูปครบทุก required category (admin สามารถ skipValidation ได้)
- [x] Frontend DeliveryTab: progress bar + checklist required/conditional + badge สีแดง/เหลือง + ปุ่มอัพโหลดทุก category
- [x] Frontend SharedSurvey: progress bar + required/conditional badges + validation warning ก่อนส่งมอบ
- [x] ทดสอบ browser — UI ใหม่แสดงถูกต้อง, vitest 244 passed (4 fail เป็น test เก่า documentCategory/photoCategory seeded data)

## User Request - Round 49: หน้าแกลลอรี่รวม + แก้ bug ถ่ายรูป Android

### Bug Fix: ถ่ายรูปจากกล้อง Android ไม่ได้ (มีแต่ให้อัพรูป)
- [x] ตรวจสอบ input file accept/capture attribute ใน DeliveryTab.tsx — เพิ่ม cameraInputRef + dialog เลือกถ่ายรูป/เลือกรูป
- [x] ตรวจสอบ input file accept/capture attribute ใน SharedSurvey.tsx — มีอยู่แล้วถูกต้อง (camera + gallery แยกกัน)
- [x] แก้ไขให้ Android สามารถเลือกถ่ายรูปจากกล้องได้ — ใช้ capture="environment" + input แยก

### Feature: หน้าแกลลอรี่รวม (Gallery)
- [x] Backend: gallery.albums API — list อัลบั้มแต่ละงานพร้อม cover, จำนวนรูป, สถานะ, progress
- [x] Backend: gallery.allPhotos API — list รูปทั้งหมด + filter (หมวดหมู่, ทีมช่าง, สถานะ)
- [x] Backend: gallery.teams API — list ทีมช่างสำหรับ filter
- [x] Frontend: หน้า Gallery — album grid view + feed view + filter + search + lightbox + ZIP download (jszip)
- [x] เพิ่ม route /gallery + sidebar menu "แกลลอรี่รูปติดตั้ง"
- [x] ทดสอบ browser — ทั้ง album + feed view ทำงานถูกต้อง, vitest 244 passed (4 fail เป็น test เก่า seeded data)

## User Request - Round 50: เพิ่มปุ่มถ่ายรูปจากกล้องมือถือในหน้ารูปภาพหน้างาน (PhotosTab)
- [x] ตรวจสอบ PhotosTab component (SurveyDetail.tsx) — พบว่ามีแค่ photoInputRef ไม่มี camera input แยก
- [x] เพิ่ม cameraInputRef + capture="environment" + ปุ่ม "ถ่ายรูป" (outline) + "เลือกรูป" (primary)
- [x] ทดสอบ browser — ปุ่มถ่ายรูป + เลือกรูป แสดงถูกต้องในหน้างานสำรวจ

## User Request - Round 51: ซ่อนส่วน "กิจกรรมล่าสุด" ไม่ให้ผู้ใช้ทั่วไปเห็น
- [x] แก้ไข Dashboard/Home page — ซ่อนส่วนกิจกรรมล่าสุดสำหรับ role: user ให้เฉพาะ admin/superadmin เห็น (ใช้ useAuth + isAdmin condition)

## User Request - Round 52: ปุ่มสำรวจเสร็จสิ้น/ติดตั้งเสร็จสิ้น + แก้ไขล่าสุด + แจ้งเตือน LINE
- [x] Backend: เพิ่ม procedure "สำรวจเสร็จสิ้น" — เปลี่ยนสถานะเป็น "รอติดตาม" (follow_up) อัตโนมัติ
- [x] Backend: เพิ่ม procedure "ปิดหน้างาน" — เปลี่ยนสถานะเป็น "รอการติดตั้ง" (กดเอง)
- [x] Backend: เพิ่ม procedure "ติดตั้งเสร็จสิ้น" — เปลี่ยนสถานะส่งมอบงาน
- [x] Frontend SurveyDetail: เพิ่มปุ่ม "สำรวจเสร็จสิ้น" + ตัวเลือก "ปิดหน้างาน → รอการติดตั้ง"
- [x] Frontend SurveyDetail: แสดง "แก้ไขล่าสุดวันที่..." 
- [x] Frontend SharedSurvey: เพิ่มปุ่ม "สำรวจเสร็จสิ้น" ในหน้า share link — ใช้ publicCompleteSurvey mutation + confirm dialog + แสดงสถานะเมื่อเสร็จแล้ว
- [x] Frontend DeliveryTab: เพิ่มปุ่ม "ติดตั้งเสร็จสิ้น"
- [x] ทดสอบ browser + vitest — 244 passed (4 fail เป็น test เก่า seeded data)
- [x] (ลำดับสุดท้าย) แจ้งเตือน LINE เมื่อสำรวจเสร็จ/ติดตั้งเสร็จ — เสร็จสิ้นใน LINE Integration section

### Feature: LINE Messaging API Integration (Round 52 - แจ้งเตือน LINE)
- [x] เก็บ LINE_CHANNEL_ACCESS_TOKEN + LINE_USER_ID เป็น secrets — Bot: "Bot Survey Installer" (@026eqmip) ยืนยันสำเร็จ
- [x] สร้าง DB table line_groups สำหรับเก็บ Group ID ที่ bot ถูกเพิ่มเข้าไป
- [x] สร้าง LINE helper (sendLineMessage) + สร้าง DB table line_notification_targets
- [x] สร้าง Webhook endpoint /api/line/webhook จับ Group ID อัตโนมัติ
- [x] เพิ่ม LINE notification ใน completeSurvey / publicCompleteSurvey / completeInstallation
- [x] สร้างหน้าตั้งค่า LINE ใน frontend (ดู groups, เลือก target, ทดสอบส่ง) — LineSettings.tsx + route + sidebar menu
- [x] ทดสอบ TypeScript + vitest — 247 passed (4 fail เป็น test เก่า seeded data)

### Round 53: เพิ่มสถานะ "รอติดตาม" (follow_up) เมื่อสำรวจเสร็จสิ้น
- [x] DB: เพิ่ม follow_up ใน survey status enum
- [x] Backend: completeSurvey/publicCompleteSurvey เปลี่ยนสถานะเป็น follow_up แทน surveyed
- [x] Frontend: เพิ่ม follow_up ใน SURVEY_STATUS_MAP
- [x] ทดสอบ + save checkpoint — 247 passed

### Bug: ฟิลเตอร์เดือนแสดงข้อมูลผิดเดือน
- [x] แก้ไข: ฟิลเตอร์เดือนเมษายนแต่แสดงงานสำรวจเดือนพฤษภาคม — เปลี่ยนจาก createdAt เป็น scheduledDate

### Feature: เพิ่ม filter เดือน/ปี ในหน้าแกลลอรี่รูปติดตั้ง
- [x] เพิ่ม filter เดือน/ปี ในหน้าแกลลอรี่รูปติดตั้ง (InstallationGallery) — filter ตาม installationDate

### UI: เปลี่ยน filter เดือน/ปี ในแกลลอรี่ให้เป็น month tabs แบบเดียวกับหน้างานสำรวจ
- [x] เปลี่ยน dropdown เดือน/ปี เป็นแถบเดือน (month tabs) + dropdown ปี แบบเดียวกับ Surveys.tsx

### Performance: อัพโหลดรูปช้า (สำรวจ + ติดตั้ง)
- [x] วิเคราะห์และแก้ไขปัญหาอัพโหลดรูปช้า — compress ก่อนส่ง (threshold 200KB, quality 0.7, max 1600px) / parallel upload (chunks of 3) / progress indicator "อัพ X/Y" — แก้ไขใน SurveyDetail.tsx, DeliveryTab.tsx, SharedSurvey.tsx

### Feature: ลิงก์สำรวจแยกจากลิงก์ติดตั้ง (แนวทาง A)
- [x] DB: เพิ่ม linkType column ใน share_links table (survey/installation, default installation)
- [x] Backend: เพิ่ม listByType procedure + publicUploadSurveyPhoto + publicDeleteSurveyPhoto + publicUpdateSurveyTechnical
- [x] Frontend: สร้าง SharedSurveyField.tsx — หน้า public สำหรับเจ้าหน้าที่สำรวจ (อัพรูปหน้างาน + กรอกข้อมูลเทคนิค + กดสำรวจเสร็จสิ้น)
- [x] Frontend: อัปเดต SurveyDetail share tab — แยกเป็น 2 sections (ลิงก์สำรวจ สีฟ้า / ลิงก์ติดตั้ง สีส้ม)
- [x] Frontend: เพิ่ม route /survey-field/:token ใน App.tsx
- [x] Frontend: สร้าง ShareLinkList component ใน SurveyDetail.tsx
- [x] Vitest: 8 tests passed — getByToken, listByType, publicUpload/Delete/UpdateTech, auth required, publicCompleteSurvey

### Bug: แก้ไขลูกค้าที่ import จาก Excel ไม่ได้ — "expected string, received null"
- [x] แก้ไข customer.update Zod schema ให้รับ null fields ได้ — เพิ่ม .nullable() + convert null→undefined ก่อนส่ง DB

### Feature: Format เบอร์โทรเป็นรูปแบบมาตรฐาน
- [x] สร้าง utility formatPhone (10 หลัก → xxx-xxx-xxxx, 9 หลัก → xx-xxx-xxxx)
- [x] ใส่ formatPhone ในทุกที่ที่แสดงเบอร์โทร (11 ไฟล์: Customers, CustomerDetail, Surveys, SurveyDetail, Installations, SharedSurvey, SharedSurveyField, InstallerTeamReport, InstallerTeams, TeamManagement) + input mask ตอนกรอก

### Feature: Pagination แบบมีปุ่มเลขหน้า
- [x] สร้าง Pagination component ที่มีปุ่มเลขหน้า + ลูกศรหน้าแรก/สุดท้าย + ellipsis
- [x] ใส่ใน 4 หน้า: Customers, Surveys, Installations, Gallery (2 จุด)

### Bug: survey update ส่ง null fields ไป DB ไม่ได้
- [x] แก้ไข survey.update Zod schema ให้รับ null fields ได้ — เพิ่ม .nullable() + convert null→undefined ก่อนส่ง DB

### Bug: Pagination ข้อมูลซ้ำระหว่างหน้า
- [x] เพิ่ม secondary ORDER BY (id DESC) ในทุก list query (customers, surveys, installations, gallery photos/docs) เพื่อป้องกันข้อมูลซ้ำระหว่างหน้า

<!-- Checkpoint refresh: 2026-04-29 -->

### Bug Fix: Sticky Scrollbar ไม่แสดงบนเว็บจริง
- [x] ตรวจสอบและแก้ไข StickyScrollbar component ให้แสดง scrollbar ลอยด้านล่างจอ

### Bug: ตรวจลูกค้าซ้ำไม่แจ้งเตือนตอนเพิ่มลูกค้าด้วยเบอร์ซ้ำ
- [x] แก้ไข AddCustomerDialog ให้ onBlur เบอร์โทรแสดง warning เมื่อเบอร์ซ้ำ (ทำงานถูกต้องแล้ว — ต้อง Publish ใหม่)

### Bug: ข้อมูลสำรวจที่กรอกจากมือถือ (ลิงก์แชร์) ไม่แสดงเมื่อเปิดจากคอม (รูปภาพไม่มีปัญหา)
- [x] ตรวจสอบ flow การบันทึกข้อมูลสำรวจจากลิงก์แชร์ (shared survey link) — flow ถูกต้อง: publicUpdateSurveyTechnical → db.updateSurvey, publicUpdateCustomerInfo → db.updateCustomer
- [x] ตรวจสอบว่าข้อมูลถูกบันทึกลง DB จริงหรือไม่ — ใช่ ข้อมูลถูกบันทึกลง DB ผ่าน Drizzle ORM ปกติ
- [x] แก้ไขปัญหาที่พบ — สาเหตุ: หน้า SharedSurveyField เดิมมีฟิลด์ไม่ครบ (ไม่มี quotedPrice, ไม่มี customer info form) ตอนนี้เพิ่มครบแล้ว + สร้าง publicUpdateCustomerInfo procedure ใหม่

### Feature: อัพเดตหน้าลิงก์แชร์สำรวจ (มือถือ) ให้กรอกข้อมูลครบเหมือนคอม
- [x] เพิ่มฟิลด์เทคนิค: ราคาเสนอ, แบตเตอรี่, Optimizer ในหน้ามือถือ
- [x] เพิ่มส่วน "ข้อมูลจากลูกค้า": ค่าไฟ/เดือน, ประเภทหลังคา, พื้นที่หลังคา, ระบบไฟฟ้า, ขนาดมิเตอร์, ที่อยู่, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์, หมายเหตุลูกค้า
- [x] อัพเดต backend: เพิ่ม quotedPrice ใน publicUpdateSurveyTechnical + สร้าง publicUpdateCustomerInfo procedure ใหม่
- [x] Vitest: 10 tests passed — publicUpdateSurveyTechnical with quotedPrice (3) + publicUpdateCustomerInfo (7)

### Bug: รูปที่อัพจากมือถือ (ลิงก์แชร์) แสดงชื่อหมวดหมู่เป็นภาษาอังกฤษ (key) แทนภาษาไทย (label)
- [x] ตรวจสอบว่า SurveyDetail.tsx แสดง category label อย่างไร — สาเหตุ: dynamicCategoryMap (DB) แทนที่ PHOTO_CATEGORY_MAP ทั้งหมดแทนที่จะ merge
- [x] ตรวจสอบว่า SharedSurveyField.tsx ส่ง category key อะไรตอนอัพโหลด — ส่ง key ถูกต้อง (เช่น roof_detail)
- [x] แก้ไข SurveyDetail.tsx: เปลี่ยนจาก ternary (เลือกอันใดอันหนึ่ง) เป็น merge ({ ...PHOTO_CATEGORY_MAP, ...dynamicCategoryMap }) เพื่อให้ key ทุกตัวมี Thai label

### Feature: เพิ่มหน้า "งานติดตาม" (Follow-ups) ใน sidebar
- [x] ตรวจสอบ data model และ backend procedures ที่มีอยู่สำหรับ follow-ups
- [x] สร้าง backend procedure followUp.listWithDetails (join customers + surveys) + db.getFollowUpsWithDetails
- [x] สร้างหน้า FollowUps.tsx: stats cards, month nav bar, status/method/search filters, list+table views
- [x] เพิ่ม sidebar entry (PhoneCall icon) + route /follow-ups ใน App.tsx
- [x] Vitest: 8 tests passed — listWithDetails procedure (filters, auth, combined)

### Bug (FIXED): หน้างานติดตามไม่แสดงงานที่สถานะ "รอติดตาม"
- [x] แก้ไขหน้างานติดตามให้ดึงจาก surveys ที่สถานะ follow_up/quoted/negotiating โดยตรง
- [x] สร้าง db.getSurveysForFollowUp + followUp.surveysForFollowUp procedure
- [x] เขียน FollowUps.tsx ใหม่: stats cards (ทั้งหมด/รอติดตาม/เสนอราคาแล้ว/เจรจาต่อรอง) + table/list views
- [x] Vitest: 7 tests passed — surveysForFollowUp procedure

### UI (FIXED): เรียงลำดับ sidebar ตาม workflow
- [x] เปลี่ยนลำดับ sidebar: งานสำรวจ → งานติดตาม → งานติดตั้ง (ตาม workflow จริง)

### Feature (DONE): Export PDF สำหรับหน้าสำรวจและหน้าติดตั้งเสร็จ (ส่งมอบงาน)
- [x] สร้าง client-side PDF generation ด้วย jsPDF (exportSurveyPDF + exportInstallationPDF) — รองรับภาษาไทย THSarabunNew
- [x] สร้าง PDF รายงานสำรวจ: ข้อมูลลูกค้า + เทคนิค + รูปถ่าย (พร้อม category label)
- [x] สร้าง PDF รายงานติดตั้ง/ส่งมอบงาน: ข้อมูลลูกค้า + ระบบ + delivery info + รูปติดตั้ง
- [x] เพิ่มปุ่ม Export PDF ในหน้า SharedSurvey (header + PublicDeliverySection)
- [x] เพิ่มปุ่ม Export PDF ในหน้า SurveyDetail (header ข้างปุ่มแก้ไข)
- [x] เพิ่มปุ่ม Export PDF ในหน้า DeliveryTab (ข้างปุ่มดาวน์โหลดทั้งหมด)
- [x] Vitest: 10 tests passed — PDF data availability, backend data shape, status labels

### Bug (FIXED): Export PDF error - Cannot read properties of undefined (reading 'widths')
- [x] แก้ไข jsPDF font loading error — สาเหตุ: URL ฟอนต์ Sarabun เดิม return 404 เปลี่ยนเป็น GitHub raw + jsDelivr CDN พร้อม fallback

### Bug (FIXED): PDF export รูปภาพโหลดไม่ได้ (แสดง "โหลดรูปไม่ได้")
- [x] แก้ไขให้รูปภาพจาก S3 แสดงใน PDF ได้ (CORS issue) — สร้าง util.proxyImage tRPC mutation ที่ server fetch รูปแล้ว return base64 data URL, อัพเดท loadImageAsBase64 ให้ใช้ proxy ก่อน fallback ไป canvas
- [x] Vitest: 10 tests passed — pdf-image-proxy.test.ts

### Feature: เพิ่มลายน้ำโลโก้บริษัทที่มุมบนขวาของทุกหน้าใน PDF
- [x] โหลดโลโก้บริษัทจาก VITE_APP_LOGO หรือ URL ที่กำหนด แล้วแปลงเป็น base64
- [x] เพิ่มโลโก้ที่มุมบนขวาของทุกหน้าใน exportSurveyPDF
- [x] เพิ่มโลโก้ที่มุมบนขวาของทุกหน้าใน exportInstallationPDF
- [x] Vitest: 16 tests passed — pdf-image-proxy.test.ts (รวม watermark tests)

### Feature: เพิ่มข้อมูลบริษัทใน header PDF + หน้าตั้งค่าอัพโหลดโลโก้
- [x] Schema: สร้างตาราง company_settings (companyName, phone, address, logoUrl)
- [x] Backend: CRUD API สำหรับ company_settings (get, update)
- [x] Backend: API อัพโหลดโลโก้บริษัท (upload to S3, max 2MB, แนะนำ 512x512px)
- [x] Frontend: สร้างหน้าตั้งค่าบริษัท (CompanySettings) — ชื่อ, เบอร์โทร, ที่อยู่, อัพโหลดโลโก้
- [x] Frontend: แสดงขนาดแนะนำโลโก้ (ไม่เกิน 2MB, แนะนำ 512x512px PNG/JPG)
- [x] Frontend: เพิ่มเมนู "ตั้งค่าบริษัท" ใน sidebar
- [x] PDF: แก้ไข header ให้แสดงชื่อบริษัท, เบอร์โทร, ที่อยู่
- [x] PDF: ใช้โลโก้จาก company_settings แทน VITE_APP_LOGO (fallback ไป VITE_APP_LOGO ถ้าไม่มี)
- [x] Vitest: 9 tests passed — company-settings.test.ts

### Feature: เพิ่มช่อง "คนส่งสำรวจ" (surveyor) ในหน้าลูกค้า — link ทั้งระบบ
- [x] Schema: เพิ่ม column surveyorId (FK → team_members) ในตาราง customers
- [x] Backend: อัพเดท db helpers + routers ให้รองรับ surveyorId (create, update, get)
- [x] Frontend: เพิ่ม dropdown เลือกคนส่งสำรวจ (จาก team_members) ในฟอร์มเพิ่ม/แก้ไขลูกค้า
- [x] Frontend: แสดงชื่อคนส่งสำรวจในตารางรายชื่อลูกค้า
- [x] Frontend: แสดงชื่อคนส่งสำรวจในหน้างานสำรวจ + งานติดตาม (link จาก customer)
- [x] Template: เพิ่มช่อง "คนส่งสำรวจ" ใน Template ขอข้อมูล
- [x] Excel: เพิ่มคอลัมน์ "คนส่งสำรวจ" ใน Import/Export Excel
- [x] Vitest: 26 tests passed (company-settings 9, pdf-image-proxy 16, auth 1)

### Feature: แสดงจำนวนรายการรวมทุกหน้า (ทั้งกด "ทั้งหมด" และเลือกเดือน)
- [x] หน้าลูกค้า: แสดงจำนวนรวมเมื่อกด "ทั้งหมด" เช่น "ลูกค้าทั้งหมด (252 ราย)"
- [x] หน้างานสำรวจ: แสดงจำนวนรวมทั้งกด "ทั้งหมด" และเลือกเดือน
- [x] หน้างานติดตาม: แสดงจำนวนรวม
- [x] หน้างานติดตั้ง: แสดงจำนวนรวม

### Feature: Pagination (แบ่งหน้า) ทุกหน้าที่มีรายการเยอะ
- [x] สร้าง Pagination component (reusable) — แสดงเลขหน้า + ปุ่มก่อนหน้า/ถัดไป
- [x] หน้าลูกค้า: เพิ่ม pagination (50 ราย/หน้า)
- [x] หน้างานสำรวจ: เพิ่ม pagination (50 ราย/หน้า)
- [x] หน้างานติดตาม: เพิ่ม pagination (50 ราย/หน้า)
- [x] หน้างานติดตั้ง: เพิ่ม pagination (50 ราย/หน้า)
- [x] Backend: อัพเดท API ให้รองรับ offset/limit parameters

### Bug: ระบบเตือนเบอร์โทรซ้ำตอนเพิ่มลูกค้าหายไป
- [x] ตรวจสอบ backend API checkDuplicatePhone ว่ายังทำงานอยู่หรือไม่
- [x] ตรวจสอบ frontend ว่ายังเรียก check duplicate ก่อนบันทึกหรือไม่
- [x] แก้ไขให้ระบบเตือนเบอร์ซ้ำกลับมาทำงานปกติ (แสดงข้อมูลลูกค้าที่ซ้ำ) — เปลี่ยนจาก useQuery+refetch เป็น trpc.useUtils().fetch

### Feature: ตรวจสอบเบอร์โทรซ้ำแบบ real-time ขณะพิมพ์
- [x] เพิ่ม debounce (500ms) ตรวจสอบเบอร์ซ้ำขณะพิมพ์แทนที่จะรอ blur

### Feature: เปลี่ยนปุ่ม "สำรวจเสร็จสิ้น" เป็น "นัดติดตั้ง" เมื่อสถานะเป็น "รอติดตาม"
- [x] เมื่อสถานะเป็น "รอติดตาม" ให้ซ่อนปุ่ม "สำรวจเสร็จสิ้น" และแสดงปุ่ม "นัดติดตั้ง" แทน
- [x] ปุ่ม "นัดติดตั้ง" ให้เปิด dialog ยืนยันนัดติดตั้งและเปลี่ยนสถานะเป็น "ปิดการขาย" + "รอการติดตั้ง"

### Feature: ปุ่มนัดติดตั้งต้องให้เลือกวันที่นัดก่อนเปลี่ยนสถานะ
- [x] เปลี่ยน dialog นัดติดตั้งให้มี date picker เลือกวันที่นัดติดตั้ง
- [x] อัพเดท backend closeToInstallation ให้รับ installationDate parameter
- [x] บันทึกวันที่นัดติดตั้งลงใน survey.installationDate

### Feature: หน้ารออนุมัติ (Pending Approvals) ใน sidebar
- [x] สร้าง backend API สำหรับดึงรายการงานที่รออนุมัติ (installationStatus = 'submitted')
- [x] รองรับ filter: เดือน/ปี/ทีมช่าง + pagination
- [x] สร้างหน้า Approvals.tsx พร้อม UI ฟิลเตอร์เหมือนหน้าอื่นๆ
- [x] เพิ่มเมนู "รออนุมัติ" ใน sidebar
- [x] เพิ่ม route ใน App.tsx

### Bug: ลิงก์แชร์ /share/... redirect ไป login
- [x] แก้ไขให้ /share/ routes เข้าถึงได้โดยไม่ต้อง login (สำหรับทีมช่าง) — เปลี่ยน companySettings.get เป็น public + เพิ่ม exclude /share/ ใน redirect logic

### ลิงก์สำรวจไม่มีหมดอายุ
- [x] แก้ไขให้ลิงก์สำรวจ (survey-field) ไม่มีวันหมดอายุ (expiresAt = null)
- [x] ลิงก์ติดตั้ง (share) ยังคงหมดอายุ 14 วันเหมือนเดิม
- [x] อัพเดท UI แสดง "ไม่มีหมดอายุ" สำหรับลิงก์สำรวจ

### Bug: PDF Export ตัวหนังสือ caption ใต้รูปทับกัน
- [x] แก้ไข PDF export ให้ caption ใต้รูปไม่ทับกัน (ข้อความยาวเกินคอลัมน์)
- [x] ให้ caption ตัดบรรทัดอัตโนมัติ (splitTextToSize) แสดงสูงสุด 2 บรรทัด + ลดขนาดฟอนต์เป็น 6.5pt + เพิ่มระยะห่างระหว่างแถว

### Fix: การเรียงลำดับในหน้างานสำรวจให้เรียงทั้งหมดก่อนแบ่งหน้า
- [x] แก้ไขให้ sort ทำงานกับข้อมูลทั้งชุดก่อน แล้วค่อย paginate (ไม่ใช่ sort เฉพาะหน้าปัจจุบัน)

### Fix: การเรียงวันที่ให้เรียงเวลาภายในวันเดียวกันด้วย
- [x] เมื่อ sort ตามวันที่ ให้เรียงเวลาภายในวันเดียวกัน (null time ขึ้นก่อน → แล้วเรียงเวลาจากเช้าไปเย็น)

### Feature: ทีมงานมีหลาย role ได้ (Multi-role team members)
- [x] Schema: เปลี่ยนจาก role เดียว เป็นหลาย role ต่อคน (เช่น admin_sender + surveyor + closer)
- [x] Backend: อัพเดท API team members ให้รองรับ multi-role
- [x] Frontend: หน้าจัดการทีมงาน - เปลี่ยนจาก dropdown role เป็น checkbox หลาย role
- [x] Frontend: dropdown มอบหมายงาน - แสดงคนที่มี role นั้นๆ ทุกคน (via server-side JSON_CONTAINS filter)

### Feature: ปรับปรุงหน้าผลงานทีม (Team Performance Revamp)
- [x] Backend: query แยก 2 กลุ่ม - คนส่งสำรวจ (admin_sender) และ เซลล์/คนสำรวจ (surveyor) พร้อมอัตราปิดการขาย
- [x] Frontend: ตาราง 1 - ผลงานคนส่งสำรวจ (ส่งทั้งหมด, ปิดได้, อัตราปิด)
- [x] Frontend: ตาราง 2 - ผลงานเซลล์ (เคสที่ได้รับ, ปิดได้, อัตราปิด)
- [x] กรองตามเดือน/ปี เหมือนเดิม

### Feature: เพิ่มปุ่ม "เลือกรูป" ในหน้าแชร์ลิงก์สำรวจ (survey-field)
- [x] เพิ่มตัวเลือก "เลือกรูปจากแกลเลอรี่" ข้างปุ่ม "เพิ่มรูป" ในหน้า survey-field

### Feature: Reorder รูปภาพ + บีบอัดรูปอัตโนมัติ
- [x] เพิ่ม drag-and-drop reorder รูปภาพในหน้า survey-field (ลากจัดลำดับ)
- [x] เพิ่ม/ตรวจสอบการบีบอัดรูปอัตโนมัติก่อนอัพโหลด (ประหยัดพื้นที่ S3)

### Bug Fix: ฟอร์มข้อมูลเทคนิคในหน้า survey-field แสดง SQL error
- [x] Backend: sanitize ค่า numeric fields (systemSize, panelCount, quotedPrice) ก่อน save ลง DB - strip ตัวอักษรที่ไม่ใช่ตัวเลข
- [x] Frontend: แสดง error message ที่เป็น user-friendly แทน raw SQL
- [x] Frontend: format ค่าตัวเลขให้มี comma เมื่อแสดงผล (200000 → 200,000)

### Feature: เปลี่ยนช่องค่าไฟเป็น text เพื่อรองรับช่วงราคา
- [x] เปลี่ยน electricityBill column จาก decimal เป็น text ใน DB
- [x] เอา sanitize ออกจาก electricityBill (ให้กรอกอะไรก็ได้ เช่น "3000-5000")
- [x] แก้ placeholder ให้ชัดเจนว่ากรอกช่วงได้

### Feature: เพิ่มชื่อเซลล์และลิงก์สำรวจในข้อความแจ้งเตือน LINE
- [x] เพิ่มชื่อเซลล์/คนสำรวจ (surveyor) ในข้อความ LINE notification
- [x] เพิ่ม share link URL ในข้อความ LINE notification เมื่อสำรวจเสร็จผ่าน share link

### Bug Fix: หน้าผลงานทีมข้อมูลไม่ครบ/ไม่ตรง
- [x] ตรวจสอบ query หน้าผลงานทีม - ทำไมนับเคสไม่ครบ
- [x] แก้ให้นับจากงานสำรวจที่สร้างในเดือนนั้น (ไม่ใช่แค่งานที่สำรวจเสร็จ)
- [x] แก้ "ปิดการขายได้" ให้นับจากสถานะ "ติดตั้งเสร็จสิ้น" (installationStatus = completed/delivered)
- [x] ตรวจสอบว่าทำไมบางงานไม่มีชื่อเซลล์ → งานที่ยังไม่ได้มอบหมาย surveyor แสดงเป็น "ยังไม่ได้มอบหมาย"
- [x] แก้ให้แสดงชื่อเซลล์และคนส่งสำรวจครบถ้วน (resolve name จาก team_members + users fallback)
- [x] แก้ "สำรวจแล้ว" ให้รวม follow_up status ด้วย

### Feature: ปรับปรุงหน้าผลงานทีม - 2 Tab + completedAt + ลบข้อมูลทดสอบ
- [x] Schema: เพิ่ม installationCompletedAt column ใน surveys table (completedAt มีอยู่แล้ว ใช้สำหรับสำรวจเสร็จ)
- [x] Backend: บันทึก installationCompletedAt อัตโนมัติเมื่อเปลี่ยน installationStatus เป็น completed/delivered
- [x] Backend: ปรับ getTeamPerformance query - Tab 1 (ภาพรวม Lead) นับตามเดือนสร้างงาน
- [x] Backend: เพิ่ม query Tab 2 (ปิดงาน/คอมมิชชั่น) นับตามเดือนที่ installationCompletedAt
- [x] Backend: ตาราง เซลล์ เพิ่ม "ได้รับมอบหมาย" = ทุกเคสที่ assign ให้เซลล์คนนั้น
- [x] Frontend: เพิ่ม 2 Tab ในหน้าผลงานทีม (ภาพรวม Lead / ปิดงาน-คอมมิชชั่น)
- [x] Frontend: Tab 1 แสดงตาราง แอดมิน + เซลล์ พร้อมคอลัมน์ ได้รับมอบหมาย/สำรวจแล้ว/ปิดการขาย/อัตราปิด
- [x] Frontend: Tab 2 แสดงตาราง แอดมิน + เซลล์ นับเฉพาะเคสที่ติดตั้งเสร็จในเดือนนั้น
- [x] ลบข้อมูลทดสอบออกจาก DB (Round12 Test, FilterTest, R24 Surveyor, ทดสอบระบบ ฯลฯ)

### Fix: เปลี่ยนหน้าผลงานทีมให้นับตามวันที่ส่งสำรวจ/มอบหมายงาน
- [x] ตรวจสอบ field ที่บันทึกวันที่ admin กดส่งงาน → ใช้ survey_assignments.createdAt
- [x] เปลี่ยน query Tab 1 จากนับตาม createdAt เป็นนับตามวันที่ส่งสำรวจ (dispatch date)
- [x] ตรวจสอบว่าตัวเลขตรงกับหน้างานติดตาม → 19 เคส พ.ค. 2569 ถูกต้อง
