import { describe, it, expect } from "vitest";
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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Follow-ups Page - listWithDetails procedure", () => {
  it("should exist as a procedure on the followUp router", () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.followUp.listWithDetails).toBeDefined();
  });

  it("should return an array when called without filters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.followUp.listWithDetails({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("should accept status filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.followUp.listWithDetails({ status: "pending" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should accept method filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.followUp.listWithDetails({ method: "phone" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should accept date range filters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const now = Date.now();
    const result = await caller.followUp.listWithDetails({
      startDate: now - 86400000 * 30,
      endDate: now,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should accept search filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.followUp.listWithDetails({ search: "test" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should accept all filters combined", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const now = Date.now();
    const result = await caller.followUp.listWithDetails({
      status: "completed",
      method: "line",
      startDate: now - 86400000 * 30,
      endDate: now,
      search: "test",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("should reject unauthenticated access", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.followUp.listWithDetails({})).rejects.toThrow();
  });
});
