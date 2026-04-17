// Test storageGet to see what URL it returns
const baseUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, '');
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

if (!baseUrl || !apiKey) {
  console.error('Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY');
  process.exit(1);
}

// Get a sample file key from the database
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [photos] = await conn.execute('SELECT id, fileKey, url FROM survey_photos LIMIT 1');
const [docs] = await conn.execute('SELECT id, fileKey, url FROM survey_documents LIMIT 1');

console.log('\n=== Photo from DB ===');
console.log('fileKey:', photos[0]?.fileKey);
console.log('url (DB):', photos[0]?.url?.substring(0, 120));

console.log('\n=== Document from DB ===');
console.log('fileKey:', docs[0]?.fileKey);
console.log('url (DB):', docs[0]?.url?.substring(0, 120));

// Test storageGet (downloadUrl)
async function testStorageGet(fileKey) {
  const downloadApiUrl = new URL('v1/storage/downloadUrl', baseUrl + '/');
  downloadApiUrl.searchParams.set('path', fileKey);
  console.log('\nCalling:', downloadApiUrl.toString().substring(0, 120));
  
  const response = await fetch(downloadApiUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  
  const data = await response.json();
  console.log('Response status:', response.status);
  console.log('Download URL:', data.url?.substring(0, 150));
  console.log('Has query params:', data.url?.includes('?'));
  return data.url;
}

if (photos[0]?.fileKey) {
  console.log('\n--- Testing photo storageGet ---');
  await testStorageGet(photos[0].fileKey);
}

if (docs[0]?.fileKey) {
  console.log('\n--- Testing document storageGet ---');
  await testStorageGet(docs[0].fileKey);
}

await conn.end();
