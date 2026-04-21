import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // 1. Create custom_statuses table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS custom_statuses (
      id int AUTO_INCREMENT NOT NULL,
      type enum('customer','survey') NOT NULL,
      label varchar(255) NOT NULL,
      color varchar(50) NOT NULL DEFAULT '#6b7280',
      bgColor varchar(50) NOT NULL DEFAULT '#f3f4f6',
      sortOrder int NOT NULL DEFAULT 0,
      isDefault boolean NOT NULL DEFAULT false,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT custom_statuses_id PRIMARY KEY(id)
    )
  `);
  console.log('✓ Created custom_statuses table');

  // 2. Add statusId to customers
  try {
    await conn.execute(`ALTER TABLE customers ADD COLUMN statusId int`);
    console.log('✓ Added statusId to customers');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⊘ statusId already exists in customers');
    else throw e;
  }

  // 3. Add statusId to surveys
  try {
    await conn.execute(`ALTER TABLE surveys ADD COLUMN statusId int`);
    console.log('✓ Added statusId to surveys');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⊘ statusId already exists in surveys');
    else throw e;
  }

  // 4. Add installationDate to surveys
  try {
    await conn.execute(`ALTER TABLE surveys ADD COLUMN installationDate bigint`);
    console.log('✓ Added installationDate to surveys');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⊘ installationDate already exists in surveys');
    else throw e;
  }

  // 5. Seed default customer statuses
  const [existingCustomer] = await conn.execute(`SELECT COUNT(*) as cnt FROM custom_statuses WHERE type = 'customer'`);
  if (existingCustomer[0].cnt === 0) {
    await conn.execute(`INSERT INTO custom_statuses (type, label, color, bgColor, sortOrder, isDefault) VALUES
      ('customer', 'ยังไม่นัดสำรวจ', '#78716c', '#f5f5f4', 1, true),
      ('customer', 'นัดสำรวจแล้ว', '#1d4ed8', '#eff6ff', 2, false),
      ('customer', 'สำรวจเสร็จ', '#047857', '#ecfdf5', 3, false),
      ('customer', 'ปิดการขาย', '#15803d', '#dcfce7', 4, false),
      ('customer', 'ไม่สำเร็จ', '#dc2626', '#fef2f2', 5, false)
    `);
    console.log('✓ Seeded customer statuses');
  } else {
    console.log('⊘ Customer statuses already exist');
  }

  // 6. Seed default survey statuses
  const [existingSurvey] = await conn.execute(`SELECT COUNT(*) as cnt FROM custom_statuses WHERE type = 'survey'`);
  if (existingSurvey[0].cnt === 0) {
    await conn.execute(`INSERT INTO custom_statuses (type, label, color, bgColor, sortOrder, isDefault) VALUES
      ('survey', 'รอดำเนินการ', '#78716c', '#f5f5f4', 1, true),
      ('survey', 'นัดสำรวจแล้ว', '#1d4ed8', '#eff6ff', 2, false),
      ('survey', 'กำลังสำรวจ', '#d97706', '#fffbeb', 3, false),
      ('survey', 'สำรวจเสร็จ', '#047857', '#ecfdf5', 4, false),
      ('survey', 'เสนอราคาแล้ว', '#7c3aed', '#f5f3ff', 5, false),
      ('survey', 'เจรจาต่อรอง', '#ea580c', '#fff7ed', 6, false),
      ('survey', 'ปิดการขาย', '#15803d', '#dcfce7', 7, false),
      ('survey', 'ไม่สำเร็จ', '#dc2626', '#fef2f2', 8, false),
      ('survey', 'ยกเลิก', '#6b7280', '#f3f4f6', 9, false)
    `);
    console.log('✓ Seeded survey statuses');
  } else {
    console.log('⊘ Survey statuses already exist');
  }

  await conn.end();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
