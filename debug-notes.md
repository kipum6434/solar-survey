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
