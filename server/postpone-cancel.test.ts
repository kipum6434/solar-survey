import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module (imported as `import * as db from "./db"`)
vi.mock("./db", () => ({
  getSurveyById: vi.fn(),
  getSurveyWithCustomer: vi.fn(),
  getShareLinkByToken: vi.fn(),
  createPostponeCancelLog: vi.fn(),
  updateSurvey: vi.fn(),
  getPostponeCancelLogs: vi.fn(),
  logActivity: vi.fn(),
}));

// Mock notification modules
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));
vi.mock("./lineNotify", () => ({
  sendLineNotification: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";

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
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("survey.postponeSurvey (protected)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("postpones a survey and creates a log", async () => {
    (db.getSurveyById as any).mockResolvedValue({ id: 1, status: "scheduled", scheduledDate: Date.now() });
    (db.getSurveyWithCustomer as any).mockResolvedValue({ customer: { name: "ลูกค้าทดสอบ" } });
    (db.createPostponeCancelLog as any).mockResolvedValue({ insertId: 1 });
    (db.updateSurvey as any).mockResolvedValue({});
    (db.logActivity as any).mockResolvedValue({});

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.postponeSurvey({
      id: 1,
      reason: "ลูกค้าติดธุระ",
      actionBy: "Admin User",
      actionByRole: "admin",
    });

    expect(result).toEqual({ success: true });
    expect(db.createPostponeCancelLog).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId: 1,
        action: "postpone_survey",
        reason: "ลูกค้าติดธุระ",
        actionBy: "Admin User",
        actionByRole: "admin",
      })
    );
    expect(db.updateSurvey).toHaveBeenCalledWith(1, expect.objectContaining({ status: "postponed" }));
  });

  it("throws NOT_FOUND if survey does not exist", async () => {
    (db.getSurveyById as any).mockResolvedValue(null);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.survey.postponeSurvey({
        id: 999,
        reason: "ไม่มีงาน",
        actionBy: "Admin",
        actionByRole: "admin",
      })
    ).rejects.toThrow();
  });
});

describe("survey.cancelSurvey (protected)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a survey and creates a log", async () => {
    (db.getSurveyById as any).mockResolvedValue({ id: 2, status: "pending", scheduledDate: null });
    (db.getSurveyWithCustomer as any).mockResolvedValue({ customer: { name: "ลูกค้า B" } });
    (db.createPostponeCancelLog as any).mockResolvedValue({ insertId: 2 });
    (db.updateSurvey as any).mockResolvedValue({});
    (db.logActivity as any).mockResolvedValue({});

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.cancelSurvey({
      id: 2,
      reason: "ลูกค้ายกเลิกโปรเจค",
      actionBy: "Admin User",
      actionByRole: "admin",
    });

    expect(result).toEqual({ success: true });
    expect(db.createPostponeCancelLog).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId: 2,
        action: "cancel_survey",
        reason: "ลูกค้ายกเลิกโปรเจค",
      })
    );
    expect(db.updateSurvey).toHaveBeenCalledWith(2, expect.objectContaining({ status: "cancelled" }));
  });
});

describe("survey.getPostponeCancelLogs (protected)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns logs for a given survey", async () => {
    const mockLogs = [
      { id: 1, surveyId: 1, action: "postpone_survey", reason: "ฝนตก", actionBy: "เซลล์ A", createdAt: Date.now() },
      { id: 2, surveyId: 1, action: "cancel_survey", reason: "ลูกค้ายกเลิก", actionBy: "Admin", createdAt: Date.now() },
    ];
    (db.getPostponeCancelLogs as any).mockResolvedValue(mockLogs);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.getPostponeCancelLogs({ surveyId: 1 });

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe("postpone_survey");
    expect(db.getPostponeCancelLogs).toHaveBeenCalledWith(1);
  });
});

describe("survey.publicPostponeSurvey (public)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("postpones a survey via public link", async () => {
    (db.getShareLinkByToken as any).mockResolvedValue({ id: 1, surveyId: 10, isActive: true, expiresAt: null });
    (db.getSurveyById as any).mockResolvedValue({ id: 10, status: "scheduled", scheduledDate: Date.now() });
    (db.getSurveyWithCustomer as any).mockResolvedValue({ customer: { name: "ลูกค้า C" } });
    (db.createPostponeCancelLog as any).mockResolvedValue({ insertId: 3 });
    (db.updateSurvey as any).mockResolvedValue({});

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.publicPostponeSurvey({
      token: "valid-token",
      surveyId: 10,
      reason: "ลูกค้าไม่อยู่บ้าน",
      actionBy: "เซลล์ สมชาย",
      actionByRole: "surveyor",
    });

    expect(result).toEqual({ success: true });
    expect(db.updateSurvey).toHaveBeenCalledWith(10, expect.objectContaining({ status: "postponed" }));
  });

  it("throws NOT_FOUND for invalid token", async () => {
    (db.getShareLinkByToken as any).mockResolvedValue(null);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.survey.publicPostponeSurvey({
        token: "invalid-token",
        surveyId: 10,
        reason: "test",
        actionBy: "test",
        actionByRole: "surveyor",
      })
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND for expired link", async () => {
    (db.getShareLinkByToken as any).mockResolvedValue({ id: 1, surveyId: 10, isActive: true, expiresAt: Date.now() - 100000 });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.survey.publicPostponeSurvey({
        token: "expired-token",
        surveyId: 10,
        reason: "test",
        actionBy: "test",
        actionByRole: "surveyor",
      })
    ).rejects.toThrow();
  });
});

