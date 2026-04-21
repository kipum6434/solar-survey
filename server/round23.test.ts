import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      role: "admin",
      name: "Admin User",
      openId: "admin-test-r23",
    } as AuthenticatedUser,
  };
}

describe("Round 23 - Installation Status, Export Excel, Date Picker", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  let testSurveyId: number;
  let testCustomerId: number;

  beforeAll(async () => {
    // Create test customer
    const customer = await adminCaller.customer.create({
      name: "ลูกค้าทดสอบ Round23 " + Date.now(),
      phone: "0999999923",
      source: "ทดสอบ",
    });
    testCustomerId = customer.id;

    // Create test survey
    const survey = await adminCaller.survey.create({
      customerId: testCustomerId,
      surveyDate: Date.now(),
      surveyTime: "10:00",
    });
    testSurveyId = survey.id;

    // Set installation date
    await adminCaller.customStatus.updateInstallationDate({
      surveyId: testSurveyId,
      installationDate: Date.now() + 86400000, // tomorrow
    });
  });

  describe("Installation Status", () => {
    it("should update installation status to waiting", async () => {
      const result = await adminCaller.installation.updateStatus({
        surveyId: testSurveyId,
        installationStatus: "waiting",
      });
      expect(result.success).toBe(true);
    });

    it("should update installation status to in_progress", async () => {
      const result = await adminCaller.installation.updateStatus({
        surveyId: testSurveyId,
        installationStatus: "in_progress",
      });
      expect(result.success).toBe(true);
    });

    it("should update installation status to completed", async () => {
      const result = await adminCaller.installation.updateStatus({
        surveyId: testSurveyId,
        installationStatus: "completed",
      });
      expect(result.success).toBe(true);
    });

    it("should update installation status to delivered", async () => {
      const result = await adminCaller.installation.updateStatus({
        surveyId: testSurveyId,
        installationStatus: "delivered",
      });
      expect(result.success).toBe(true);
    });

    it("should include installationStatus in installation list", async () => {
      const result = await adminCaller.installation.list({ page: 1, limit: 50 });
      expect(result.data).toBeDefined();
      const found = result.data.find((d: any) => d.survey.id === testSurveyId);
      if (found) {
        expect(found.survey.installationStatus).toBe("delivered");
      }
    });
  });

  describe("Export Excel", () => {
    it("should return data for export", async () => {
      const result = await adminCaller.installation.exportExcel({});
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("survey");
        expect(result[0]).toHaveProperty("customer");
      }
    });

    it("should support filtering in export", async () => {
      const result = await adminCaller.installation.exportExcel({
        installationStatus: "all",
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Installation Date Update via StatusDropdown", () => {
    it("should update installation date", async () => {
      const futureDate = Date.now() + 7 * 86400000;
      const result = await adminCaller.customStatus.updateInstallationDate({
        surveyId: testSurveyId,
        installationDate: futureDate,
      });
      expect(result.success).toBe(true);
    });

    it("should clear installation date", async () => {
      const result = await adminCaller.customStatus.updateInstallationDate({
        surveyId: testSurveyId,
        installationDate: null,
      });
      expect(result.success).toBe(true);
    });
  });
});
