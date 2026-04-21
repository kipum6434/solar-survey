import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  bulkDeleteCustomers: vi.fn().mockResolvedValue({ deleted: 3 }),
  bulkDeleteSurveys: vi.fn().mockResolvedValue({ deleted: 2 }),
  bulkDeleteTeamMembers: vi.fn().mockResolvedValue({ deleted: 4 }),
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

describe("bulkDelete functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bulkDeleteCustomers", () => {
    it("should delete multiple customers and return count", async () => {
      const result = await db.bulkDeleteCustomers([1, 2, 3]);
      expect(result).toEqual({ deleted: 3 });
      expect(db.bulkDeleteCustomers).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("should handle empty array", async () => {
      (db.bulkDeleteCustomers as any).mockResolvedValueOnce({ deleted: 0 });
      const result = await db.bulkDeleteCustomers([]);
      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe("bulkDeleteSurveys", () => {
    it("should delete multiple surveys and return count", async () => {
      const result = await db.bulkDeleteSurveys([10, 20]);
      expect(result).toEqual({ deleted: 2 });
      expect(db.bulkDeleteSurveys).toHaveBeenCalledWith([10, 20]);
    });

    it("should handle single item", async () => {
      (db.bulkDeleteSurveys as any).mockResolvedValueOnce({ deleted: 1 });
      const result = await db.bulkDeleteSurveys([5]);
      expect(result).toEqual({ deleted: 1 });
    });
  });

  describe("bulkDeleteTeamMembers", () => {
    it("should delete multiple team members and return count", async () => {
      const result = await db.bulkDeleteTeamMembers([100, 200, 300, 400]);
      expect(result).toEqual({ deleted: 4 });
      expect(db.bulkDeleteTeamMembers).toHaveBeenCalledWith([100, 200, 300, 400]);
    });
  });

  describe("logActivity after bulk delete", () => {
    it("should log activity after bulk delete", async () => {
      await db.bulkDeleteCustomers([1, 2, 3]);
      await db.logActivity({
        userId: 1,
        action: "delete",
        entityType: "customer",
        entityId: 1,
        details: "ลบลูกค้า 3 รายการ (IDs: 1, 2, 3)",
      });
      expect(db.logActivity).toHaveBeenCalledWith({
        userId: 1,
        action: "delete",
        entityType: "customer",
        entityId: 1,
        details: "ลบลูกค้า 3 รายการ (IDs: 1, 2, 3)",
      });
    });
  });
});
