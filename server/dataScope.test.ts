import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";

// Helper to create caller with specific role
function createCaller(userId: number, role: "user" | "admin" | "superadmin") {
  return appRouter.createCaller({
    user: { id: userId, name: `Test ${role}`, role, openId: `test_scope_${role}_${userId}` },
    req: {} as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
  });
}

describe("Data Scoping", () => {
  let adminCaller: ReturnType<typeof createCaller>;
  let userCaller: ReturnType<typeof createCaller>;
  let adminUserId: number;
  let regularUserId: number;
  let customerId1: number;
  let customerId2: number;
  let surveyId1: number;
  let surveyId2: number;
  let teamMemberId: number;

  beforeAll(async () => {
    // Use existing admin user (id=1 typically) and create a regular user
    adminUserId = 1;
    regularUserId = 999; // Will be a user with role "user"
    
    adminCaller = createCaller(adminUserId, "superadmin");
    userCaller = createCaller(regularUserId, "user");
  });

  describe("Admin sees all data", () => {
    it("admin should see all customers", async () => {
      const result = await adminCaller.customer.list({ page: 1, limit: 5 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      // Admin sees everything - total should be >= 0
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("admin should see all surveys", async () => {
      const result = await adminCaller.survey.list({ page: 1, limit: 5 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("admin should see all dashboard stats", async () => {
      const stats = await adminCaller.dashboard.stats();
      expect(stats).toHaveProperty("totalCustomers");
      expect(stats).toHaveProperty("totalSurveys");
      expect(stats.totalCustomers).toBeGreaterThanOrEqual(0);
      expect(stats.totalSurveys).toBeGreaterThanOrEqual(0);
    });

    it("admin should see all installations", async () => {
      const result = await adminCaller.installation.list({ page: 1, limit: 5 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
    });
  });

  describe("Regular user (no linked team member) sees nothing", () => {
    it("user with no linked team member should see 0 customers", async () => {
      const result = await userCaller.customer.list({ page: 1, limit: 5 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("user with no linked team member should see 0 surveys", async () => {
      const result = await userCaller.survey.list({ page: 1, limit: 5 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("user with no linked team member should see 0 dashboard stats", async () => {
      const stats = await userCaller.dashboard.stats();
      expect(stats.totalCustomers).toBe(0);
      expect(stats.totalSurveys).toBe(0);
    });

    it("user with no linked team member should see 0 installations", async () => {
      const result = await userCaller.installation.list({ page: 1, limit: 5 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getUserScope helper", () => {
    it("should return null for admin", async () => {
      const { getUserScope } = await import("./dataScope");
      const scope = await getUserScope({ id: 1, role: "admin" });
      expect(scope).toBeNull();
    });

    it("should return null for superadmin", async () => {
      const { getUserScope } = await import("./dataScope");
      const scope = await getUserScope({ id: 1, role: "superadmin" });
      expect(scope).toBeNull();
    });

    it("should return scope object for regular user", async () => {
      const { getUserScope } = await import("./dataScope");
      const scope = await getUserScope({ id: 999, role: "user" });
      expect(scope).not.toBeNull();
      expect(scope).toHaveProperty("teamMemberIds");
      expect(scope).toHaveProperty("surveyIds");
      expect(scope).toHaveProperty("customerIds");
      expect(Array.isArray(scope!.teamMemberIds)).toBe(true);
      expect(Array.isArray(scope!.surveyIds)).toBe(true);
      expect(Array.isArray(scope!.customerIds)).toBe(true);
    });
  });

  describe("needsScoping helper", () => {
    it("should return true for user role", async () => {
      const { needsScoping } = await import("./dataScope");
      expect(needsScoping({ id: 1, role: "user" })).toBe(true);
    });

    it("should return false for admin role", async () => {
      const { needsScoping } = await import("./dataScope");
      expect(needsScoping({ id: 1, role: "admin" })).toBe(false);
    });

    it("should return false for superadmin role", async () => {
      const { needsScoping } = await import("./dataScope");
      expect(needsScoping({ id: 1, role: "superadmin" })).toBe(false);
    });
  });
});
