import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getPhotoCategories: vi.fn().mockResolvedValue([
      { id: 1, key: "หลังคามุมกว้าง_ภาพโดรน", label: "หลังคามุมกว้าง (ภาพโดรน)", sortOrder: 50, isDefault: false },
      { id: 2, key: "ตู้ไฟ_เปิดฝา", label: "ตู้ไฟ (เปิดฝา)", sortOrder: 50, isDefault: false },
      { id: 3, key: "อื่นๆ", label: "อื่นๆ", sortOrder: 99, isDefault: false },
    ]),
  };
});

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("photoCategory.list", () => {
  it("returns photo categories from database (public procedure)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photoCategory.list();

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      key: "หลังคามุมกว้าง_ภาพโดรน",
      label: "หลังคามุมกว้าง (ภาพโดรน)",
    });
    expect(result[2]).toMatchObject({
      key: "อื่นๆ",
      label: "อื่นๆ",
    });
  });

  it("categories have required fields: key, label, sortOrder", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.photoCategory.list();

    for (const cat of result) {
      expect(cat).toHaveProperty("key");
      expect(cat).toHaveProperty("label");
      expect(cat).toHaveProperty("sortOrder");
      expect(typeof cat.key).toBe("string");
      expect(typeof cat.label).toBe("string");
      expect(typeof cat.sortOrder).toBe("number");
    }
  });
});
