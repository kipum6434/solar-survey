import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getLatestFollowUpBySurvey: vi.fn().mockResolvedValue({ id: 1, round: 1, status: "pending" }),
  updateFollowUp: vi.fn().mockResolvedValue(undefined),
  createFollowUp: vi.fn().mockResolvedValue(100),
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

function createAuthContext() {
  const user = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus" as const,
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("followUp.advanceRound", () => {
  it("should advance from round 1 to round 2", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.followUp.advanceRound({
      surveyId: 1,
      customerId: 1,
      currentRound: 1,
    });

    expect(result).toEqual({ success: true, newRound: 2 });
  });

  it("should advance from round 2 to round 3", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.followUp.advanceRound({
      surveyId: 1,
      customerId: 1,
      currentRound: 2,
    });

    expect(result).toEqual({ success: true, newRound: 3 });
  });

  it("should advance with a note", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.followUp.advanceRound({
      surveyId: 1,
      customerId: 1,
      currentRound: 1,
      note: "ลูกค้ายังไม่ตัดสินใจ",
    });

    expect(result).toEqual({ success: true, newRound: 2 });
  });

  it("should reject advancing beyond round 3", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.followUp.advanceRound({
        surveyId: 1,
        customerId: 1,
        currentRound: 3,
      })
    ).rejects.toThrow();
  });
});
