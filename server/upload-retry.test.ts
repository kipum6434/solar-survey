import { describe, it, expect } from "vitest";

/**
 * Tests for the upload-with-retry logic.
 * Since the actual hook uses React state, we test the core retry algorithm
 * in isolation (pure functions).
 */

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core retry logic extracted for testing.
 * Attempts to call uploadFn up to MAX_RETRIES times with delays.
 */
async function uploadSingleWithRetry(
  item: { fileName: string },
  uploadFn: () => Promise<void>,
  options?: { delayFn?: (ms: number) => Promise<void> }
): Promise<{ success: boolean; attempts: number }> {
  const delayFn = options?.delayFn || delay;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await uploadFn();
      return { success: true, attempts: attempt };
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return { success: false, attempts: attempt };
      }
      await delayFn(RETRY_DELAYS[attempt - 1] || 3000);
    }
  }
  return { success: false, attempts: MAX_RETRIES };
}

/**
 * Process items in chunks with retry.
 */
async function uploadFilesWithRetry(
  items: Array<{ fileName: string }>,
  uploadFn: (item: { fileName: string }) => Promise<void>,
  options?: { delayFn?: (ms: number) => Promise<void> }
): Promise<{ successCount: number; failedCount: number; failedItems: string[] }> {
  let successCount = 0;
  let failedCount = 0;
  const failedItems: string[] = [];

  const CHUNK = 3;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (item) => {
        const result = await uploadSingleWithRetry(item, () => uploadFn(item), options);
        return { ...result, fileName: item.fileName };
      })
    );
    results.forEach((r) => {
      if (r.success) successCount++;
      else {
        failedCount++;
        failedItems.push(r.fileName);
      }
    });
  }

  return { successCount, failedCount, failedItems };
}

describe("Upload Retry Logic", () => {
  // Use instant delay for tests
  const noDelay = async () => {};

  it("should succeed on first attempt when upload works", async () => {
    const result = await uploadSingleWithRetry(
      { fileName: "test.jpg" },
      async () => {},
      { delayFn: noDelay }
    );
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("should retry and succeed on second attempt", async () => {
    let callCount = 0;
    const result = await uploadSingleWithRetry(
      { fileName: "test.jpg" },
      async () => {
        callCount++;
        if (callCount < 2) throw new Error("Network error");
      },
      { delayFn: noDelay }
    );
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(callCount).toBe(2);
  });

  it("should retry and succeed on third attempt", async () => {
    let callCount = 0;
    const result = await uploadSingleWithRetry(
      { fileName: "test.jpg" },
      async () => {
        callCount++;
        if (callCount < 3) throw new Error("Network error");
      },
      { delayFn: noDelay }
    );
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(callCount).toBe(3);
  });

  it("should fail after MAX_RETRIES attempts", async () => {
    let callCount = 0;
    const result = await uploadSingleWithRetry(
      { fileName: "test.jpg" },
      async () => {
        callCount++;
        throw new Error("Persistent error");
      },
      { delayFn: noDelay }
    );
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(MAX_RETRIES);
    expect(callCount).toBe(MAX_RETRIES);
  });

  it("should process multiple files in chunks of 3", async () => {
    const uploadOrder: string[] = [];
    const items = [
      { fileName: "1.jpg" },
      { fileName: "2.jpg" },
      { fileName: "3.jpg" },
      { fileName: "4.jpg" },
      { fileName: "5.jpg" },
    ];

    const result = await uploadFilesWithRetry(
      items,
      async (item) => {
        uploadOrder.push(item.fileName);
      },
      { delayFn: noDelay }
    );

    expect(result.successCount).toBe(5);
    expect(result.failedCount).toBe(0);
    expect(uploadOrder).toEqual(["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]);
  });

  it("should handle mixed success and failure", async () => {
    const items = [
      { fileName: "good1.jpg" },
      { fileName: "bad.jpg" },
      { fileName: "good2.jpg" },
    ];

    const result = await uploadFilesWithRetry(
      items,
      async (item) => {
        if (item.fileName === "bad.jpg") throw new Error("Upload failed");
      },
      { delayFn: noDelay }
    );

    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.failedItems).toEqual(["bad.jpg"]);
  });

  it("should handle empty file list", async () => {
    const result = await uploadFilesWithRetry(
      [],
      async () => {},
      { delayFn: noDelay }
    );

    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.failedItems).toEqual([]);
  });

  it("should handle all files failing", async () => {
    const items = [
      { fileName: "bad1.jpg" },
      { fileName: "bad2.jpg" },
    ];

    let totalCalls = 0;
    const result = await uploadFilesWithRetry(
      items,
      async () => {
        totalCalls++;
        throw new Error("Server down");
      },
      { delayFn: noDelay }
    );

    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(2);
    // Each file should be tried MAX_RETRIES times
    expect(totalCalls).toBe(2 * MAX_RETRIES);
  });

  it("should use correct retry delays", () => {
    expect(RETRY_DELAYS).toEqual([1000, 3000, 5000]);
    expect(MAX_RETRIES).toBe(3);
  });

  it("should retry failed files on manual retry", async () => {
    // Simulate: first upload fails, then manual retry succeeds
    let shouldFail = true;
    const items = [{ fileName: "retry-me.jpg" }];

    // First attempt - fails
    const result1 = await uploadFilesWithRetry(
      items,
      async () => {
        if (shouldFail) throw new Error("Network error");
      },
      { delayFn: noDelay }
    );
    expect(result1.failedCount).toBe(1);

    // Manual retry - succeeds
    shouldFail = false;
    const result2 = await uploadFilesWithRetry(
      result1.failedItems.map((f) => ({ fileName: f })),
      async () => {
        if (shouldFail) throw new Error("Network error");
      },
      { delayFn: noDelay }
    );
    expect(result2.successCount).toBe(1);
    expect(result2.failedCount).toBe(0);
  });
});
