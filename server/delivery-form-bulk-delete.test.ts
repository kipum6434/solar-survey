import { describe, it, expect, beforeAll } from "vitest";
import { router, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

// Test the bulkDeleteDeliveryForms db helper
describe("deliveryForm.bulkDelete", () => {
  it("should return { deleted: 0 } for empty array", async () => {
    const result = await db.bulkDeleteDeliveryForms([]);
    expect(result).toEqual({ deleted: 0 });
  });

  it("should handle non-existent IDs gracefully", async () => {
    // Deleting IDs that don't exist should not throw
    const result = await db.bulkDeleteDeliveryForms([999999, 999998, 999997]);
    expect(result).toEqual({ deleted: 3 });
  });
});
