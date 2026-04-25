import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS \`line_groups\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`groupId\` varchar(64) NOT NULL,
    \`groupName\` varchar(255),
    \`joinedAt\` timestamp NOT NULL DEFAULT (now()),
    \`isActive\` boolean NOT NULL DEFAULT true,
    CONSTRAINT \`line_groups_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`line_groups_groupId_unique\` UNIQUE(\`groupId\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`line_notification_targets\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`targetType\` enum('user','group') NOT NULL,
    \`targetId\` varchar(64) NOT NULL,
    \`label\` varchar(255),
    \`isEnabled\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`line_notification_targets_id\` PRIMARY KEY(\`id\`)
  )`,
  // Insert default owner user target
  `INSERT IGNORE INTO \`line_notification_targets\` (\`targetType\`, \`targetId\`, \`label\`, \`isEnabled\`)
   VALUES ('user', '${process.env.LINE_USER_ID || ""}', 'เจ้าของระบบ (Owner)', true)`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("OK:", sql.substring(0, 60) + "...");
  } catch (e) {
    console.error("ERR:", e.message);
  }
}

await conn.end();
console.log("Migration 21 complete!");
