import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      role: "admin",
      name: "Admin User",
      openId: "admin-test-delivery",
    } as AuthenticatedUser,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      role: "user",
      name: "Regular User",
      openId: "user-test-delivery",
    } as AuthenticatedUser,
  };
}

describe("Delivery & Installation Photo System", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());

  let testCustomerId: number;
  let testSurveyId: number;

  beforeAll(async () => {
    // Create test customer and survey
    const customer = await adminCaller.customer.create({
      name: "ลูกค้าทดสอบ Delivery " + Date.now(),
      phone: "0899999999",
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

  // ==================== Installation Photo Category CRUD ====================
  describe("Installation Photo Category CRUD", () => {
    const createdCategoryIds: number[] = [];

    afterAll(async () => {
      for (const id of createdCategoryIds) {
        try {
          await adminCaller.installationPhotoCategory.delete({ id });
        } catch {
          // Ignore errors
        }
      }
    });

    it("should list installation photo categories (public)", async () => {
      const categories = await adminCaller.installationPhotoCategory.list();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThanOrEqual(16); // 16 seeded categories
      const keys = categories.map((c: any) => c.key);
      // Required categories
      expect(keys).toContain("top_view");
      expect(keys).toContain("building_front");
      expect(keys).toContain("main_breaker");
      expect(keys).toContain("solar_panel_nameplate");
      expect(keys).toContain("inverter_nameplate");
      expect(keys).toContain("inverter_install_point");
      expect(keys).toContain("dc_equipment");
      expect(keys).toContain("ac_equipment");
      expect(keys).toContain("electrical_panel_inside");
      expect(keys).toContain("zero_export_ct");
      expect(keys).toContain("grounding");
      expect(keys).toContain("fusionsolar_firmware");
      // Conditional categories
      expect(keys).toContain("transformer");
      expect(keys).toContain("battery_nameplate");
      expect(keys).toContain("backup_box");
      // Always present
      expect(keys).toContain("other");
    });

    it("should have isRequired/isConditional fields on categories", async () => {
      const categories = await adminCaller.installationPhotoCategory.list();
      const topView = categories.find((c: any) => c.key === "top_view");
      expect(topView).toBeDefined();
      expect(topView!.isRequired).toBe(true);
      expect(topView!.isConditional).toBe(false);

      const transformer = categories.find((c: any) => c.key === "transformer");
      expect(transformer).toBeDefined();
      expect(transformer!.isRequired).toBe(false);
      expect(transformer!.isConditional).toBe(true);
      expect(transformer!.conditionNote).toBeTruthy();

      const other = categories.find((c: any) => c.key === "other");
      expect(other).toBeDefined();
      expect(other!.isRequired).toBe(false);
      expect(other!.isConditional).toBe(false);
    });

    it("should return categories sorted by sortOrder", async () => {
      const categories = await adminCaller.installationPhotoCategory.list();
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].sortOrder).toBeGreaterThanOrEqual(categories[i - 1].sortOrder);
      }
    });

    it("should create a new installation photo category with isRequired", async () => {
      const result = await adminCaller.installationPhotoCategory.create({
        key: `test_inst_cat_${Date.now()}`,
        label: "ทดสอบประเภทรูปติดตั้งใหม่",
        sortOrder: 20,
        isRequired: true,
        isConditional: false,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      createdCategoryIds.push(result.id);
    });

    it("should appear in list after creation", async () => {
      const uniqueKey = `test_inst_list_${Date.now()}`;
      const created = await adminCaller.installationPhotoCategory.create({
        key: uniqueKey,
        label: "ทดสอบแสดงในรายการ",
        sortOrder: 21,
      });
      createdCategoryIds.push(created.id);

      const categories = await adminCaller.installationPhotoCategory.list();
      const found = categories.find((c: any) => c.key === uniqueKey);
      expect(found).toBeDefined();
      expect(found!.label).toBe("ทดสอบแสดงในรายการ");
    });

    it("should update an installation photo category label", async () => {
      const uniqueKey = `test_inst_upd_${Date.now()}`;
      const created = await adminCaller.installationPhotoCategory.create({
        key: uniqueKey,
        label: "ก่อนแก้ไข",
        sortOrder: 22,
      });
      createdCategoryIds.push(created.id);

      await adminCaller.installationPhotoCategory.update({
        id: created.id,
        label: "หลังแก้ไข",
      });
      const categories = await adminCaller.installationPhotoCategory.list();
      const updated = categories.find((c: any) => c.id === created.id);
      expect(updated!.label).toBe("หลังแก้ไข");
    });

    it("should delete a non-default category", async () => {
      const uniqueKey = `test_inst_del_${Date.now()}`;
      const created = await adminCaller.installationPhotoCategory.create({
        key: uniqueKey,
        label: "จะลบ",
        sortOrder: 23,
      });

      const result = await adminCaller.installationPhotoCategory.delete({ id: created.id });
      expect(result.success).toBe(true);

      const categories = await adminCaller.installationPhotoCategory.list();
      const found = categories.find((c: any) => c.id === created.id);
      expect(found).toBeUndefined();
    });

    it("should NOT delete the 'other' category", async () => {
      const categories = await adminCaller.installationPhotoCategory.list();
      const otherCat = categories.find((c: any) => c.key === "other");
      expect(otherCat).toBeDefined();

      await expect(
        adminCaller.installationPhotoCategory.delete({ id: otherCat!.id })
      ).rejects.toThrow();
    });
  });

  // ==================== Delivery Info ====================
  describe("Delivery Info", () => {
    it("should return delivery info for a survey", async () => {
      const info = await adminCaller.delivery.info({ surveyId: testSurveyId });
      expect(info).toBeDefined();
      expect(info.deliveryStatus).toBe("pending");
    });
  });

  // ==================== Validate For Delivery ====================
  describe("Validate For Delivery", () => {
    it("should report missing required categories when no photos uploaded", async () => {
      const validation = await adminCaller.installationPhotoCategory.validateForDelivery({ surveyId: testSurveyId });
      expect(validation).toBeDefined();
      expect(validation.requiredCount).toBeGreaterThanOrEqual(11);
      expect(validation.completedRequired).toBe(0);
      expect(validation.isComplete).toBe(false);
      expect(validation.missingRequired.length).toBeGreaterThanOrEqual(11);
      expect(validation.missingConditional.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== Delivery Submit ====================
  describe("Delivery Submit", () => {
    it("should reject submission without photos", async () => {
      await expect(
        userCaller.delivery.submit({ surveyId: testSurveyId })
      ).rejects.toThrow("กรุณาอัปโหลดรูปติดตั้งก่อนส่งมอบงาน");
    });

    it("should reject submission when required categories are missing", async () => {
      // Upload a photo to just one category
      const base64Pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      await adminCaller.installationPhoto.upload({
        surveyId: testSurveyId,
        fileName: `test-partial-${Date.now()}.png`,
        fileData: base64Pixel,
        category: "top_view",
      });

      // Should fail because not all required categories have photos
      await expect(
        userCaller.delivery.submit({ surveyId: testSurveyId })
      ).rejects.toThrow("ยังขาดรูปหมวดหมู่ที่จำเป็น");
    });

    it("should submit delivery with skipValidation flag", async () => {
      // Admin can skip validation
      const result = await adminCaller.delivery.submit({ surveyId: testSurveyId, skipValidation: true });
      expect(result).toBeDefined();
      expect(result.deliveryStatus).toBe("submitted");
      expect(result.deliverySubmittedAt).toBeTruthy();

      // Verify status changed
      const info = await adminCaller.delivery.info({ surveyId: testSurveyId });
      expect(info.deliveryStatus).toBe("submitted");
      expect(info.deliverySubmittedAt).toBeTruthy();
    });
  });

  // ==================== Delivery Approve/Reject ====================
  describe("Delivery Approve & Reject", () => {
    let approveTestSurveyId: number;
    let rejectTestSurveyId: number;

    beforeAll(async () => {
      // Create surveys for approve and reject tests
      const survey1 = await adminCaller.survey.create({
        customerId: testCustomerId,
        surveyDate: Date.now(),
        surveyTime: "11:00",
      });
      approveTestSurveyId = survey1.id;

      const survey2 = await adminCaller.survey.create({
        customerId: testCustomerId,
        surveyDate: Date.now(),
        surveyTime: "12:00",
      });
      rejectTestSurveyId = survey2.id;

      // Upload photos and submit both
      const base64Pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      await adminCaller.installationPhoto.upload({
        surveyId: approveTestSurveyId,
        fileName: "approve-test.png",
        fileData: base64Pixel,
        category: "top_view",
      });
      await adminCaller.delivery.submit({ surveyId: approveTestSurveyId, skipValidation: true });

      await adminCaller.installationPhoto.upload({
        surveyId: rejectTestSurveyId,
        fileName: "reject-test.png",
        fileData: base64Pixel,
        category: "top_view",
      });
      await adminCaller.delivery.submit({ surveyId: rejectTestSurveyId, skipValidation: true });
    });

    it("should approve delivery (admin only)", async () => {
      const result = await adminCaller.delivery.approve({ surveyId: approveTestSurveyId });
      expect(result).toBeDefined();
      expect(result.deliveryStatus).toBe("approved");
      expect(result.deliveryApprovedAt).toBeTruthy();

      const info = await adminCaller.delivery.info({ surveyId: approveTestSurveyId });
      expect(info.deliveryStatus).toBe("approved");
      expect(info.deliveryApprovedAt).toBeTruthy();
    });

    it("should reject delivery (admin only)", async () => {
      const result = await adminCaller.delivery.reject({
        surveyId: rejectTestSurveyId,
        reason: "รูปไม่ชัด กรุณาถ่ายใหม่",
      });
      expect(result).toBeDefined();
      expect(result.deliveryStatus).toBe("rejected");

      const info = await adminCaller.delivery.info({ surveyId: rejectTestSurveyId });
      expect(info.deliveryStatus).toBe("rejected");
      expect(info.deliveryRejectionReason).toBe("รูปไม่ชัด กรุณาถ่ายใหม่");
    });

    it("should NOT allow regular user to approve", async () => {
      // Create a new survey for this test
      const survey = await adminCaller.survey.create({
        customerId: testCustomerId,
        surveyDate: Date.now(),
        surveyTime: "13:00",
      });
      const base64Pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      await adminCaller.installationPhoto.upload({
        surveyId: survey.id,
        fileName: "auth-test.png",
        fileData: base64Pixel,
        category: "top_view",
      });
      await adminCaller.delivery.submit({ surveyId: survey.id, skipValidation: true });

      await expect(
        userCaller.delivery.approve({ surveyId: survey.id })
      ).rejects.toThrow();
    });

    it("should NOT allow regular user to reject", async () => {
      const survey = await adminCaller.survey.create({
        customerId: testCustomerId,
        surveyDate: Date.now(),
        surveyTime: "14:00",
      });
      const base64Pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      await adminCaller.installationPhoto.upload({
        surveyId: survey.id,
        fileName: "auth-test-reject.png",
        fileData: base64Pixel,
        category: "top_view",
      });
      await adminCaller.delivery.submit({ surveyId: survey.id, skipValidation: true });

      await expect(
        userCaller.delivery.reject({ surveyId: survey.id, reason: "test" })
      ).rejects.toThrow();
    });
  });

  // ==================== Installation Photo CRUD ====================
  describe("Installation Photo CRUD", () => {
    let uploadedPhotoId: number;

    it("should upload an installation photo", async () => {
      const base64Pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const result = await adminCaller.installationPhoto.upload({
        surveyId: testSurveyId,
        fileName: `crud-test-${Date.now()}.png`,
        fileData: base64Pixel,
        category: "top_view",
        caption: "ทดสอบอัปโหลด",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.url).toBeTruthy();
      uploadedPhotoId = result.id;
    });

    it("should list installation photos for a survey", async () => {
      const photos = await adminCaller.installationPhoto.list({ surveyId: testSurveyId });
      expect(Array.isArray(photos)).toBe(true);
      expect(photos.length).toBeGreaterThanOrEqual(1);
      const found = photos.find((p: any) => p.id === uploadedPhotoId);
      expect(found).toBeDefined();
      expect(found!.category).toBe("top_view");
    });

    it("should delete an installation photo", async () => {
      const result = await adminCaller.installationPhoto.delete({ id: uploadedPhotoId });
      expect(result.success).toBe(true);
    });
  });
});
