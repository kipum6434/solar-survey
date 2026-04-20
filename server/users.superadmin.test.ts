import { describe, it, expect, vi } from "vitest";

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { appRouter } from "./routers";

function createMockContext(user: { id: number; role: string; name: string } | null) {
  return {
    user,
    req: {} as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

describe("Users Router - Superadmin Access Control", () => {
  it("superadmin can list users", async () => {
    const caller = appRouter.createCaller(
      createMockContext({ id: 1, role: "superadmin", name: "Super Admin" }) as any
    );
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("admin CANNOT list users (FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(
      createMockContext({ id: 2, role: "admin", name: "Admin User" }) as any
    );
    await expect(caller.users.list()).rejects.toThrow("เฉพาะ Super Admin เท่านั้นที่มีสิทธิ์เข้าถึง");
  });

  it("regular user CANNOT list users (FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(
      createMockContext({ id: 3, role: "user", name: "Normal User" }) as any
    );
    await expect(caller.users.list()).rejects.toThrow("เฉพาะ Super Admin เท่านั้นที่มีสิทธิ์เข้าถึง");
  });

  it("admin CANNOT create users (FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(
      createMockContext({ id: 2, role: "admin", name: "Admin User" }) as any
    );
    await expect(
      caller.users.create({
        name: "New User",
        username: "newuser_test",
        password: "pass1234",
        role: "user",
      })
    ).rejects.toThrow("เฉพาะ Super Admin เท่านั้นที่มีสิทธิ์เข้าถึง");
  });

  it("admin CANNOT delete users (FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(
      createMockContext({ id: 2, role: "admin", name: "Admin User" }) as any
    );
    await expect(caller.users.delete({ id: 3 })).rejects.toThrow("เฉพาะ Super Admin เท่านั้นที่มีสิทธิ์เข้าถึง");
  });

  it("admin CANNOT reset password (FORBIDDEN)", async () => {
    const caller = appRouter.createCaller(
      createMockContext({ id: 2, role: "admin", name: "Admin User" }) as any
    );
    await expect(
      caller.users.resetPassword({ id: 3, newPassword: "newpass123" })
    ).rejects.toThrow("เฉพาะ Super Admin เท่านั้นที่มีสิทธิ์เข้าถึง");
  });

  it("unauthenticated user CANNOT list users", async () => {
    const caller = appRouter.createCaller(
      createMockContext(null) as any
    );
    await expect(caller.users.list()).rejects.toThrow();
  });
});
