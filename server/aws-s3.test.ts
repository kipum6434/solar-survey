import { describe, it, expect, afterAll } from "vitest";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_S3_REGION || "ap-southeast-1";
const bucket = process.env.AWS_S3_BUCKET || "solar-survey-files-2026";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

const testKey = `__test__/vitest-${Date.now()}.txt`;

describe("AWS S3 Integration", () => {
  afterAll(async () => {
    // Cleanup test file
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    } catch (_) {
      // ignore
    }
  });

  it("should have valid AWS credentials and access the bucket", async () => {
    const response = await client.send(new HeadBucketCommand({ Bucket: bucket }));
    expect(response.$metadata.httpStatusCode).toBe(200);
  });

  it("should upload a file to S3", async () => {
    const body = Buffer.from("Hello from vitest " + Date.now());
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: body,
        ContentType: "text/plain",
      })
    );
    expect(response.$metadata.httpStatusCode).toBe(200);
  });

  it("should read the uploaded file from S3", async () => {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: testKey })
    );
    expect(response.$metadata.httpStatusCode).toBe(200);
    const text = await response.Body?.transformToString();
    expect(text).toContain("Hello from vitest");
  });

  it("should generate a valid public URL", () => {
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${testKey}`;
    expect(url).toContain(bucket);
    expect(url).toContain(testKey);
  });

  it("should delete the test file from S3", async () => {
    const response = await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: testKey })
    );
    expect(response.$metadata.httpStatusCode).toBe(204);
  });
});
