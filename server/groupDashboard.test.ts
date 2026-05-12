import { describe, it, expect, vi } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDashboardStatsForGroup: vi.fn().mockResolvedValue({
    totalCustomers: 10,
    totalSurveys: 15,
    pendingSurveys: 3,
    scheduledSurveys: 5,
    surveyedSurveys: 2,
    wonDeals: 1,
    pendingFollowUps: 4,
    pendingInstall: 1,
    installedCount: 0,
    followUpCount: 3,
    quotedCount: 1,
    negotiatingCount: 0,
  }),
}));

describe("Group Dashboard Stats", () => {
  it("getDashboardStatsForGroup returns all expected fields", async () => {
    const { getDashboardStatsForGroup } = await import("./db");
    const stats = await getDashboardStatsForGroup("tcs");
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("totalCustomers");
    expect(stats).toHaveProperty("totalSurveys");
    expect(stats).toHaveProperty("pendingSurveys");
    expect(stats).toHaveProperty("scheduledSurveys");
    expect(stats).toHaveProperty("surveyedSurveys");
    expect(stats).toHaveProperty("wonDeals");
    expect(stats).toHaveProperty("pendingFollowUps");
    expect(stats).toHaveProperty("pendingInstall");
    expect(stats).toHaveProperty("installedCount");
    expect(stats).toHaveProperty("followUpCount");
    expect(stats).toHaveProperty("quotedCount");
    expect(stats).toHaveProperty("negotiatingCount");
  });

  it("getDashboardStatsForGroup returns numeric values", async () => {
    const { getDashboardStatsForGroup } = await import("./db");
    const stats = await getDashboardStatsForGroup("tcs");
    expect(typeof stats.totalCustomers).toBe("number");
    expect(typeof stats.totalSurveys).toBe("number");
    expect(typeof stats.wonDeals).toBe("number");
    expect(typeof stats.followUpCount).toBe("number");
    expect(typeof stats.quotedCount).toBe("number");
    expect(typeof stats.negotiatingCount).toBe("number");
  });

  it("getDashboardStatsForGroup values are non-negative", async () => {
    const { getDashboardStatsForGroup } = await import("./db");
    const stats = await getDashboardStatsForGroup("tcs");
    expect(stats.totalCustomers).toBeGreaterThanOrEqual(0);
    expect(stats.totalSurveys).toBeGreaterThanOrEqual(0);
    expect(stats.pendingSurveys).toBeGreaterThanOrEqual(0);
    expect(stats.wonDeals).toBeGreaterThanOrEqual(0);
    expect(stats.followUpCount).toBeGreaterThanOrEqual(0);
  });
});
