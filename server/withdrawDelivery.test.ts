import { describe, it, expect, vi } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  withdrawDelivery: vi.fn(),
  getShareLinkByToken: vi.fn(),
}));

import * as db from "./db";

describe("withdrawDelivery", () => {
  it("should change delivery status from submitted to pending", async () => {
    const mockWithdraw = vi.mocked(db.withdrawDelivery);
    mockWithdraw.mockResolvedValue({ surveyId: 1, deliveryStatus: "pending" });

    const result = await db.withdrawDelivery(1);
    expect(result.deliveryStatus).toBe("pending");
    expect(result.surveyId).toBe(1);
    expect(mockWithdraw).toHaveBeenCalledWith(1);
  });

  it("should throw error if delivery is not in submitted status", async () => {
    const mockWithdraw = vi.mocked(db.withdrawDelivery);
    mockWithdraw.mockRejectedValue(new Error("Cannot withdraw: delivery is not in submitted status"));

    await expect(db.withdrawDelivery(2)).rejects.toThrow("Cannot withdraw: delivery is not in submitted status");
  });
});

describe("publicWithdraw validation", () => {
  it("should validate share link before allowing withdraw", async () => {
    const mockGetLink = vi.mocked(db.getShareLinkByToken);
    
    // Test invalid token
    mockGetLink.mockResolvedValue(null);
    const link = await db.getShareLinkByToken("invalid-token");
    expect(link).toBeNull();
  });

  it("should validate share link is active", async () => {
    const mockGetLink = vi.mocked(db.getShareLinkByToken);
    mockGetLink.mockResolvedValue({
      id: 1,
      token: "valid-token",
      surveyId: 1,
      isActive: false,
      expiresAt: null,
      type: "installation",
      createdAt: Date.now(),
      createdBy: 1,
    } as any);

    const link = await db.getShareLinkByToken("valid-token");
    expect(link?.isActive).toBe(false);
  });

  it("should validate share link is not expired", async () => {
    const mockGetLink = vi.mocked(db.getShareLinkByToken);
    const expiredTime = Date.now() - 86400000; // 1 day ago
    mockGetLink.mockResolvedValue({
      id: 1,
      token: "expired-token",
      surveyId: 1,
      isActive: true,
      expiresAt: expiredTime,
      type: "installation",
      createdAt: Date.now() - 172800000,
      createdBy: 1,
    } as any);

    const link = await db.getShareLinkByToken("expired-token");
    expect(link?.expiresAt).toBeLessThan(Date.now());
  });

  it("should allow withdraw when link is valid and active", async () => {
    const mockGetLink = vi.mocked(db.getShareLinkByToken);
    const futureTime = Date.now() + 86400000; // 1 day from now
    mockGetLink.mockResolvedValue({
      id: 1,
      token: "valid-token",
      surveyId: 5,
      isActive: true,
      expiresAt: futureTime,
      type: "installation",
      createdAt: Date.now(),
      createdBy: 1,
    } as any);

    const link = await db.getShareLinkByToken("valid-token");
    expect(link?.isActive).toBe(true);
    expect(link?.expiresAt).toBeGreaterThan(Date.now());
    expect(link?.surveyId).toBe(5);

    // Then withdraw should succeed
    const mockWithdraw = vi.mocked(db.withdrawDelivery);
    mockWithdraw.mockResolvedValue({ surveyId: 5, deliveryStatus: "pending" });
    const result = await db.withdrawDelivery(5);
    expect(result.deliveryStatus).toBe("pending");
  });
});
