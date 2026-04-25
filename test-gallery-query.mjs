import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

try {
  // Test simple query first
  const [rows] = await conn.execute(
    `SELECT s.id, c.name, c.phone, c.address, c.province, 
            s.installationDate, s.installationStatus, s.deliveryStatus, s.installerTeamId,
            (SELECT COUNT(*) FROM installation_photos WHERE installation_photos.survey_id = s.id) as photoCount,
            (SELECT MAX(UNIX_TIMESTAMP(created_at)) * 1000 FROM installation_photos WHERE installation_photos.survey_id = s.id) as latestPhotoAt
     FROM surveys s
     INNER JOIN customers c ON s.customerId = c.id
     WHERE s.installationStatus IS NOT NULL
     ORDER BY (SELECT MAX(UNIX_TIMESTAMP(created_at)) FROM installation_photos WHERE installation_photos.survey_id = s.id) DESC, s.installationDate DESC
     LIMIT 20`
  );
  console.log('Query succeeded! Rows:', rows.length);
  console.log('Sample:', JSON.stringify(rows[0], null, 2));
} catch (err) {
  console.error('Query failed:', err.message);
  console.error('SQL State:', err.sqlState);
  console.error('Errno:', err.errno);
} finally {
  await conn.end();
}
