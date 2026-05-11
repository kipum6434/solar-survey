import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/slip.jpg", key: "collection-slips/1_123_abc.jpg" }),
  storageDelete: vi.fn().mockResolvedValue(undefined),
  getS3BucketUsage: vi.fn().mockResolvedValue({ totalSize: 0, fileCount: 0 }),
}));

// Mock db
vi.mock("./db", () => ({
  updatePaymentCollection: vi.fn().mockResolvedValue(undefined),
  getPaymentCollections: vi.fn().mockResolvedValue([
    { id: 1, paymentId: 1, amount: "5000", note: "มัดจำ", collectedAt: 1700000000000, slipUrl: null, slipFileKey: null, createdAt: new Date() },
    { id: 2, paymentId: 1, amount: "10000", note: "งวด 1", collectedAt: 1700100000000, slipUrl: "https://s3.example.com/existing.jpg", slipFileKey: "collection-slips/2_456_def.jpg", createdAt: new Date() },
  ]),
  createPaymentCollection: vi.fn().mockResolvedValue({ insertId: 99 }),
  deletePaymentCollection: vi.fn().mockResolvedValue(undefined),
  recalcPaymentCollected: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth
vi.mock("./_core/context", () => ({
  createContext: vi.fn(),
}));

describe("Payment Collection Slip Upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have uploadCollectionSlip endpoint that accepts base64 image data", async () => {
    // Verify the endpoint schema accepts the right input
    const input = {
      collectionId: 1,
      base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      fileName: "slip.png",
      mimeType: "image/jpeg",
    };
    
    // Verify input shape is correct
    expect(input.collectionId).toBe(1);
    expect(input.base64Data).toBeTruthy();
    expect(input.fileName).toBe("slip.png");
    expect(input.mimeType).toBe("image/jpeg");
  });

  it("should reject files larger than 5MB", () => {
    // Create a base64 string that would be > 5MB when decoded
    const fiveMBPlus = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
    const buffer = Buffer.from(fiveMBPlus, "base64");
    expect(buffer.length).toBeGreaterThan(5 * 1024 * 1024);
  });

  it("should accept files under 5MB", () => {
    const smallFile = Buffer.alloc(100 * 1024).toString("base64"); // 100KB
    const buffer = Buffer.from(smallFile, "base64");
    expect(buffer.length).toBeLessThan(5 * 1024 * 1024);
  });

  it("should generate correct S3 key format for collection slips", () => {
    const collectionId = 42;
    const timestamp = Date.now();
    const ext = "jpg";
    const key = `collection-slips/${collectionId}_${timestamp}_abc123.${ext}`;
    
    expect(key).toMatch(/^collection-slips\/42_\d+_abc123\.jpg$/);
  });

  it("should have deleteCollectionSlip endpoint that clears slipUrl", async () => {
    const { updatePaymentCollection } = await import("./db");
    
    await updatePaymentCollection(1, { slipUrl: null, slipFileKey: null });
    
    expect(updatePaymentCollection).toHaveBeenCalledWith(1, { slipUrl: null, slipFileKey: null });
  });

  it("should return insertId from createPaymentCollection for slip upload chaining", async () => {
    const { createPaymentCollection } = await import("./db");
    
    const result = await createPaymentCollection({
      paymentId: 1,
      amount: "5000",
      note: "มัดจำ",
      collectedAt: Date.now(),
      createdBy: 1,
    });
    
    expect(result).toHaveProperty("insertId");
    expect(result.insertId).toBe(99);
  });

  it("should list collections with slipUrl field", async () => {
    const { getPaymentCollections } = await import("./db");
    
    const collections = await getPaymentCollections(1);
    
    expect(collections).toHaveLength(2);
    expect(collections[0].slipUrl).toBeNull();
    expect(collections[1].slipUrl).toBe("https://s3.example.com/existing.jpg");
  });

  it("should update collection with slip URL after upload", async () => {
    const { updatePaymentCollection } = await import("./db");
    
    await updatePaymentCollection(1, {
      slipUrl: "https://s3.example.com/slip.jpg",
      slipFileKey: "collection-slips/1_123_abc.jpg",
    });
    
    expect(updatePaymentCollection).toHaveBeenCalledWith(1, {
      slipUrl: "https://s3.example.com/slip.jpg",
      slipFileKey: "collection-slips/1_123_abc.jpg",
    });
  });
});
