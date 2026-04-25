# Debug Notes - Round 4

## Surveys Page Check
- Table view: วันที่, เวลา, ชื่อลูกค้า, เบอร์โทร, ช่องทาง, เขต/จังหวัด, เจ้าหน้าที่, สถานะ, หมายเหตุ ✅
- Month tabs: ทั้งหมด, ม.ค.-ธ.ค. ✅
- Year selector: 2569 ✅
- Status filter: ทั้งหมด ✅
- Source filter: แหล่งที่มา ✅ (new)
- View toggle: List/Table ✅

## SurveyDetail Page Check
- ข้อมูลทางเทคนิค card ✅
- ข้อมูลจากลูกค้า card ✅
- ทีมงาน card ✅ (แอดมินผู้ส่งงาน, ทีมสำรวจ, ผู้ปิดการขาย)
- Edit Dialog: needs verification with new workflow fields

## Status: All UI elements showing correctly
- Source column shows "website" as free text ✅
- Source filter dropdown present ✅
- Team card shows 3 roles ✅

## Bug Fix Round 47 - Browser Test Results

### DeliveryTab (Admin view)
- ✅ ปุ่ม "อัปโหลดรูป" แสดงใน header area (ข้างปุ่ม "ส่งมอบงาน")
- ✅ ปุ่ม "อัปโหลดรูปติดตั้ง" แสดงใน empty state (กลาง card)
- ✅ สถานะ "รอส่งมอบ" แสดงถูกต้อง
- ✅ ปุ่ม "ส่งมอบงาน" แสดง (disabled เพราะยังไม่มีรูป)
- ✅ Category filter "ทั้งหมด (0)" แสดง
- ✅ ข้อความ empty state: "ยังไม่มีรูปติดตั้ง / กดปุ่ม "อัปโหลดรูป" เพื่อเพิ่มรูปถ่ายการติดตั้ง"

## Round 48 - Installation Photo Categories + Validation

### DeliveryTab (Admin View) - /surveys/360001 > ส่งมอบงาน
- ✅ Progress bar แสดง "รูปที่จำเป็น: 0/12 หมวด 0%"
- ✅ Missing required categories แสดงเป็น badges สีแดง (12 หมวด)
- ✅ Conditional categories แสดงเป็น badges สีเหลือง (3 หมวด) พร้อม condition note
- ✅ Category tabs แสดงทั้ง 16 หมวด + "อื่นๆ"
- ✅ ปุ่ม "อัปโหลดรูป" + "ส่งมอบงาน" แสดงใน header
- ✅ ปุ่ม "เพิ่มรูป" + "อัปโหลดรูป" แสดงในแต่ละ category
- ✅ Required badge (✗ จำเป็น) แสดงสีแดงเมื่อยังไม่มีรูป
- ✅ Conditional badge (ถ้ามี) แสดงสีเหลืองพร้อม condition note

### Category Grid View (scrolled down)
- ✅ ภาพถ่าย Top View — 0 รูป — badge "✗ จำเป็น" สีแดง — empty state "จำเป็นต้องอัปโหลด"
- ✅ หน้าอาคารสถานที่ติดตั้ง — 0 รูป — badge "✗ จำเป็น" — empty state "จำเป็นต้องอัปโหลด"
- ✅ รูปถ่ายหม้อแปลง — 0 รูป — badge "ถ้าสามารถถ่ายได้" สีเหลือง — empty state "(ถ้าสามารถถ่ายได้)"
- ✅ รูปถ่ายเมนเบรกเกอร์ — 0 รูป — badge "✗ จำเป็น" — empty state "จำเป็นต้องอัปโหลด"
- ✅ Nameplate / SN ของแผง Solar — 0 รูป — badge "✗ จำเป็น"
- ✅ ปุ่ม "เพิ่มรูป" + "อัปโหลดรูป" แสดงในทุก category

## Round 49 - Gallery Page + Android Camera Fix

### Gallery Page - /gallery
- ✅ Header: "แกลลอรี่รูปติดตั้ง" + subtitle
- ✅ View toggle: อัลบั้ม / ทั้งหมด buttons
- ✅ Filters: search, team, status dropdowns
- ✅ Sidebar: "แกลลอรี่รูปติดตั้ง" menu item with ImageIcon
- ✅ Loading: skeleton cards showing (data loading)
- ✅ No TypeScript errors
- ✅ Album grid shows loading state then data

### Gallery Page - After SQL Fix
- ✅ Album view: Working - shows empty state "ไม่พบอัลบั้มรูปติดตั้ง" (correct, no photos yet)
- ✅ Feed view: Working - shows empty state "ไม่พบรูปถ่าย" with category filter dropdown
- ✅ No console errors
- ✅ SQL fix: Changed `survey_id` → `surveyId` and `created_at` → `createdAt` in subqueries (camelCase column names)
- ✅ Filters visible: search, team, status, category (in feed view)
