import { describe, it, expect, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      role: "admin",
      name: "Admin User",
      openId: "admin-test-report",
    } as AuthenticatedUser,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      role: "user",
      name: "Regular User",
      openId: "user-test-report",
    } as AuthenticatedUser,
  };
}

describe("Installer Team Report", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());
  const cleanupTeamIds: number[] = [];

  afterAll(async () => {
    for (const id of cleanupTeamIds) {
      try {
        await adminCaller.installerTeam.delete({ id });
      } catch {
        // Ignore errors
      }
    }
  });

  it("should return report data as array", async () => {
    const report = await adminCaller.installerTeam.report();
    expect(Array.isArray(report)).toBe(true);
  });

  it("should return report with correct fields for each team", async () => {
    const report = await adminCaller.installerTeam.report();
    for (const team of report) {
      expect(team).toHaveProperty("teamId");
      expect(team).toHaveProperty("teamName");
      expect(team).toHaveProperty("totalJobs");
      expect(team).toHaveProperty("waiting");
      expect(team).toHaveProperty("inProgress");
      expect(team).toHaveProperty("completed");
      expect(team).toHaveProperty("deliveryPending");
      expect(team).toHaveProperty("deliverySubmitted");
      expect(team).toHaveProperty("deliveryApproved");
      expect(team).toHaveProperty("deliveryRejected");
      expect(team).toHaveProperty("totalKw");
      expect(team).toHaveProperty("isActive");
      expect(typeof team.totalJobs).toBe("number");
      expect(typeof team.totalKw).toBe("number");
    }
  });

  it("should filter by month and year", async () => {
    const now = new Date();
    const report = await adminCaller.installerTeam.report({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    expect(Array.isArray(report)).toBe(true);
  });

  it("should filter by year only", async () => {
    const report = await adminCaller.installerTeam.report({
      year: new Date().getFullYear(),
    });
    expect(Array.isArray(report)).toBe(true);
  });

  it("should be accessible by regular user (protectedProcedure)", async () => {
    const report = await userCaller.installerTeam.report();
    expect(Array.isArray(report)).toBe(true);
  });

  it("should include newly created team with 0 jobs", async () => {
    const team = await adminCaller.installerTeam.create({
      name: `ทีมช่าง Report Test ${Date.now()}`,
      phone: "0891234567",
    });
    cleanupTeamIds.push(team.id);

    const report = await adminCaller.installerTeam.report();
    const found = report.find((r: any) => r.teamId === team.id);
    expect(found).toBeDefined();
    expect(found!.totalJobs).toBe(0);
    expect(found!.waiting).toBe(0);
    expect(found!.completed).toBe(0);
    expect(found!.totalKw).toBe(0);
  });

  it("should show team with assigned installation job", async () => {
    // Create team
    const team = await adminCaller.installerTeam.create({
      name: `ทีมช่าง Job Test ${Date.now()}`,
    });
    cleanupTeamIds.push(team.id);

    // Create customer + survey with installation date
    const customer = await adminCaller.customer.create({
      name: `ลูกค้า Report Test ${Date.now()}`,
      phone: "0891111111",
      source: "ทดสอบ",
    });
    const survey = await adminCaller.survey.create({
      customerId: customer.id,
      surveyDate: Date.now(),
      surveyTime: "10:00",
    });

    // Assign installation date + team
    await adminCaller.survey.update({
      id: survey.id,
      installationDate: Date.now(),
      installerTeamId: team.id,
    });

    // Get report for current month
    const now = new Date();
    const report = await adminCaller.installerTeam.report({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    const found = report.find((r: any) => r.teamId === team.id);
    expect(found).toBeDefined();
    expect(found!.totalJobs).toBeGreaterThanOrEqual(1);
  });

  it("should return empty jobs for future month filter", async () => {
    // Query a month far in the future
    const report = await adminCaller.installerTeam.report({
      month: 1,
      year: 2099,
    });
    // All teams should have 0 jobs
    for (const team of report) {
      expect(team.totalJobs).toBe(0);
    }
  });
});
