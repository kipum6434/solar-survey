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
      openId: "admin-test-photocat",
    } as AuthenticatedUser,
  };
}

function createPublicContext(): TrpcContext {
  return { user: null } as any;
}

describe("Photo Category CRUD", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());

  describe("list", () => {
    it("should list photo categories (public)", async () => {
      const categories = await publicCaller.photoCategory.list();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThanOrEqual(7); // 7 default seeded
      // Check default categories exist
      const keys = categories.map((c: any) => c.key);
      expect(keys).toContain("roof_overview");
      expect(keys).toContain("electrical_panel");
      expect(keys).toContain("other");
    });

    it("should return categories sorted by sortOrder", async () => {
      const categories = await publicCaller.photoCategory.list();
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].sortOrder).toBeGreaterThanOrEqual(categories[i - 1].sortOrder);
      }
    });
  });

  describe("create", () => {
    it("should create a new photo category", async () => {
      const result = await adminCaller.photoCategory.create({
        key: `test_cat_${Date.now()}`,
        label: "ทดสอบประเภทใหม่",
        sortOrder: 10,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    it("should appear in list after creation", async () => {
      const uniqueKey = `test_list_${Date.now()}`;
      await adminCaller.photoCategory.create({
        key: uniqueKey,
        label: "ทดสอบแสดงในรายการ",
        sortOrder: 11,
      });
      const categories = await publicCaller.photoCategory.list();
      const found = categories.find((c: any) => c.key === uniqueKey);
      expect(found).toBeDefined();
      expect(found!.label).toBe("ทดสอบแสดงในรายการ");
    });
  });

  describe("update", () => {
    it("should update a photo category label", async () => {
      const uniqueKey = `test_update_${Date.now()}`;
      const created = await adminCaller.photoCategory.create({
        key: uniqueKey,
        label: "ก่อนแก้ไข",
        sortOrder: 12,
      });
      await adminCaller.photoCategory.update({
        id: created.id,
        label: "หลังแก้ไข",
      });
      const categories = await publicCaller.photoCategory.list();
      const updated = categories.find((c: any) => c.id === created.id);
      expect(updated!.label).toBe("หลังแก้ไข");
    });
  });

  describe("delete", () => {
    it("should delete a non-default category", async () => {
      const uniqueKey = `test_delete_${Date.now()}`;
      const created = await adminCaller.photoCategory.create({
        key: uniqueKey,
        label: "จะลบ",
        sortOrder: 13,
      });
      const result = await adminCaller.photoCategory.delete({ id: created.id });
      expect(result.success).toBe(true);

      const categories = await publicCaller.photoCategory.list();
      const found = categories.find((c: any) => c.id === created.id);
      expect(found).toBeUndefined();
    });

    it("should NOT delete a default category", async () => {
      const categories = await publicCaller.photoCategory.list();
      const defaultCat = categories.find((c: any) => c.isDefault === true);
      expect(defaultCat).toBeDefined();

      await expect(
        adminCaller.photoCategory.delete({ id: defaultCat!.id })
      ).rejects.toThrow();
    });
  });

  describe("photo upload with dynamic category", () => {
    let testCustomerId: number;
    let testSurveyId: number;

    beforeAll(async () => {
      const customer = await adminCaller.customer.create({
        name: "ลูกค้าทดสอบ PhotoCat " + Date.now(),
        phone: "0888888888",
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

    it("should accept any string category for photo upload", async () => {
      // Create a tiny 1x1 pixel PNG as base64
      const base64Pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const result = await adminCaller.photo.upload({
        surveyId: testSurveyId,
        customerId: testCustomerId,
        fileName: `test-dynamic-cat-${Date.now()}.png`,
        category: "custom_test_category",
        base64Data: base64Pixel,
        mimeType: "image/png",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });
  });
});
