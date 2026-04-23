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
      openId: "admin-test-doccat",
    } as AuthenticatedUser,
  };
}

function createPublicContext(): TrpcContext {
  return { user: null } as any;
}

describe("Document Category CRUD", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());

  // Track all test-created category IDs for cleanup
  const createdCategoryIds: number[] = [];

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      try {
        await adminCaller.documentCategory.delete({ id });
      } catch {
        // Ignore errors (already deleted in tests)
      }
    }
  });

  describe("list", () => {
    it("should list document categories (public)", async () => {
      const categories = await publicCaller.documentCategory.list();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThanOrEqual(6); // 6 default seeded
      const keys = categories.map((c: any) => c.key);
      expect(keys).toContain("quotation");
      expect(keys).toContain("contract");
      expect(keys).toContain("other");
    });

    it("should return categories sorted by sortOrder", async () => {
      const categories = await publicCaller.documentCategory.list();
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].sortOrder).toBeGreaterThanOrEqual(categories[i - 1].sortOrder);
      }
    });
  });

  describe("create", () => {
    it("should create a new document category", async () => {
      const result = await adminCaller.documentCategory.create({
        key: `test_doc_cat_${Date.now()}`,
        label: "ทดสอบประเภทเอกสารใหม่",
        sortOrder: 20,
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      createdCategoryIds.push(result.id);
    });

    it("should appear in list after creation", async () => {
      const uniqueKey = `test_doc_list_${Date.now()}`;
      const created = await adminCaller.documentCategory.create({
        key: uniqueKey,
        label: "ทดสอบแสดงในรายการเอกสาร",
        sortOrder: 21,
      });
      createdCategoryIds.push(created.id);

      const categories = await publicCaller.documentCategory.list();
      const found = categories.find((c: any) => c.key === uniqueKey);
      expect(found).toBeDefined();
      expect(found!.label).toBe("ทดสอบแสดงในรายการเอกสาร");
    });
  });

  describe("update", () => {
    it("should update a document category label", async () => {
      const uniqueKey = `test_doc_update_${Date.now()}`;
      const created = await adminCaller.documentCategory.create({
        key: uniqueKey,
        label: "ก่อนแก้ไข",
        sortOrder: 22,
      });
      createdCategoryIds.push(created.id);

      await adminCaller.documentCategory.update({
        id: created.id,
        label: "หลังแก้ไขเอกสาร",
      });
      const categories = await publicCaller.documentCategory.list();
      const updated = categories.find((c: any) => c.id === created.id);
      expect(updated!.label).toBe("หลังแก้ไขเอกสาร");
    });
  });

  describe("delete", () => {
    it("should delete a non-default category", async () => {
      const uniqueKey = `test_doc_delete_${Date.now()}`;
      const created = await adminCaller.documentCategory.create({
        key: uniqueKey,
        label: "จะลบเอกสาร",
        sortOrder: 23,
      });

      const result = await adminCaller.documentCategory.delete({ id: created.id });
      expect(result.success).toBe(true);

      const categories = await publicCaller.documentCategory.list();
      const found = categories.find((c: any) => c.id === created.id);
      expect(found).toBeUndefined();
    });

    it("should NOT delete the 'other' category", async () => {
      const categories = await publicCaller.documentCategory.list();
      const otherCat = categories.find((c: any) => c.key === 'other');
      expect(otherCat).toBeDefined();

      await expect(
        adminCaller.documentCategory.delete({ id: otherCat!.id })
      ).rejects.toThrow();
    });

    it("should allow deleting a default category (non-other)", async () => {
      const uniqueKey = `test_doc_del_default_${Date.now()}`;
      const created = await adminCaller.documentCategory.create({
        key: uniqueKey,
        label: "ทดสอบลบ default doc",
        sortOrder: 24,
      });
      const result = await adminCaller.documentCategory.delete({ id: created.id });
      expect(result.success).toBe(true);
    });
  });
});
