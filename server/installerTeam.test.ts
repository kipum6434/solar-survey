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
      openId: "admin-test-installer-team",
    } as AuthenticatedUser,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      role: "user",
      name: "Regular User",
      openId: "user-test-installer-team",
    } as AuthenticatedUser,
  };
}

describe("Installer Team Management", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());
  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      try {
        await adminCaller.installerTeam.delete({ id });
      } catch {
        // Ignore errors
      }
    }
  });

  // ==================== CRUD ====================
  describe("CRUD Operations", () => {
    it("should create an installer team (admin only)", async () => {
      const result = await adminCaller.installerTeam.create({
        name: `ทีมช่าง Test ${Date.now()}`,
        phone: "0891234567",
        note: "ทดสอบ",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      createdIds.push(result.id);
    });

    it("should NOT allow regular user to create", async () => {
      await expect(
        userCaller.installerTeam.create({
          name: `ทีมช่าง Unauthorized ${Date.now()}`,
        })
      ).rejects.toThrow();
    });

    it("should list all installer teams", async () => {
      const teams = await adminCaller.installerTeam.list();
      expect(Array.isArray(teams)).toBe(true);
      expect(teams.length).toBeGreaterThanOrEqual(1);
    });

    it("should list active installer teams (public)", async () => {
      const teams = await userCaller.installerTeam.listActive();
      expect(Array.isArray(teams)).toBe(true);
      // All returned teams should be active
      for (const t of teams) {
        expect(t.isActive).toBeTruthy();
      }
    });

    it("should update an installer team", async () => {
      const team = await adminCaller.installerTeam.create({
        name: `ทีมช่าง Update ${Date.now()}`,
      });
      createdIds.push(team.id);

      await adminCaller.installerTeam.update({
        id: team.id,
        name: "ทีมช่าง Updated",
        phone: "0899876543",
      });

      const teams = await adminCaller.installerTeam.list();
      const updated = teams.find((t: any) => t.id === team.id);
      expect(updated).toBeDefined();
      expect(updated!.name).toBe("ทีมช่าง Updated");
      expect(updated!.phone).toBe("0899876543");
    });

    it("should deactivate an installer team", async () => {
      const team = await adminCaller.installerTeam.create({
        name: `ทีมช่าง Deactivate ${Date.now()}`,
      });
      createdIds.push(team.id);

      await adminCaller.installerTeam.update({
        id: team.id,
        isActive: false,
      });

      const activeTeams = await userCaller.installerTeam.listActive();
      const found = activeTeams.find((t: any) => t.id === team.id);
      expect(found).toBeUndefined();
    });

    it("should delete an installer team", async () => {
      const team = await adminCaller.installerTeam.create({
        name: `ทีมช่าง Delete ${Date.now()}`,
      });

      await adminCaller.installerTeam.delete({ id: team.id });

      const teams = await adminCaller.installerTeam.list();
      const found = teams.find((t: any) => t.id === team.id);
      expect(found).toBeUndefined();
    });
  });

  // ==================== Assignment to Survey ====================
  describe("Assignment to Survey", () => {
    it("should assign installer team to a survey", async () => {
      // Create team
      const team = await adminCaller.installerTeam.create({
        name: `ทีมช่าง Assign ${Date.now()}`,
      });
      createdIds.push(team.id);

      // Create customer + survey
      const customer = await adminCaller.customer.create({
        name: `ลูกค้า Installer Team Test ${Date.now()}`,
        phone: "0891111111",
        source: "ทดสอบ",
      });
      const survey = await adminCaller.survey.create({
        customerId: customer.id,
        surveyDate: Date.now(),
        surveyTime: "10:00",
      });

      // Assign team
      await adminCaller.survey.update({
        id: survey.id,
        installerTeamId: team.id,
      });

      // Verify
      const detail = await adminCaller.survey.getById({ id: survey.id });
      expect(detail.survey.installerTeamId).toBe(team.id);
    });

    it("should unassign installer team from a survey", async () => {
      const customer = await adminCaller.customer.create({
        name: `ลูกค้า Unassign Test ${Date.now()}`,
        phone: "0892222222",
        source: "ทดสอบ",
      });
      const survey = await adminCaller.survey.create({
        customerId: customer.id,
        surveyDate: Date.now(),
        surveyTime: "11:00",
      });

      // Assign then unassign
      const team = await adminCaller.installerTeam.create({
        name: `ทีมช่าง Unassign ${Date.now()}`,
      });
      createdIds.push(team.id);

      await adminCaller.survey.update({
        id: survey.id,
        installerTeamId: team.id,
      });

      await adminCaller.survey.update({
        id: survey.id,
        installerTeamId: null,
      });

      const detail = await adminCaller.survey.getById({ id: survey.id });
      expect(detail.survey.installerTeamId).toBeNull();
    });
  });
});
