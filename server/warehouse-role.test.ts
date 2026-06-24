import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContextWithRole(role: string): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-" + role,
    email: `${role}@example.com`,
    name: `Test ${role}`,
    loginMethod: "manus",
    role: role as any,
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

function createUnauthContext(): TrpcContext {
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

describe("Warehouse Role RBAC", () => {
  describe("warehouse user can access installation.list", () => {
    it("allows warehouse user to call installation.list", async () => {
      const ctx = createContextWithRole("warehouse");
      const caller = appRouter.createCaller(ctx);

      // Should not throw FORBIDDEN - it may throw DB error but not auth error
      try {
        await caller.installation.list({ page: 1, limit: 10 });
      } catch (e: any) {
        // If it throws, it should NOT be FORBIDDEN or UNAUTHORIZED
        expect(e.code).not.toBe("FORBIDDEN");
        expect(e.code).not.toBe("UNAUTHORIZED");
      }
    });
  });

  describe("warehouse user cannot access admin-only procedures", () => {
    it("denies warehouse user from users.list", async () => {
      const ctx = createContextWithRole("warehouse");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.users.list()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("denies warehouse user from users.create", async () => {
      const ctx = createContextWithRole("warehouse");
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.users.create({
          name: "Test",
          username: "test123",
          password: "password123",
          role: "user",
        })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  describe("admin can still access all procedures", () => {
    it("allows admin to call installation.list", async () => {
      const ctx = createContextWithRole("admin");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.installation.list({ page: 1, limit: 10 });
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
        expect(e.code).not.toBe("UNAUTHORIZED");
      }
    });

    it("allows superadmin to call users.list", async () => {
      const ctx = createContextWithRole("superadmin");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.users.list();
      } catch (e: any) {
        expect(e.code).not.toBe("FORBIDDEN");
        expect(e.code).not.toBe("UNAUTHORIZED");
      }
    });
  });

  describe("unauthenticated user cannot access protected procedures", () => {
    it("denies unauthenticated user from installation.list", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.installation.list({ page: 1, limit: 10 })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
