import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin-open-id",
      name: "Admin User",
      avatar: null,
      role: "admin",
      createdAt: new Date(),
    } as AuthenticatedUser,
  };
}

describe("Round 24: EditSurveyDialog pre-fill + inline scheduled date edit + status sync", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  it("survey.update should accept all technical fields for pre-fill sync", async () => {
    // Create a customer + survey
    const customer = await adminCaller.customer.create({ name: "R24 PreFill Test" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });

    // Update with all technical fields
    const result = await adminCaller.survey.update({
      id: survey.id,
      systemSize: "10.00",
      panelCount: 20,
      panelBrand: "Aiko",
      inverterModel: "Atmoce",
      quotedPrice: "350000",
      needBattery: "ใช้อน Atmoce",
      needOptimizer: "10 ตัว",
      systemType: "micro",
      surveyNotes: "Test notes R24",
    });
    expect(result).toBeDefined();
  });

  it("survey.update should accept scheduledDate and scheduledTime for inline edit", async () => {
    const customer = await adminCaller.customer.create({ name: "R24 ScheduledDate Test" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });

    const newDate = new Date("2026-05-20").getTime();
    const result = await adminCaller.survey.update({
      id: survey.id,
      scheduledDate: newDate,
      scheduledTime: "14:30",
    });
    expect(result).toBeDefined();
  });

  it("survey.update should accept team assignment fields (adminSenderId, surveyorIds, closerId)", async () => {
    const customer = await adminCaller.customer.create({ name: "R24 Team Assign Test" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });

    // Create a team member
    const member = await adminCaller.teamMember.create({ name: "R24 Surveyor", role: "surveyor" });

    const result = await adminCaller.survey.update({
      id: survey.id,
      surveyorIds: [member.id],
      adminSenderId: null,
      closerId: null,
    });
    expect(result).toBeDefined();
  });

  it("customStatus.updateSurveyStatus should sync status from dialog or dropdown", async () => {
    const customer = await adminCaller.customer.create({ name: "R24 Status Sync" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });

    // Create a custom status
    const status = await adminCaller.customStatus.create({ type: "survey", label: "R24 Test Status" });

    // Update status
    const result = await adminCaller.customStatus.updateSurveyStatus({ surveyId: survey.id, statusId: status.id });
    expect(result.success).toBe(true);
  });

  it("survey.update should accept statusId for status sync from dialog", async () => {
    const customer = await adminCaller.customer.create({ name: "R24 StatusId Test" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });

    const status = await adminCaller.customStatus.create({ type: "survey", label: "R24 Dialog Status" });

    const result = await adminCaller.survey.update({
      id: survey.id,
      statusId: status.id,
    });
    expect(result).toBeDefined();
  });

  it("survey.update should accept installationDate for date picker sync", async () => {
    const customer = await adminCaller.customer.create({ name: "R24 InstallDate Sync" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });

    const installDate = new Date("2026-06-15").getTime();
    const result = await adminCaller.survey.update({
      id: survey.id,
      installationDate: installDate,
    });
    expect(result).toBeDefined();
  });
});
