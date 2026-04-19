import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS sources (id int AUTO_INCREMENT NOT NULL, name varchar(255) NOT NULL, category varchar(100), usageCount int NOT NULL DEFAULT 0, createdAt timestamp NOT NULL DEFAULT (now()), CONSTRAINT sources_id PRIMARY KEY(id), CONSTRAINT sources_name_unique UNIQUE(name))`,
  `CREATE TABLE IF NOT EXISTS survey_assignments (id int AUTO_INCREMENT NOT NULL, surveyId int NOT NULL, userId int NOT NULL, role enum('admin_sender','surveyor','closer') NOT NULL, createdAt timestamp NOT NULL DEFAULT (now()), CONSTRAINT survey_assignments_id PRIMARY KEY(id))`,
  `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'source'`,
  `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'surveys' AND COLUMN_NAME = 'adminSenderId'`,
];

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // 1. Create sources table
  try {
    await conn.execute(statements[0]);
    console.log("✓ sources table created/exists");
  } catch (e) {
    console.log("sources table:", e.message);
  }
  
  // 2. Create survey_assignments table
  try {
    await conn.execute(statements[1]);
    console.log("✓ survey_assignments table created/exists");
  } catch (e) {
    console.log("survey_assignments table:", e.message);
  }
  
  // 3. Check and modify customers.source column
  try {
    const [rows] = await conn.execute(statements[2]);
    const colType = rows[0]?.COLUMN_TYPE || "";
    if (colType.startsWith("enum")) {
      await conn.execute(`ALTER TABLE customers MODIFY COLUMN source varchar(255) DEFAULT 'other'`);
      console.log("✓ customers.source changed from enum to varchar");
    } else {
      console.log("✓ customers.source already varchar");
    }
  } catch (e) {
    console.log("customers.source:", e.message);
  }
  
  // 4. Add adminSenderId to surveys
  try {
    const [rows] = await conn.execute(statements[3]);
    if (rows.length === 0) {
      await conn.execute(`ALTER TABLE surveys ADD adminSenderId int`);
      console.log("✓ surveys.adminSenderId added");
    } else {
      console.log("✓ surveys.adminSenderId already exists");
    }
  } catch (e) {
    console.log("adminSenderId:", e.message);
  }
  
  // 5. Add closerId to surveys
  try {
    const [rows2] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'surveys' AND COLUMN_NAME = 'closerId'`);
    if (rows2.length === 0) {
      await conn.execute(`ALTER TABLE surveys ADD closerId int`);
      console.log("✓ surveys.closerId added");
    } else {
      console.log("✓ surveys.closerId already exists");
    }
  } catch (e) {
    console.log("closerId:", e.message);
  }
  
  // 6. Seed default sources
  const defaultSources = [
    { name: "Facebook", category: "social" },
    { name: "LINE", category: "social" },
    { name: "Website", category: "online" },
    { name: "Walk-in", category: "offline" },
    { name: "Telesale", category: "offline" },
    { name: "Referral", category: "offline" },
  ];
  
  for (const s of defaultSources) {
    try {
      await conn.execute(`INSERT IGNORE INTO sources (name, category) VALUES (?, ?)`, [s.name, s.category]);
    } catch (e) {}
  }
  console.log("✓ Default sources seeded");
  
  await conn.end();
  console.log("Migration complete!");
}

run().catch(console.error);
