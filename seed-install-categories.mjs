import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const categories = [
  { key: 'top_view', label: 'ภาพถ่าย Top View', sortOrder: 1, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'building_front', label: 'หน้าอาคารสถานที่ติดตั้ง', sortOrder: 2, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'transformer', label: 'รูปถ่ายหม้อแปลง (ยี่ห้อ ขนาดพิกัด และ Nameplate)', sortOrder: 3, isRequired: false, isConditional: true, conditionNote: 'ถ้าสามารถถ่ายได้' },
  { key: 'main_breaker', label: 'รูปถ่ายเมนเบรกเกอร์บ้านลูกค้า', sortOrder: 4, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'solar_panel_nameplate', label: 'Nameplate / SN ของแผง Solar', sortOrder: 5, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'inverter_nameplate', label: 'Nameplate ของ Inverter', sortOrder: 6, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'battery_nameplate', label: 'Nameplate ของแบตเตอรี่และสมาร์ทการ์ด', sortOrder: 7, isRequired: false, isConditional: true, conditionNote: 'ถ้ามี' },
  { key: 'inverter_install_point', label: 'จุดติดตั้ง Inverter', sortOrder: 8, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'dc_equipment', label: 'อุปกรณ์ด้าน DC, การเดินสายไฟฟ้า DC, อุปกรณ์ป้องกันไฟฟ้าด้าน DC และจุดเชื่อมต่อ', sortOrder: 9, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'ac_equipment', label: 'อุปกรณ์ด้าน AC, การเดินสายไฟฟ้า AC, อุปกรณ์ป้องกันไฟฟ้าด้าน AC และจุดเชื่อมต่อ', sortOrder: 10, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'backup_box', label: 'อุปกรณ์ Back up box (จุดเชื่อมต่อภายในตู้ วงจร ยี่ห้อ/รุ่น)', sortOrder: 11, isRequired: false, isConditional: true, conditionNote: 'ถ้ามี' },
  { key: 'electrical_panel_inside', label: 'ภายในตู้ไฟบ้านลูกค้า ที่เห็นจุดเชื่อมต่อชัดเจน', sortOrder: 12, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'zero_export_ct', label: 'การติดตั้ง Zero Export จุดคล้อง CT / ขนาดรุ่น', sortOrder: 13, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'grounding', label: 'จุดลงกราวด์ วัดค่ากราวด์', sortOrder: 14, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'fusionsolar_firmware', label: 'แคปหน้าจอแอป FusionSolar ที่มี Firmware version ของ Inverter', sortOrder: 15, isRequired: true, isConditional: false, conditionNote: null },
  { key: 'other', label: 'อื่นๆ', sortOrder: 99, isRequired: false, isConditional: false, conditionNote: null },
];

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Delete all existing categories first
  await conn.execute('DELETE FROM installation_photo_categories');
  console.log('Deleted all existing installation photo categories');
  
  // Insert new categories
  for (const cat of categories) {
    await conn.execute(
      'INSERT INTO installation_photo_categories (`key`, label, sortOrder, isDefault, isRequired, isConditional, conditionNote) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cat.key, cat.label, cat.sortOrder, cat.key === 'other' ? 1 : 0, cat.isRequired ? 1 : 0, cat.isConditional ? 1 : 0, cat.conditionNote]
    );
    console.log(`Inserted: ${cat.label} (required: ${cat.isRequired}, conditional: ${cat.isConditional})`);
  }
  
  // Verify
  const [rows] = await conn.execute('SELECT id, `key`, label, isRequired, isConditional, conditionNote FROM installation_photo_categories ORDER BY sortOrder');
  console.log('\n=== Final categories ===');
  console.table(rows);
  
  await conn.end();
}

run().catch(e => { console.error(e); process.exit(1); });
