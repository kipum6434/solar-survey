// Storage helpers using user's own AWS S3 bucket
// Credentials come from environment variables:
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_S3_REGION

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

// ── S3 Client (lazy singleton) ──────────────────────────────────────

let _client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_client) return _client;

  const region = process.env.AWS_S3_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS S3 credentials missing: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION"
    );
  }

  _client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");
  return bucket;
}

// ── Helpers ─────────────────────────────────────────────────────────

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const segmentStart = relKey.lastIndexOf("/");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1 || lastDot <= segmentStart) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function buildPublicUrl(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// ── Public API (same interface as before) ───────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const region = process.env.AWS_S3_REGION!;
  const key = appendHashSuffix(normalizeKey(relKey));

  const body =
    typeof data === "string" ? Buffer.from(data, "utf-8") : data;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Invalidate S3 usage cache after successful upload
  invalidateS3UsageCache();

  const url = buildPublicUrl(bucket, region, key);
  return { key, url };
}

export async function storageDelete(relKey: string): Promise<boolean> {
  try {
    const client = getS3Client();
    const bucket = getBucket();
    const key = normalizeKey(relKey);

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    // Invalidate S3 usage cache after successful delete
    invalidateS3UsageCache();

    return true;
  } catch (e) {
    console.warn("[Storage] Delete failed:", e);
    return false;
  }
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const bucket = getBucket();
  const region = process.env.AWS_S3_REGION!;
  const key = normalizeKey(relKey);

  // Since the bucket has a public-read policy, we return the public URL directly
  const url = buildPublicUrl(bucket, region, key);
  return { key, url };
}

// ── S3 Bucket Usage ─────────────────────────────────────────────────

const FREE_TIER_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

// Server-side cache for S3 usage (avoid listing 19k+ objects on every request)
let s3UsageCache: {
  data: { totalSize: number; totalObjects: number; freeTierLimit: number; usagePercent: number; bucketName: string; region: string } | null;
  timestamp: number;
} = { data: null, timestamp: 0 };
const S3_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Invalidate S3 usage cache — call after upload/delete so next query fetches fresh data */
export function invalidateS3UsageCache(): void {
  s3UsageCache = { data: null, timestamp: 0 };
}

export async function getS3BucketUsage(): Promise<{
  totalSize: number;
  totalObjects: number;
  freeTierLimit: number;
  usagePercent: number;
  bucketName: string;
  region: string;
}> {
  // Return cached result if still fresh
  if (s3UsageCache.data && (Date.now() - s3UsageCache.timestamp) < S3_CACHE_TTL) {
    return s3UsageCache.data;
  }

  const client = getS3Client();
  const bucket = getBucket();
  const region = process.env.AWS_S3_REGION!;

  let totalSize = 0;
  let totalObjects = 0;
  let continuationToken: string | undefined;

  // Paginate through all objects to calculate total size
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        totalSize += obj.Size ?? 0;
        totalObjects++;
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  const usagePercent = (totalSize / FREE_TIER_BYTES) * 100;

  const result = {
    totalSize,
    totalObjects,
    freeTierLimit: FREE_TIER_BYTES,
    usagePercent: Math.round(usagePercent * 100) / 100,
    bucketName: bucket,
    region,
  };

  // Update cache
  s3UsageCache = { data: result, timestamp: Date.now() };

  return result;
}
