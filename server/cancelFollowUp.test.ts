import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";

describe("followUp.cancelFollowUp", () => {
  it("should require surveyId and reason", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "admin" },
    } as any);

    // Missing reason should fail validation
    await expect(
      caller.followUp.cancelFollowUp({ surveyId: 1, reason: "" })
    ).rejects.toThrow();
  });

  it("should accept valid cancel request with reason", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "admin" },
    } as any);

    // This will fail because survey doesn't exist, but it validates the input schema works
    try {
      await caller.followUp.cancelFollowUp({
        surveyId: 99999,
        reason: "ได้เจ้าที่ถูกกว่า",
      });
    } catch (e: any) {
      // Expected to fail because survey doesn't exist, but input validation passed
      expect(e.message).not.toContain("Expected");
      expect(e.message).not.toContain("Required");
    }
  });

  it("should accept custom reason (อื่นๆ)", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "admin" },
    } as any);

    try {
      await caller.followUp.cancelFollowUp({
        surveyId: 99999,
        reason: "ลูกค้าย้ายบ้าน",
      });
    } catch (e: any) {
      // Input validation passed, error is from DB lookup
      expect(e.message).not.toContain("Expected");
      expect(e.message).not.toContain("Required");
    }
  });
});
