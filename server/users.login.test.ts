import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import bcrypt from "bcryptjs";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock db module
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getUserByUsername: vi.fn(),
    upsertUser: vi.fn(),
    logActivity: vi.fn(),
  };
});

// Mock sdk module
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  },
}));

import * as db from "./db";

function createPublicContext() {
  const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies[name] = { value, options };
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookies };
}

function createAdminContext() {
  const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};

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

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies[name] = { value, options };
      },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookies };
}

describe("users.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects login with non-existent username", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    (db.getUserByUsername as any).mockResolvedValue(null);

    await expect(
      caller.users.login({ username: "nonexistent", password: "test1234" })
    ).rejects.toThrow("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  });

  it("rejects login with wrong password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const hashedPassword = await bcrypt.hash("correctpassword", 10);
    (db.getUserByUsername as any).mockResolvedValue({
      id: 2,
      openId: "manual-user-123",
      name: "Test User",
      username: "testuser",
      passwordHash: hashedPassword,
      role: "user",
    });

    await expect(
      caller.users.login({ username: "testuser", password: "wrongpassword" })
    ).rejects.toThrow("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  });

  it("succeeds with correct credentials and sets cookie", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const hashedPassword = await bcrypt.hash("mypassword", 10);
    (db.getUserByUsername as any).mockResolvedValue({
      id: 2,
      openId: "manual-user-123",
      name: "Test User",
      username: "testuser",
      passwordHash: hashedPassword,
      role: "user",
    });

    const result = await caller.users.login({ username: "testuser", password: "mypassword" });

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 2,
      name: "Test User",
      role: "user",
    });
    // Check that a session cookie was set
    expect(Object.keys(cookies).length).toBeGreaterThan(0);
  });

  it("rejects login for user without passwordHash", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    (db.getUserByUsername as any).mockResolvedValue({
      id: 3,
      openId: "oauth-user",
      name: "OAuth User",
      username: null,
      passwordHash: null,
      role: "user",
    });

    await expect(
      caller.users.login({ username: "oauthuser", password: "test1234" })
    ).rejects.toThrow("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  });
});

describe("users.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires username and password for new user creation", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Missing username should fail validation
    await expect(
      caller.users.create({ name: "New User", username: "ab", password: "test1234", role: "user" })
    ).rejects.toThrow(); // username too short (min 3)
  });

  it("requires password with min 4 characters", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.users.create({ name: "New User", username: "newuser", password: "abc", role: "user" })
    ).rejects.toThrow(); // password too short (min 4)
  });
});
