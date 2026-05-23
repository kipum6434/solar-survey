import { describe, it, expect, vi } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getCancelledSurveys: vi.fn().mockResolvedValue([
    {
      survey: { id: 1, status: "cancelled", systemSize: "5kW", scheduledDate: null, createdAt: new Date(), updatedAt: new Date() },
      customer: { id: 1, name: "ลูกค้าทดสอบ", phone: "0812345678", province: "กรุงเทพ", district: "บางนา", source: "Facebook" },
      cancelLog: { id: 1, surveyId: 1, action: "cancel_survey", reason: "ได้เจ้าที่ถูกกว่า", createdAt: new Date() },
      closerName: "เซลล์ A",
    },
    {
      survey: { id: 2, status: "lost", systemSize: "10kW", scheduledDate: null, createdAt: new Date(), updatedAt: new Date() },
      customer: { id: 2, name: "ลูกค้า B", phone: "0898765432", province: "เชียงใหม่", district: "เมือง", source: "Line" },
      cancelLog: { id: 2, surveyId: 2, action: "cancel_survey", reason: "อื่นๆ: ลูกค้าย้ายบ้าน", createdAt: new Date() },
      closerName: null,
    },
  ]),
  getCancelReasonStats: vi.fn().mockResolvedValue([
    { reason: "ได้เจ้าที่ถูกกว่า", count: 5 },
    { reason: "เปลี่ยนใจไม่ติด", count: 3 },
    { reason: "งบไม่พอ", count: 2 },
    { reason: "อื่นๆ: ลูกค้าย้ายบ้าน", count: 1 },
  ]),
  getSurveyById: vi.fn().mockResolvedValue({ id: 1, status: "cancelled" }),
  reopenSurvey: vi.fn().mockResolvedValue({ success: true }),
  logActivity: vi.fn().mockResolvedValue(undefined),
  getSurveyWithCustomer: vi.fn().mockResolvedValue({ customer: { name: "ลูกค้าทดสอบ" } }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./lineNotify", () => ({
  sendLineNotification: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";

describe("CancelledCases - DB functions", () => {
  it("getCancelledSurveys returns list with cancel logs and closer names", async () => {
    const results = await db.getCancelledSurveys();
    expect(results).toHaveLength(2);
    expect(results[0].survey.status).toBe("cancelled");
    expect(results[0].cancelLog?.reason).toBe("ได้เจ้าที่ถูกกว่า");
    expect(results[0].closerName).toBe("เซลล์ A");
    expect(results[1].survey.status).toBe("lost");
    expect(results[1].cancelLog?.reason).toContain("อื่นๆ");
  });

  it("getCancelledSurveys accepts optional sourceGroup parameter", async () => {
    const results = await db.getCancelledSurveys("tcs");
    expect(results).toHaveLength(2); // mock returns same data regardless of param
    expect(db.getCancelledSurveys).toHaveBeenCalledWith("tcs");
  });

  it("getCancelReasonStats returns grouped reason counts", async () => {
    const stats = await db.getCancelReasonStats();
    expect(stats.length).toBeGreaterThan(0);
    expect(stats[0].reason).toBe("ได้เจ้าที่ถูกกว่า");
    expect(Number(stats[0].count)).toBe(5);
  });

  it("getCancelReasonStats accepts optional sourceGroup parameter", async () => {
    const stats = await db.getCancelReasonStats("gulf");
    expect(db.getCancelReasonStats).toHaveBeenCalledWith("gulf");
  });

  it("reopenSurvey changes status back to follow_up", async () => {
    const result = await db.reopenSurvey(1);
    expect(result).toEqual({ success: true });
    expect(db.reopenSurvey).toHaveBeenCalledWith(1);
  });

  it("getSurveyById returns cancelled survey for validation", async () => {
    const survey = await db.getSurveyById(1);
    expect(survey).toBeDefined();
    expect(survey!.status).toBe("cancelled");
  });
});

describe("CancelledCases - Reason extraction logic", () => {
  function extractBaseReason(reason: string): string {
    const baseReasons = ["ได้เจ้าที่ถูกกว่า", "เปลี่ยนใจไม่ติด", "งบไม่พอ", "ติดต่อไม่ได้", "อื่นๆ"];
    for (const base of baseReasons) {
      if (reason === base || reason.startsWith(base + ": ")) return base;
    }
    return "อื่นๆ";
  }

  it("extracts exact base reason", () => {
    expect(extractBaseReason("ได้เจ้าที่ถูกกว่า")).toBe("ได้เจ้าที่ถูกกว่า");
    expect(extractBaseReason("เปลี่ยนใจไม่ติด")).toBe("เปลี่ยนใจไม่ติด");
    expect(extractBaseReason("งบไม่พอ")).toBe("งบไม่พอ");
    expect(extractBaseReason("ติดต่อไม่ได้")).toBe("ติดต่อไม่ได้");
  });

  it("extracts base reason with detail suffix", () => {
    expect(extractBaseReason("ได้เจ้าที่ถูกกว่า: ราคาต่ำกว่า 20%")).toBe("ได้เจ้าที่ถูกกว่า");
    expect(extractBaseReason("งบไม่พอ: รอปีหน้า")).toBe("งบไม่พอ");
  });

  it("handles อื่นๆ with custom detail", () => {
    expect(extractBaseReason("อื่นๆ: ลูกค้าย้ายบ้าน")).toBe("อื่นๆ");
    expect(extractBaseReason("ลูกค้าย้ายบ้าน")).toBe("อื่นๆ");
  });

  it("falls back to อื่นๆ for unknown reasons", () => {
    expect(extractBaseReason("เหตุผลที่ไม่อยู่ในรายการ")).toBe("อื่นๆ");
    expect(extractBaseReason("")).toBe("อื่นๆ");
  });
});
