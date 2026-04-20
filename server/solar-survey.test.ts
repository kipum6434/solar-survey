import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

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

describe("Solar Survey - Auth", () => {
  it("returns user for authenticated context", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });

  it("returns null for unauthenticated context", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("Solar Survey - Dashboard", () => {
  it("dashboard.stats returns stats object for authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalCustomers).toBe("number");
    expect(typeof stats.totalSurveys).toBe("number");
    expect(typeof stats.pendingSurveys).toBe("number");
    expect(typeof stats.completedSurveys).toBe("number");
    expect(typeof stats.wonDeals).toBe("number");
    expect(typeof stats.pendingFollowUps).toBe("number");
  });

  it("dashboard.recentActivities returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const activities = await caller.dashboard.recentActivities({ limit: 5 });
    expect(Array.isArray(activities)).toBe(true);
  });
});

describe("Solar Survey - Customer CRUD", () => {
  it("customer.list returns paginated data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("customer.create creates a new customer", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const id = await caller.customer.create({
      name: "Test Customer Vitest " + Date.now(),
      phone: "0812345678",
      email: "test@vitest.com",
      address: "123 Test Street",
      province: "Bangkok",
      source: "website",
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe("object");
    expect(id).toHaveProperty("id");
    expect(typeof id.id).toBe("number");
    expect(id.id).toBeGreaterThan(0);
  });

  it("customer.getById returns created customer", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Get the latest customer
    const list = await caller.customer.list({ page: 1, limit: 1 });
    if (list.data.length > 0) {
      const customer = await caller.customer.getById({ id: list.data[0].id });
      expect(customer).toBeDefined();
      expect(customer?.name).toBeDefined();
    }
  });
});

describe("Solar Survey - Survey CRUD", () => {
  it("survey.list returns paginated data with customer info", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });
});

describe("Solar Survey - Calendar", () => {
  it("calendar.events returns surveys and followUps arrays", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const now = Date.now();
    const result = await caller.calendar.events({
      startDate: now - 30 * 24 * 60 * 60 * 1000,
      endDate: now + 30 * 24 * 60 * 60 * 1000,
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result.surveys)).toBe(true);
    expect(Array.isArray(result.followUps)).toBe(true);
  });
});

describe("Solar Survey - Notifications", () => {
  it("notification.list returns array for authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notification.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("notification.unreadCount returns a number", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const count = await caller.notification.unreadCount();
    expect(typeof count).toBe("number");
  });
});

describe("Solar Survey - Share Link (Public)", () => {
  it("shareLink.getByToken returns error for invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shareLink.getByToken({ token: "invalid-token-xyz" });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("error");
  });
});

describe("Solar Survey - Users", () => {
  it("users.list returns array of users for superadmin", async () => {
    const ctx = createAdminContext();
    // Override role to superadmin for users.list access
    (ctx.user as any).role = "superadmin";
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("users.list rejects admin role", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("Solar Survey - Storage", () => {
  it("storage.stats returns storage usage data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.storage.stats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalPhotos).toBe("number");
    expect(typeof stats.totalDocuments).toBe("number");
    expect(typeof stats.totalPhotoSize).toBe("number");
    // totalDocumentSize may come as string from SQL SUM
    expect(Number(stats.totalDocumentSize)).toBeGreaterThanOrEqual(0);
    expect(stats.totalPhotos).toBeGreaterThanOrEqual(0);
    expect(stats.totalDocuments).toBeGreaterThanOrEqual(0);
  });
});

describe("Solar Survey - Photo Delete", () => {
  it("photo.delete requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.photo.delete({ id: 999 })).rejects.toThrow();
  });
});

describe("Solar Survey - Document Delete", () => {
  it("document.delete requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.document.delete({ id: 999 })).rejects.toThrow();
  });
});

describe("Solar Survey - Month/Year Filter", () => {
  it("customer.list accepts month and year parameters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10, month: 4, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("customer.list with year-only filter works", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("customer.list without month/year returns all", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("survey.list accepts month and year parameters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, month: 4, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("survey.list with year-only filter works", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("customer.list with future month returns empty", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10, month: 12, year: 2030 });
    expect(result).toBeDefined();
    expect(result.data.length).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("Solar Survey - Source Management", () => {
  it("source.list returns array of sources", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.source.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("source.create creates a new source", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.source.create({ name: "FB เพจ TCS Test" });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("source.create returns existing source if name already exists", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const first = await caller.source.create({ name: "FB เพจ Duplicate Test" });
    const second = await caller.source.create({ name: "FB เพจ Duplicate Test" });
    expect(first.id).toBe(second.id);
  });

  it("survey.list accepts source filter parameter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, source: "website" });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("survey.list with non-existent source returns empty", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, source: "nonexistent_source_xyz" });
    expect(result).toBeDefined();
    expect(result.data.length).toBe(0);
  });
});

describe("Solar Survey - Survey Assignments", () => {
  it("survey.getById returns assignments array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Get first survey from list
    const list = await caller.survey.list({ page: 1, limit: 1 });
    if (list.data.length > 0) {
      const surveyId = list.data[0].survey.id;
      const detail = await caller.survey.getById({ id: surveyId });
      expect(detail).toBeDefined();
      expect(Array.isArray((detail as any).assignments)).toBe(true);
    }
  });

  it("survey.update with assignment fields works", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const list = await caller.survey.list({ page: 1, limit: 1 });
    if (list.data.length > 0) {
      const surveyId = list.data[0].survey.id;
      // Update with admin sender and surveyor
      await expect(
        caller.survey.update({
          id: surveyId,
          status: "scheduled",
          adminSenderId: 1,
          surveyorIds: [1],
        })
      ).resolves.toBeDefined();

      // Verify assignments were saved
      const detail = await caller.survey.getById({ id: surveyId });
      const assignments = (detail as any).assignments || [];
      const adminSender = assignments.find((a: any) => a.assignment.role === "admin_sender");
      const surveyors = assignments.filter((a: any) => a.assignment.role === "surveyor");
      expect(adminSender).toBeDefined();
      expect(surveyors.length).toBeGreaterThan(0);
    }
  });
});
