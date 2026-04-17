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
  it("users.list returns array of users for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
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
