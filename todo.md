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
