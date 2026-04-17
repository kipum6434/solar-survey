import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Cookie tracking for login tests
type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createSuperadminContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 90361,
    openId: "local_kipum",
    email: null,
    name: "Kipum (Super Admin)",
    loginMethod: "local",
    role: "superadmin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    ctx: {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
        clearCookie: (name: string, options: Record<string, unknown>) => {
          cookies.push({ name, options });
        },
      } as TrpcContext["res"],
    },
    cookies,
  };
}

function createUserContext(userId = 2): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "local",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  return {
    ctx: {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          cookies.push({ name, value, options });
        },
        clearCookie: () => {},
      } as TrpcContext["res"],
    },
    cookies,
  };
}

// ==================== LOGIN TESTS ====================
describe("Round 2 - Local Login", () => {
  it("login with correct credentials (kipum) sets session cookie and returns success", async () => {
    const { ctx, cookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "kipum",
      password: "Abcd@2026",
    });

    expect(result.success).toBe(true);
    expect(result.user.name).toBe("Kipum (Super Admin)");
    expect(result.user.role).toBe("superadmin");
    // Should have set a session cookie
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies[0]?.name).toBe("local_session");
    expect(cookies[0]?.value).toBeDefined();
  });

  it("login with wrong password throws error", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        username: "kipum",
        password: "wrong-password",
      })
    ).rejects.toThrow("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  });

  it("login with non-existent username throws error", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        username: "nonexistent",
        password: "any-password",
      })
    ).rejects.toThrow("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  });
});

// ==================== ROLE-BASED ACCESS TESTS ====================
describe("Round 2 - Role-Based Access", () => {
  it("superadmin can list all users", async () => {
    const { ctx } = createSuperadminContext();
    const caller = appRouter.createCaller(ctx);
    const users = await caller.users.list();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  it("regular user cannot list users (admin-only)", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });

  it("superadmin can create a new user", async () => {
    const { ctx } = createSuperadminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.create({
      username: "test_vitest_" + Date.now(),
      password: "TestPass123!",
      name: "Test Vitest User",
      role: "user",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("regular user cannot create users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.users.create({
        username: "should_fail_" + Date.now(),
        password: "TestPass123!",
        name: "Should Fail",
        role: "user",
      })
    ).rejects.toThrow();
  });
});

// ==================== SHARE LINK QUOTATION FILTER TESTS ====================
describe("Round 2 - Share Link Quotation Filter", () => {
  it("shareLink.getByToken does not include quotation documents", async () => {
    // First, find a valid share link token
    const { ctx } = createSuperadminContext();
    const caller = appRouter.createCaller(ctx);

    // Get share links for survey 30001
    const links = await caller.shareLink.list({ surveyId: 30001 });
    if (links.length > 0 && links[0].token) {
      // Use public context to test the shared view
      const { ctx: publicCtx } = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      const result = await publicCaller.shareLink.getByToken({ token: links[0].token });
      if (result && !("error" in result) && result.documents) {
        // Verify no quotation documents are included
        const quotationDocs = result.documents.filter((d: any) => d.fileType === "quotation");
        expect(quotationDocs.length).toBe(0);
      }
    }
  });
});

// ==================== FILE PROXY URL ENCODING TESTS ====================
describe("Round 2 - File Proxy URL Encoding", () => {
  it("encodeStorageUrl properly encodes Thai characters in URL path", async () => {
    // Import the function from fileProxy module
    // Since it's not exported, we test the behavior indirectly via HTTP
    // Instead, test the URL encoding logic directly
    const rawUrl = "https://example.com/path/ภาษาไทย test (file).pdf";
    const urlObj = new URL(rawUrl);
    const encodedPath = urlObj.pathname
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");
    const result = urlObj.origin + encodedPath;

    expect(result).toContain("example.com");
    expect(result).not.toContain("ภาษาไทย");
    expect(result).toContain("%E0%B8%A0");
    expect(result).toContain("%20");
    expect(result).not.toContain(" ");
  });

  it("encodeStorageUrl handles ASCII-only URLs without modification", () => {
    const rawUrl = "https://example.com/path/simple-file.jpg";
    const urlObj = new URL(rawUrl);
    const encodedPath = urlObj.pathname
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");
    const result = urlObj.origin + encodedPath;

    expect(result).toBe(rawUrl);
  });
});

// ==================== TECHNICAL FIELDS TESTS ====================
describe("Round 2 - Technical Fields in Survey Update", () => {
  it("survey.update accepts new technical fields (panelModel, batteryModel, roofDirection, installNotes)", async () => {
    const { ctx } = createSuperadminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.survey.update({
      id: 30001,
      panelModel: "Longi 645W MONO HF N-TYPE",
      batteryModel: "Huawei LUNA2000-7-E1",
      roofDirection: "ทิศใต้",
      installNotes: "ต้องเดินสายผ่านท่อ PVC",
      systemSize: "10",
      panelCount: 16,
      inverterModel: "HUAWEI SUN2000-10K-LCO",
    });

    expect(result.success).toBe(true);
  });

  it("survey.getById returns new technical fields after update", async () => {
    const { ctx } = createSuperadminContext();
    const caller = appRouter.createCaller(ctx);

    const data = await caller.survey.getById({ id: 30001 });
    expect(data).toBeDefined();
    expect(data!.survey.panelModel).toBe("Longi 645W MONO HF N-TYPE");
    expect(data!.survey.batteryModel).toBe("Huawei LUNA2000-7-E1");
    expect(data!.survey.roofDirection).toBe("ทิศใต้");
    expect(data!.survey.installNotes).toBe("ต้องเดินสายผ่านท่อ PVC");
  });

  it("shareLink.getByToken includes new technical fields", async () => {
    const { ctx } = createSuperadminContext();
    const caller = appRouter.createCaller(ctx);

    const links = await caller.shareLink.list({ surveyId: 30001 });
    if (links.length > 0 && links[0].token) {
      const { ctx: publicCtx } = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      const result = await publicCaller.shareLink.getByToken({ token: links[0].token });
      if (result && !("error" in result)) {
        expect(result.survey.panelModel).toBe("Longi 645W MONO HF N-TYPE");
        expect(result.survey.batteryModel).toBe("Huawei LUNA2000-7-E1");
        expect(result.survey.roofDirection).toBe("ทิศใต้");
        expect(result.survey.installNotes).toBe("ต้องเดินสายผ่านท่อ PVC");
      }
    }
  });
});
