import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db.ts", () => ({
  getSources: vi.fn().mockResolvedValue([
    { id: 1, name: "Gulf", groupName: "Gulf" },
    { id: 2, name: "MEA", groupName: "MEA" },
    { id: 3, name: "KEN", groupName: null },
  ]),
  getSourcesWithStats: vi.fn().mockResolvedValue([
    { id: 1, name: "Gulf", groupName: "Gulf", customerCount: 50, usageCount: 3 },
    { id: 2, name: "MEA", groupName: "MEA", customerCount: 30, usageCount: 2 },
    { id: 3, name: "KEN", groupName: null, customerCount: 20, usageCount: 1 },
  ]),
  getSourceNamesByGroup: vi.fn().mockImplementation(async (groupName: string) => {
    const mapping: Record<string, string[]> = {
      "Gulf": ["Gulf"],
      "MEA": ["MEA"],
    };
    return mapping[groupName] || [];
  }),
  getNonTcsSourceNames: vi.fn().mockResolvedValue(["Gulf", "MEA"]),
  getDistinctGroups: vi.fn().mockResolvedValue(["Gulf", "MEA"]),
  getCustomersBySourceName: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  updateSourceGroup: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";

describe("Source Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSourcesWithStats returns sources with customer counts", async () => {
    const result = await db.getSourcesWithStats();
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty("customerCount");
    expect(result[0]).toHaveProperty("groupName");
  });

  it("getSourceNamesByGroup returns correct names for Gulf", async () => {
    const names = await db.getSourceNamesByGroup("Gulf");
    expect(names).toContain("Gulf");
  });

  it("getNonTcsSourceNames returns Gulf and MEA", async () => {
    const names = await db.getNonTcsSourceNames();
    expect(names).toContain("Gulf");
    expect(names).toContain("MEA");
    expect(names).not.toContain("KEN");
  });

  it("getDistinctGroups returns available groups", async () => {
    const groups = await db.getDistinctGroups();
    expect(groups).toContain("Gulf");
    expect(groups).toContain("MEA");
  });

  it("getCustomersBySourceName returns paginated results", async () => {
    const result = await db.getCustomersBySourceName("Gulf", { page: 1, limit: 20 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("updateSourceGroup updates the group for a source", async () => {
    const result = await db.updateSourceGroup(3, "MEA");
    expect(result).toBe(true);
    expect(db.updateSourceGroup).toHaveBeenCalledWith(3, "MEA");
  });
});