describe("survey.publicPostponeInstallation (public)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("postpones installation via public link", async () => {
    (db.getShareLinkByToken as any).mockResolvedValue({ id: 1, surveyId: 5, isActive: true, expiresAt: null });
    (db.getSurveyById as any).mockResolvedValue({ id: 5, installationDate: Date.now(), installationStatus: "waiting" });
    (db.getSurveyWithCustomer as any).mockResolvedValue({ customer: { name: "ลูกค้า D" } });
    (db.createPostponeCancelLog as any).mockResolvedValue({ insertId: 4 });
    (db.updateSurvey as any).mockResolvedValue({});

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.publicPostponeInstallation({
      token: "install-token",
      surveyId: 5,
      reason: "อุปกรณ์ยังไม่มา",
      actionBy: "ช่าง สมศักดิ์",
      actionByRole: "installer",
    });

    expect(result).toEqual({ success: true });
    expect(db.createPostponeCancelLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "postpone_install",
        reason: "อุปกรณ์ยังไม่มา",
      })
    );
    expect(db.updateSurvey).toHaveBeenCalledWith(5, expect.objectContaining({ installationStatus: "postponed" }));
  });

  it("postpones installation with newDate via public link", async () => {
    const newDate = new Date("2026-07-15").getTime();
    (db.getShareLinkByToken as any).mockResolvedValue({ id: 1, surveyId: 5, isActive: true, expiresAt: null });
    (db.getSurveyById as any).mockResolvedValue({ id: 5, installationDate: Date.now(), installationStatus: "waiting" });
    (db.getSurveyWithCustomer as any).mockResolvedValue({ customer: { name: "ลูกค้า E" } });
    (db.createPostponeCancelLog as any).mockResolvedValue({ insertId: 5 });
    (db.updateSurvey as any).mockResolvedValue({});

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.publicPostponeInstallation({
      token: "install-token-2",
      surveyId: 5,
      reason: "ลูกค้าขอเลื่อนวัน",
      actionBy: "ช่าง สมชาย",
      actionByRole: "installer",
      newDate,
    });

    expect(result).toEqual({ success: true });
    expect(db.createPostponeCancelLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "postpone_install",
        reason: "ลูกค้าขอเลื่อนวัน",
        newDate,
      })
    );
    expect(db.updateSurvey).toHaveBeenCalledWith(5, expect.objectContaining({ installationStatus: "postponed", installationDate: newDate }));
  });
});

describe("survey.postponeInstallation (protected) - with newDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("postpones installation and updates installationDate when newDate is provided", async () => {
    const newDate = new Date("2026-08-01").getTime();
    (db.getSurveyById as any).mockResolvedValue({ id: 7, installationDate: Date.now(), installationStatus: "waiting" });
    (db.getSurveyWithCustomer as any).mockResolvedValue({ customer: { name: "ลูกค้า F" } });
    (db.createPostponeCancelLog as any).mockResolvedValue({ insertId: 6 });
    (db.updateSurvey as any).mockResolvedValue({});
    (db.logActivity as any).mockResolvedValue({});

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.postponeInstallation({
      id: 7,
      reason: "อุปกรณ์ไม่พร้อม",
      newDate,
    });

    expect(result).toEqual({ success: true });
    expect(db.createPostponeCancelLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "postpone_install",
        reason: "อุปกรณ์ไม่พร้อม",
        newDate,
      })
    );
    expect(db.updateSurvey).toHaveBeenCalledWith(7, expect.objectContaining({ installationStatus: "postponed", installationDate: newDate }));
  });

  it("postpones installation without changing date when newDate is not provided", async () => {
    (db.getSurveyById as any).mockResolvedValue({ id: 8, installationDate: Date.now(), installationStatus: "waiting" });
    (db.getSurveyWithCustomer as any).mockResolvedValue({ customer: { name: "ลูกค้า G" } });
    (db.createPostponeCancelLog as any).mockResolvedValue({ insertId: 7 });
    (db.updateSurvey as any).mockResolvedValue({});
    (db.logActivity as any).mockResolvedValue({});

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.postponeInstallation({
      id: 8,
      reason: "ลูกค้าไม่สะดวก",
    });

    expect(result).toEqual({ success: true });
    // Should NOT include installationDate in update
    expect(db.updateSurvey).toHaveBeenCalledWith(8, { installationStatus: "postponed" });
  });
});

describe("survey.reopenSurvey (protected)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reopens a cancelled survey back to pending", async () => {
    (db.getSurveyById as any).mockResolvedValue({ id: 3, status: "cancelled" });
    (db.updateSurvey as any).mockResolvedValue({});
    (db.logActivity as any).mockResolvedValue({});

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.reopenSurvey({ id: 3, newStatus: "pending" });

    expect(result).toEqual({ success: true });
    expect(db.updateSurvey).toHaveBeenCalledWith(3, expect.objectContaining({ status: "pending" }));
  });
});
