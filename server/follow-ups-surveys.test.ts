import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getSurveysForFollowUp: vi.fn(),
}));

import * as db from "./db";

describe("followUp.surveysForFollowUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call getSurveysForFollowUp with empty params", async () => {
    const mockData = [
      {
        survey: { id: 1, status: "follow_up", customerId: 1, systemSize: "5.00", quotedPrice: "130000", updatedAt: new Date() },
        customer: { id: 1, name: "Test", phone: "0812345678", province: "กรุงเทพ", district: "บางนา", source: "facebook" },
        customStatus: null,
        latestFollowUp: null,
        assignments: [],
      },
    ];
    (db.getSurveysForFollowUp as any).mockResolvedValue(mockData);

    const result = await db.getSurveysForFollowUp({});
    expect(db.getSurveysForFollowUp).toHaveBeenCalledWith({});
    expect(result).toEqual(mockData);
    expect(result.length).toBe(1);
    expect(result[0].survey.status).toBe("follow_up");
  });

  it("should pass search parameter", async () => {
    (db.getSurveysForFollowUp as any).mockResolvedValue([]);
    await db.getSurveysForFollowUp({ search: "test" });
    expect(db.getSurveysForFollowUp).toHaveBeenCalledWith({ search: "test" });
  });

  it("should pass date range parameters", async () => {
    const startDate = Date.now() - 86400000;
    const endDate = Date.now();
    (db.getSurveysForFollowUp as any).mockResolvedValue([]);
    await db.getSurveysForFollowUp({ startDate, endDate });
    expect(db.getSurveysForFollowUp).toHaveBeenCalledWith({ startDate, endDate });
  });

  it("should return surveys with follow_up, quoted, negotiating statuses", async () => {
    const mockData = [
      { survey: { id: 1, status: "follow_up" }, customer: { id: 1, name: "A" }, customStatus: null, latestFollowUp: null, assignments: [] },
      { survey: { id: 2, status: "quoted" }, customer: { id: 2, name: "B" }, customStatus: null, latestFollowUp: null, assignments: [] },
      { survey: { id: 3, status: "negotiating" }, customer: { id: 3, name: "C" }, customStatus: null, latestFollowUp: null, assignments: [] },
    ];
    (db.getSurveysForFollowUp as any).mockResolvedValue(mockData);

    const result = await db.getSurveysForFollowUp({});
    expect(result.length).toBe(3);
    expect(result.map((r: any) => r.survey.status)).toEqual(["follow_up", "quoted", "negotiating"]);
  });

  it("should include custom status info when available", async () => {
    const mockData = [
      {
        survey: { id: 1, status: "follow_up", statusId: 5 },
        customer: { id: 1, name: "A" },
        customStatus: { id: 5, label: "รอติดตาม", color: "#0891b2", bgColor: "#ecfeff" },
        latestFollowUp: null,
        assignments: [],
      },
    ];
    (db.getSurveysForFollowUp as any).mockResolvedValue(mockData);

    const result = await db.getSurveysForFollowUp({});
    expect(result[0].customStatus).not.toBeNull();
    expect(result[0].customStatus.label).toBe("รอติดตาม");
  });

  it("should include latest follow-up when available", async () => {
    const mockData = [
      {
        survey: { id: 1, status: "follow_up" },
        customer: { id: 1, name: "A" },
        customStatus: null,
        latestFollowUp: { id: 10, surveyId: 1, dueDate: Date.now() + 86400000, method: "phone", notes: "โทรติดตาม" },
        assignments: [],
      },
    ];
    (db.getSurveysForFollowUp as any).mockResolvedValue(mockData);

    const result = await db.getSurveysForFollowUp({});
    expect(result[0].latestFollowUp).not.toBeNull();
    expect(result[0].latestFollowUp.method).toBe("phone");
  });

  it("should include assignments when available", async () => {
    const mockData = [
      {
        survey: { id: 1, status: "follow_up" },
        customer: { id: 1, name: "A" },
        customStatus: null,
        latestFollowUp: null,
        assignments: [{ role: "surveyor", name: "กุลธิดา" }],
      },
    ];
    (db.getSurveysForFollowUp as any).mockResolvedValue(mockData);

    const result = await db.getSurveysForFollowUp({});
    expect(result[0].assignments.length).toBe(1);
    expect(result[0].assignments[0].name).toBe("กุลธิดา");
  });
});
