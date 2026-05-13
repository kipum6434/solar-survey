import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  default: {},
  getPayments: vi.fn(),
  getPaymentCollections: vi.fn(),
  createPaymentCollection: vi.fn(),
  deletePaymentCollection: vi.fn(),
  getWonSurveysWithoutPayment: vi.fn(),
  getSurveyById: vi.fn(),
  getPaymentBySurveyId: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
  storageDelete: vi.fn(),
  getS3BucketUsage: vi.fn(),
}));

// Mock lineNotify
vi.mock("./lineNotify", () => ({
  sendLineNotification: vi.fn(),
}));

import * as db from "./db";

const mockedDb = db as any;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

describe("Payment Date Filter (ฟิลเตอร์ช่วงเวลาหน้าการเงิน)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("payment.list with date filters", () => {
    const mockPayments = [
      {
        id: 1,
        surveyId: 100,
        contractValue: "246600.00",
        status: "pending",
        createdAt: new Date("2026-05-12"),
        customerName: "คุณธีรชัย",
        phone: "086-571-6986",
        systemSize: "5",
        source: "SET - Line",
      },
      {
        id: 2,
        surveyId: 101,
        contractValue: "0",
        status: "partial",
        createdAt: new Date("2026-05-11"),
        customerName: "เทสระบบ",
        phone: null,
        systemSize: null,
        source: "other",
      },
    ];

    it("should call getPayments without date filters when no dateFrom/dateTo provided", async () => {
      mockedDb.getPayments.mockResolvedValue(mockPayments);

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.list({});

      expect(mockedDb.getPayments).toHaveBeenCalledWith({});
      expect(result).toHaveLength(2);
    });

    it("should pass dateFrom to getPayments when provided", async () => {
      mockedDb.getPayments.mockResolvedValue([mockPayments[0]]);

      const caller = appRouter.createCaller(createAuthContext());
      // dateFrom/dateTo are z.number() (Unix timestamps in ms)
      const dateFrom = new Date("2026-05-12T00:00:00.000Z").getTime();
      const result = await caller.payment.list({ dateFrom });

      expect(mockedDb.getPayments).toHaveBeenCalledWith({ dateFrom });
      expect(result).toHaveLength(1);
    });

    it("should pass dateTo to getPayments when provided", async () => {
      mockedDb.getPayments.mockResolvedValue([mockPayments[1]]);

      const caller = appRouter.createCaller(createAuthContext());
      const dateTo = new Date("2026-05-11T23:59:59.999Z").getTime();
      const result = await caller.payment.list({ dateTo });

      expect(mockedDb.getPayments).toHaveBeenCalledWith({ dateTo });
      expect(result).toHaveLength(1);
    });

    it("should pass both dateFrom and dateTo for a date range filter", async () => {
      mockedDb.getPayments.mockResolvedValue(mockPayments);

      const caller = appRouter.createCaller(createAuthContext());
      const dateFrom = new Date("2026-05-01T00:00:00.000Z").getTime();
      const dateTo = new Date("2026-05-31T23:59:59.999Z").getTime();
      const result = await caller.payment.list({ dateFrom, dateTo });

      expect(mockedDb.getPayments).toHaveBeenCalledWith({ dateFrom, dateTo });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no payments match date range", async () => {
      mockedDb.getPayments.mockResolvedValue([]);

      const caller = appRouter.createCaller(createAuthContext());
      const dateFrom = new Date("2025-01-01T00:00:00.000Z").getTime();
      const dateTo = new Date("2025-01-31T23:59:59.999Z").getTime();
      const result = await caller.payment.list({ dateFrom, dateTo });

      expect(mockedDb.getPayments).toHaveBeenCalledWith({ dateFrom, dateTo });
      expect(result).toHaveLength(0);
    });

    it("should pass source along with date filters", async () => {
      mockedDb.getPayments.mockResolvedValue([mockPayments[0]]);

      const caller = appRouter.createCaller(createAuthContext());
      const dateFrom = new Date("2026-05-01T00:00:00.000Z").getTime();
      const dateTo = new Date("2026-05-31T23:59:59.999Z").getTime();
      const result = await caller.payment.list({
        source: "tcs",
        dateFrom,
        dateTo,
      });

      expect(mockedDb.getPayments).toHaveBeenCalledWith({
        source: "tcs",
        dateFrom,
        dateTo,
      });
      expect(result).toHaveLength(1);
    });
  });
});
