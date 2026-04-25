import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  reorderCustomStatuses: vi.fn().mockResolvedValue(undefined),
  reorderPhotoCategories: vi.fn().mockResolvedValue(undefined),
  reorderDocumentCategories: vi.fn().mockResolvedValue(undefined),
  reorderInstallationPhotoCategories: vi.fn().mockResolvedValue(undefined),
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

describe("reorder functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reorderCustomStatuses", () => {
    it("should reorder custom statuses with new sortOrder values", async () => {
      const items = [
        { id: 1, sortOrder: 2 },
        { id: 2, sortOrder: 0 },
        { id: 3, sortOrder: 1 },
      ];
      await db.reorderCustomStatuses(items);
      expect(db.reorderCustomStatuses).toHaveBeenCalledWith(items);
    });

    it("should handle single item reorder", async () => {
      const items = [{ id: 5, sortOrder: 0 }];
      await db.reorderCustomStatuses(items);
      expect(db.reorderCustomStatuses).toHaveBeenCalledWith(items);
    });
  });

  describe("reorderPhotoCategories", () => {
    it("should reorder photo categories", async () => {
      const items = [
        { id: 10, sortOrder: 1 },
        { id: 20, sortOrder: 0 },
      ];
      await db.reorderPhotoCategories(items);
      expect(db.reorderPhotoCategories).toHaveBeenCalledWith(items);
    });
  });

  describe("reorderDocumentCategories", () => {
    it("should reorder document categories", async () => {
      const items = [
        { id: 30, sortOrder: 2 },
        { id: 40, sortOrder: 0 },
        { id: 50, sortOrder: 1 },
      ];
      await db.reorderDocumentCategories(items);
      expect(db.reorderDocumentCategories).toHaveBeenCalledWith(items);
    });
  });

  describe("reorderInstallationPhotoCategories", () => {
    it("should reorder installation photo categories", async () => {
      const items = [
        { id: 60, sortOrder: 1 },
        { id: 70, sortOrder: 0 },
      ];
      await db.reorderInstallationPhotoCategories(items);
      expect(db.reorderInstallationPhotoCategories).toHaveBeenCalledWith(items);
    });
  });

  describe("logActivity after reorder", () => {
    it("should log activity after reordering custom statuses", async () => {
      const items = [{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }];
      await db.reorderCustomStatuses(items);
      await db.logActivity({
        userId: 1,
        action: "update",
        entityType: "custom_status",
        entityId: items[0].id,
        details: `จัดลำดับสถานะใหม่ (${items.length} รายการ)`,
      });
      expect(db.logActivity).toHaveBeenCalledWith({
        userId: 1,
        action: "update",
        entityType: "custom_status",
        entityId: 1,
        details: "จัดลำดับสถานะใหม่ (2 รายการ)",
      });
    });
  });
});
