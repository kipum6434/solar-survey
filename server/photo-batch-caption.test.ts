import { describe, it, expect, vi } from "vitest";

// Mock db module as namespace (import * as db)
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    updateSurveyPhotoCaption: vi.fn().mockResolvedValue(undefined),
  };
});

import { appRouter } from "./routers";
import * as db from "./db";

describe("Photo Batch Caption Update", () => {
  const caller = appRouter.createCaller({
    user: { id: 1, openId: "test", name: "Test", role: "admin" },
  } as any);

  it("photo.batchUpdateCaptions should update multiple captions", async () => {
    const mockFn = db.updateSurveyPhotoCaption as unknown as ReturnType<typeof vi.fn>;
    mockFn.mockClear();

    const result = await caller.photo.batchUpdateCaptions({
      updates: [
        { id: 1, caption: "Caption 1" },
        { id: 2, caption: "Caption 2" },
        { id: 3, caption: null },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockFn).toHaveBeenCalledWith(1, "Caption 1");
    expect(mockFn).toHaveBeenCalledWith(2, "Caption 2");
    expect(mockFn).toHaveBeenCalledWith(3, null);
  });

  it("photo.batchUpdateCaptions should reject empty updates array", async () => {
    await expect(
      caller.photo.batchUpdateCaptions({ updates: [] })
    ).rejects.toThrow();
  });
});
