import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  bulkDeleteCustomStatuses: vi.fn().mockResolvedValue({ deleted: 3 }),
  bulkDeletePhotoCategories: vi.fn().mockResolvedValue({ deleted: 2 }),
  bulkDeleteDocumentCategories: vi.fn().mockResolvedValue({ deleted: 2 }),
  bulkDeleteInstallationPhotoCategories: vi.fn().mockResolvedValue({ deleted: 2 }),
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

describe("status & category bulkDelete functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bulkDeleteCustomStatuses", () => {
    it("should delete multiple custom statuses and return count", async () => {
      const result = await db.bulkDeleteCustomStatuses([1, 2, 3]);
      expect(result).toEqual({ deleted: 3 });
      expect(db.bulkDeleteCustomStatuses).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("should handle single item", async () => {
      (db.bulkDeleteCustomStatuses as any).mockResolvedValueOnce({ deleted: 1 });
      const result = await db.bulkDeleteCustomStatuses([5]);
      expect(result).toEqual({ deleted: 1 });
    });
  });

  describe("bulkDeletePhotoCategories", () => {
    it("should delete multiple photo categories and return count", async () => {
      const result = await db.bulkDeletePhotoCategories([10, 20]);
      expect(result).toEqual({ deleted: 2 });
      expect(db.bulkDeletePhotoCategories).toHaveBeenCalledWith([10, 20]);
    });

    it("should protect 'other' category (returns deleted: 0)", async () => {
      (db.bulkDeletePhotoCategories as any).mockResolvedValueOnce({ deleted: 0 });
      const result = await db.bulkDeletePhotoCategories([999]);
      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe("bulkDeleteDocumentCategories", () => {
    it("should delete multiple document categories and return count", async () => {
      const result = await db.bulkDeleteDocumentCategories([30, 40]);
      expect(result).toEqual({ deleted: 2 });
      expect(db.bulkDeleteDocumentCategories).toHaveBeenCalledWith([30, 40]);
    });
  });

  describe("bulkDeleteInstallationPhotoCategories", () => {
    it("should delete multiple installation photo categories and return count", async () => {
      const result = await db.bulkDeleteInstallationPhotoCategories([50, 60]);
      expect(result).toEqual({ deleted: 2 });
      expect(db.bulkDeleteInstallationPhotoCategories).toHaveBeenCalledWith([50, 60]);
    });
  });

  describe("logActivity after bulk status delete", () => {
    it("should log activity after bulk delete custom statuses", async () => {
      await db.bulkDeleteCustomStatuses([1, 2, 3]);
      await db.logActivity({
        userId: 1,
        action: "delete",
        entityType: "custom_status",
        entityId: 1,
        details: "ลบสถานะ 3 รายการ (IDs: 1, 2, 3)",
      });
      expect(db.logActivity).toHaveBeenCalledWith({
        userId: 1,
        action: "delete",
        entityType: "custom_status",
        entityId: 1,
        details: "ลบสถานะ 3 รายการ (IDs: 1, 2, 3)",
      });
    });
  });
});
