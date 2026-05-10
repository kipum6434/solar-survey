import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getSourceDashboardStats: vi.fn(),
  getGulfDashboardStats: vi.fn(),
}));

import { getSourceDashboardStats, getGulfDashboardStats } from "./db";

describe("Source Dashboard Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSourceDashboardStats should be callable with different source names", async () => {
    const mockStats = {
      totalCustomers: 10,
      totalSurveys: 5,
      pendingSurveys: 2,
      completedSurveys: 3,
      wonDeals: 1,
      pendingFollowUps: 2,
      totalInstallations: 1,
      completedInstallations: 0,
      inProgressInstallations: 1,
      recentSurveys: [],
    };

    (getSourceDashboardStats as any).mockResolvedValue(mockStats);

    const result = await getSourceDashboardStats("TCS");
    expect(getSourceDashboardStats).toHaveBeenCalledWith("TCS");
    expect(result).toEqual(mockStats);
  });

  it("getSourceDashboardStats should work with Gulf source", async () => {
    const mockStats = {
      totalCustomers: 5,
      totalSurveys: 3,
      pendingSurveys: 1,
      completedSurveys: 2,
      wonDeals: 0,
      pendingFollowUps: 1,
      totalInstallations: 0,
      completedInstallations: 0,
      inProgressInstallations: 0,
      recentSurveys: [],
    };

    (getSourceDashboardStats as any).mockResolvedValue(mockStats);

    const result = await getSourceDashboardStats("Gulf");
    expect(getSourceDashboardStats).toHaveBeenCalledWith("Gulf");
    expect(result).toEqual(mockStats);
  });

  it("getSourceDashboardStats should work with MEA source", async () => {
    const mockStats = {
      totalCustomers: 0,
      totalSurveys: 0,
      pendingSurveys: 0,
      completedSurveys: 0,
      wonDeals: 0,
      pendingFollowUps: 0,
      totalInstallations: 0,
      completedInstallations: 0,
      inProgressInstallations: 0,
      recentSurveys: [],
    };

    (getSourceDashboardStats as any).mockResolvedValue(mockStats);

    const result = await getSourceDashboardStats("MEA");
    expect(getSourceDashboardStats).toHaveBeenCalledWith("MEA");
    expect(result).toEqual(mockStats);
  });

  it("getGulfDashboardStats should be a wrapper for getSourceDashboardStats", async () => {
    const mockStats = {
      totalCustomers: 5,
      totalSurveys: 3,
      pendingSurveys: 1,
      completedSurveys: 2,
      wonDeals: 0,
      pendingFollowUps: 1,
      totalInstallations: 0,
      completedInstallations: 0,
      inProgressInstallations: 0,
      recentSurveys: [],
    };

    (getGulfDashboardStats as any).mockResolvedValue(mockStats);

    const result = await getGulfDashboardStats();
    expect(result).toEqual(mockStats);
  });

  it("stats should have all required fields", async () => {
    const mockStats = {
      totalCustomers: 10,
      totalSurveys: 5,
      pendingSurveys: 2,
      completedSurveys: 3,
      wonDeals: 1,
      pendingFollowUps: 2,
      totalInstallations: 1,
      completedInstallations: 0,
      inProgressInstallations: 1,
      recentSurveys: [
        {
          id: 1,
          status: "scheduled",
          scheduledDate: Date.now(),
          customerName: "Test Customer",
          customerPhone: "0812345678",
          installationStatus: null,
        },
      ],
    };

    (getSourceDashboardStats as any).mockResolvedValue(mockStats);

    const result = await getSourceDashboardStats("TCS");
    expect(result).toHaveProperty("totalCustomers");
    expect(result).toHaveProperty("totalSurveys");
    expect(result).toHaveProperty("pendingSurveys");
    expect(result).toHaveProperty("completedSurveys");
    expect(result).toHaveProperty("wonDeals");
    expect(result).toHaveProperty("pendingFollowUps");
    expect(result).toHaveProperty("totalInstallations");
    expect(result).toHaveProperty("completedInstallations");
    expect(result).toHaveProperty("inProgressInstallations");
    expect(result).toHaveProperty("recentSurveys");
    expect(result.recentSurveys).toHaveLength(1);
    expect(result.recentSurveys[0]).toHaveProperty("customerName");
  });
});
