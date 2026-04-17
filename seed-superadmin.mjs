import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function main() {
  const hash = await bcrypt.hash('Abcd@2026', 10);
  console.log('Password hash generated');
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Check if user already exists
  const [existing] = await conn.execute('SELECT id, username, role FROM users WHERE username = ?', ['kipum']);
  if (existing.length > 0) {
    console.log('User kipum already exists, updating password and role...');
    await conn.execute(
      'UPDATE users SET passwordHash = ?, role = ?, name = ? WHERE username = ?',
      [hash, 'superadmin', 'Kipum (Super Admin)', 'kipum']
    );
  } else {
    console.log('Creating new superadmin user kipum...');
    const openId = `local_kipum_${Date.now()}`;
    await conn.execute(
      'INSERT INTO users (openId, username, passwordHash, name, role, lastSignedIn) VALUES (?, ?, ?, ?, ?, NOW())',
      [openId, 'kipum', hash, 'Kipum (Super Admin)', 'superadmin']
    );
  }
  
  // Verify
  const [verify] = await conn.execute('SELECT id, username, name, role FROM users WHERE username = ?', ['kipum']);
  console.log('Verified user:', verify[0]);
  
  await conn.end();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
