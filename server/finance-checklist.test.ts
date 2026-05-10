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
      openId: "admin-test-finance",
    } as AuthenticatedUser,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      role: "user",
      name: "Regular User",
      openId: "user-test-finance",
    } as AuthenticatedUser,
  };
}

describe("Finance & Checklist Features", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());
  let testCustomerId: number;
  let testSurveyId: number;

  beforeAll(async () => {
    const customer = await adminCaller.customer.create({
      name: "ลูกค้าทดสอบ Finance " + Date.now(),
      phone: "0811111111",
      source: "ทดสอบ",
    });
    testCustomerId = customer.id;

    const survey = await adminCaller.survey.create({
      customerId: testCustomerId,
      surveyDate: Date.now(),
      surveyTime: "10:00",
    });
    testSurveyId = survey.id;
  });

  // ==================== Checklist Template CRUD ====================
  describe("Checklist Template CRUD", () => {
    let createdId: number;

    it("should list checklist templates", async () => {
      const templates = await userCaller.checklistTemplate.list();
      expect(Array.isArray(templates)).toBe(true);
    });

    it("should list all checklist templates (admin)", async () => {
      const templates = await adminCaller.checklistTemplate.listAll();
      expect(Array.isArray(templates)).toBe(true);
    });

    it("should create a checklist template (admin)", async () => {
      const result = await adminCaller.checklistTemplate.create({
        name: "ทดสอบ Template " + Date.now(),
        items: JSON.stringify(["ตรวจแผง", "ตรวจอินเวอร์เตอร์"]),
      });
      expect(result).toBeDefined();
      expect((result as any).id).toBeDefined();
      createdId = (result as any).id;
    });

    it("should update a checklist template (admin)", async () => {
      if (!createdId) return;
      const result = await adminCaller.checklistTemplate.update({
        id: createdId,
        name: "อัพเดท Template " + Date.now(),
        items: JSON.stringify(["ตรวจแผง", "ตรวจอินเวอร์เตอร์", "ตรวจสายไฟ"]),
      });
      expect(result).toEqual({ success: true });
    });

    it("should delete a checklist template (admin)", async () => {
      const created = await adminCaller.checklistTemplate.create({
        name: "ลบทดสอบ " + Date.now(),
        items: JSON.stringify(["item1"]),
      });
      const id = (created as any).id;
      const result = await adminCaller.checklistTemplate.delete({ id });
      expect(result).toEqual({ success: true });
    });

    it("should reject non-admin create", async () => {
      await expect(
        userCaller.checklistTemplate.create({ name: "test", items: "[]" })
      ).rejects.toThrow();
    });
  });

  // ==================== Source Names By Group ====================
  describe("Source Names By Group", () => {
    it("should return source names grouped by groupName", async () => {
      const result = await adminCaller.source.sourceNamesByGroup();
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      for (const [key, value] of Object.entries(result)) {
        expect(typeof key).toBe("string");
        expect(Array.isArray(value)).toBe(true);
      }
    });
  });

  // ==================== Payment CRUD ====================
  describe("Payment CRUD", () => {
    let paymentId: number;

    it("should create a payment", async () => {
      const result = await adminCaller.payment.create({
        surveyId: testSurveyId,
        amount: 150000,
        notes: "งวดที่ 1",
      });
      expect(result).toBeDefined();
      expect((result as any).id).toBeDefined();
      paymentId = (result as any).id;
    });

    it("should list payments with pagination", async () => {
      const result = await adminCaller.payment.list({
        page: 1,
        limit: 10,
      });
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should list payments with source filter", async () => {
      const result = await adminCaller.payment.list({
        page: 1,
        limit: 10,
        source: "ทดสอบ",
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should list payments with sourceExclude filter", async () => {
      const result = await adminCaller.payment.list({
        page: 1,
        limit: 10,
        sourceExclude: ["Gulf", "MEA"],
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should update a payment status", async () => {
      if (!paymentId) return;
      const result = await adminCaller.payment.update({
        id: paymentId,
        status: "paid",
      });
      expect(result).toEqual({ success: true });
    });
  });

  // ==================== Delivery Form ====================
  describe("Delivery Form", () => {
    it("should get delivery form (null if not created)", async () => {
      const result = await adminCaller.deliveryForm.get({ surveyId: testSurveyId });
      expect(result === null || typeof result === "object").toBe(true);
    });

    it("should create a delivery form", async () => {
      const result = await adminCaller.deliveryForm.create({ surveyId: testSurveyId });
      expect(result).toBeDefined();
      expect((result as any).id).toBeDefined();
    });

    it("should get delivery form after creation", async () => {
      const result = await adminCaller.deliveryForm.get({ surveyId: testSurveyId });
      expect(result).toBeDefined();
      expect((result as any).surveyId).toBe(testSurveyId);
    });

    it("should update checklist items", async () => {
      const form = await adminCaller.deliveryForm.get({ surveyId: testSurveyId });
      if (!form) return;
      const result = await adminCaller.deliveryForm.updateChecklist({
        id: (form as any).id,
        checklistItems: [{ label: "ทดสอบ", checked: true }],
      });
      expect(result).toEqual({ success: true });
    });

    it("should update notes", async () => {
      const form = await adminCaller.deliveryForm.get({ surveyId: testSurveyId });
      if (!form) return;
      const result = await adminCaller.deliveryForm.updateNotes({
        id: (form as any).id,
        notes: "หมายเหตุทดสอบ " + Date.now(),
      });
      expect(result).toEqual({ success: true });
    });
  });

  // ==================== Source Update ====================
  describe("Source Update", () => {
    it("should update a source name", async () => {
      const sources = await adminCaller.source.list();
      if (!Array.isArray(sources) || sources.length === 0) return;
      const testSource = sources[0] as any;
      const result = await adminCaller.source.update({
        id: testSource.id,
        name: testSource.name,
      });
      expect(result).toEqual({ success: true });
    });
  });
});
