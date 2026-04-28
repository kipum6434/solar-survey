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

describe("Survey Share Link Feature", () => {
  it("getByToken returns error for invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shareLink.getByToken({ token: "nonexistent-token" });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("error");
  });

  it("listByType returns empty array for non-existent survey", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const surveyLinks = await caller.shareLink.listByType({ surveyId: 999999, linkType: "survey" });
    expect(Array.isArray(surveyLinks)).toBe(true);
    expect(surveyLinks.length).toBe(0);
  });

  it("listByType with installation type returns empty for non-existent survey", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const installLinks = await caller.shareLink.listByType({ surveyId: 999999, linkType: "installation" });
    expect(Array.isArray(installLinks)).toBe(true);
    expect(installLinks.length).toBe(0);
  });

  it("publicUploadSurveyPhoto rejects invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUploadSurveyPhoto({
        token: "invalid-token",
        surveyId: 1,
        fileName: "test.jpg",
        base64Data: "dGVzdA==",
        category: "roof_overview",
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow();
  });

  it("publicDeleteSurveyPhoto rejects invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicDeleteSurveyPhoto({
        token: "invalid-token",
        surveyId: 1,
        id: 1,
      })
    ).rejects.toThrow();
  });

  it("publicUpdateSurveyTechnical rejects invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateSurveyTechnical({
        token: "invalid-token",
        surveyId: 1,
        systemSize: "5.0",
      })
    ).rejects.toThrow();
  });

  it("create share link requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.create({
        surveyId: 1,
        linkType: "survey",
        expiresInDays: 3,
      })
    ).rejects.toThrow();
  });

  it("publicCompleteSurvey rejects invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.survey.publicCompleteSurvey({
        token: "invalid-token",
        surveyId: 1,
      })
    ).rejects.toThrow();
  });
});
