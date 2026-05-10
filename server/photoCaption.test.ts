import { describe, it, expect, vi } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  updatePhotoCaption: vi.fn().mockResolvedValue(undefined),
  getSurveyPhotos: vi.fn().mockResolvedValue([
    { id: 1, url: "https://example.com/photo1.jpg", caption: "หมายเหตุทดสอบ", category: "front", fileName: "photo1.jpg" },
    { id: 2, url: "https://example.com/photo2.jpg", caption: null, category: "surrounding", fileName: "photo2.jpg" },
  ]),
}));

import * as db from "./db";

describe("Photo Caption Feature", () => {
  it("updatePhotoCaption should be called with correct params", async () => {
    await db.updatePhotoCaption(1, "หมายเหตุใหม่");
    expect(db.updatePhotoCaption).toHaveBeenCalledWith(1, "หมายเหตุใหม่");
  });

  it("updatePhotoCaption should accept empty string to clear caption", async () => {
    await db.updatePhotoCaption(1, "");
    expect(db.updatePhotoCaption).toHaveBeenCalledWith(1, "");
  });

  it("getSurveyPhotos should return photos with caption field", async () => {
    const photos = await db.getSurveyPhotos(1);
    expect(photos).toHaveLength(2);
    expect(photos[0]).toHaveProperty("caption", "หมายเหตุทดสอบ");
    expect(photos[1]).toHaveProperty("caption", null);
  });
});
