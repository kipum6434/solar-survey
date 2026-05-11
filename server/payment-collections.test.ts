import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  default: {},
  getPaymentCollections: vi.fn(),
  createPaymentCollection: vi.fn(),
  deletePaymentCollection: vi.fn(),
  getPayments: vi.fn(),
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

describe("Payment Collections (งวดเก็บเงิน)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("payment.listCollections", () => {
    it("should return collections for a given paymentId", async () => {
      const mockCollections = [
        { id: 1, paymentId: 10, amount: "50000.00", note: "มัดจำ", collectedAt: 1700000000000, createdBy: 1, createdAt: new Date() },
        { id: 2, paymentId: 10, amount: "30000.00", note: "งวด 1", collectedAt: 1700100000000, createdBy: 1, createdAt: new Date() },
      ];
      mockedDb.getPaymentCollections.mockResolvedValue(mockCollections);

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.listCollections({ paymentId: 10 });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 1, amount: "50000.00", note: "มัดจำ" });
      expect(result[1]).toMatchObject({ id: 2, amount: "30000.00", note: "งวด 1" });
      expect(mockedDb.getPaymentCollections).toHaveBeenCalledWith(10);
    });

    it("should return empty array when no collections exist", async () => {
      mockedDb.getPaymentCollections.mockResolvedValue([]);

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.listCollections({ paymentId: 999 });

      expect(result).toHaveLength(0);
      expect(mockedDb.getPaymentCollections).toHaveBeenCalledWith(999);
    });
  });

  describe("payment.addCollection", () => {
    it("should add a new collection entry", async () => {
      mockedDb.createPaymentCollection.mockResolvedValue({ insertId: 5 });

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.addCollection({
        paymentId: 10,
        amount: 50000,
        note: "มัดจำ",
        collectedAt: 1700000000000,
      });

      expect(result).toBeDefined();
      expect(mockedDb.createPaymentCollection).toHaveBeenCalledWith({
        paymentId: 10,
        amount: "50000",
        note: "มัดจำ",
        collectedAt: 1700000000000,
        createdBy: 1,
      });
    });

    it("should add collection without note", async () => {
      mockedDb.createPaymentCollection.mockResolvedValue({ insertId: 6 });

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.addCollection({
        paymentId: 10,
        amount: 25000,
        collectedAt: 1700200000000,
      });

      expect(result).toBeDefined();
      expect(mockedDb.createPaymentCollection).toHaveBeenCalledWith({
        paymentId: 10,
        amount: "25000",
        note: null,
        collectedAt: 1700200000000,
        createdBy: 1,
      });
    });

    it("should pass the correct createdBy from context user", async () => {
      mockedDb.createPaymentCollection.mockResolvedValue({ insertId: 7 });

      const ctx = createAuthContext();
      ctx.user!.id = 42;
      const caller = appRouter.createCaller(ctx);
      await caller.payment.addCollection({
        paymentId: 5,
        amount: 10000,
        note: "หลังติดตั้ง",
        collectedAt: 1700300000000,
      });

      expect(mockedDb.createPaymentCollection).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 42 })
      );
    });
  });

  describe("payment.deleteCollection", () => {
    it("should delete a collection entry", async () => {
      mockedDb.deletePaymentCollection.mockResolvedValue(undefined);

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.deleteCollection({ id: 3 });

      expect(result).toEqual({ success: true });
      expect(mockedDb.deletePaymentCollection).toHaveBeenCalledWith(3);
    });

    it("should propagate error when collection not found", async () => {
      mockedDb.deletePaymentCollection.mockRejectedValue(new Error("Collection not found"));

      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.payment.deleteCollection({ id: 999 })
      ).rejects.toThrow("Collection not found");
    });
  });

  describe("payment.list", () => {
    it("should return payment list with parsed amounts", async () => {
      mockedDb.getPayments.mockResolvedValue({
        data: [
          {
            id: 1,
            surveyId: 100,
            customerId: 200,
            customerName: "คุณสมชาย",
            customerPhone: "0812345678",
            source: "FB เพจ SET",
            amount: 100000,
            contractValue: 150000,
            collectedAmount: 50000,
            status: "partial",
            systemSize: 10.5,
            createdAt: new Date(),
          },
        ],
        total: 1,
      });

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.list({ limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        customerName: "คุณสมชาย",
        status: "partial",
      });
    });
  });

  describe("payment.wonSurveysWithoutPayment", () => {
    it("should return surveys without payment records", async () => {
      mockedDb.getWonSurveysWithoutPayment.mockResolvedValue([
        { id: 1, customerName: "คุณทดสอบ", systemSize: 5.5, quotedPrice: 200000 },
      ]);

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.wonSurveysWithoutPayment({});

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ customerName: "คุณทดสอบ" });
    });

    it("should filter by sourceInclude", async () => {
      mockedDb.getWonSurveysWithoutPayment.mockResolvedValue([]);

      const caller = appRouter.createCaller(createAuthContext());
      await caller.payment.wonSurveysWithoutPayment({ sourceInclude: ["Gulf"] });

      expect(mockedDb.getWonSurveysWithoutPayment).toHaveBeenCalledWith({ sourceInclude: ["Gulf"] });
    });
  });

  describe("payment.createFromFinance", () => {
    it("should create payment for a won survey", async () => {
      mockedDb.getSurveyById.mockResolvedValue({
        id: 100,
        customerId: 200,
        quotedPrice: "250000",
      });
      mockedDb.getPaymentBySurveyId.mockResolvedValue(null);
      mockedDb.createPayment.mockResolvedValue({ insertId: 1 });

      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.payment.createFromFinance({
        surveyId: 100,
        contractValue: 250000,
      });

      expect(result).toBeDefined();
      expect(mockedDb.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          surveyId: 100,
          customerId: 200,
          contractValue: 250000,
        })
      );
    });

    it("should reject if survey not found", async () => {
      mockedDb.getSurveyById.mockResolvedValue(null);

      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.payment.createFromFinance({ surveyId: 999 })
      ).rejects.toThrow("ไม่พบงานสำรวจ");
    });

    it("should reject if payment already exists", async () => {
      mockedDb.getSurveyById.mockResolvedValue({ id: 100, customerId: 200 });
      mockedDb.getPaymentBySurveyId.mockResolvedValue({ id: 1 });

      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.payment.createFromFinance({ surveyId: 100 })
      ).rejects.toThrow("มีรายการเก็บเงินสำหรับงานนี้แล้ว");
    });
  });
});
