import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("SharedSurveyField - publicUpdateSurveyTechnical with quotedPrice", () => {
  it("rejects invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateSurveyTechnical({
        token: "invalid-token",
        surveyId: 1,
        systemSize: "5.0",
        quotedPrice: "280000",
      })
    ).rejects.toThrow();
  });

  it("accepts quotedPrice in input schema", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should reject due to invalid token, not due to schema validation
    await expect(
      caller.shareLink.publicUpdateSurveyTechnical({
        token: "nonexistent-token-abc",
        surveyId: 999,
        quotedPrice: "350000",
        panelCount: 12,
        inverterModel: "Huawei SUN2000",
      })
    ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
  });

  it("accepts all technical fields including quotedPrice", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateSurveyTechnical({
        token: "test-token-xyz",
        surveyId: 1,
        systemSize: "10.0",
        panelCount: 20,
        inverterModel: "Huawei SUN2000-10KTL",
        panelBrand: "JA Solar",
        needBattery: "2 ก้อน Tesla Powerwall",
        needOptimizer: "12 ตัว",
        systemType: "string",
        surveyNotes: "หลังคาทิศใต้ สภาพดี",
        quotedPrice: "450000",
      })
    ).rejects.toThrow();
  });
});

describe("SharedSurveyField - publicUpdateCustomerInfo", () => {
  it("rejects invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateCustomerInfo({
        token: "invalid-token",
        surveyId: 1,
        electricityBill: "3500",
      })
    ).rejects.toThrow();
  });

  it("rejects with correct error message for invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateCustomerInfo({
        token: "nonexistent-token-def",
        surveyId: 999,
        roofType: "เมทัลชีท",
        roofArea: "50",
      })
    ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
  });

  it("accepts all customer info fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateCustomerInfo({
        token: "test-token-cust",
        surveyId: 1,
        electricityBill: "5000",
        roofType: "คอนกรีต",
        roofArea: "80",
        phaseType: "three",
        meterSize: "15(45)A",
        fullAddress: "123/45 หมู่บ้านสุขสันต์",
        subDistrict: "บางกระสอ",
        district: "เมืองนนทบุรี",
        province: "นนทบุรี",
        postalCode: "11000",
        notes: "ลูกค้าสนใจแบตเตอรี่",
      })
    ).rejects.toThrow();
  });

  it("validates phaseType enum - rejects invalid value", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateCustomerInfo({
        token: "test-token",
        surveyId: 1,
        phaseType: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  it("accepts single phase type", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateCustomerInfo({
        token: "nonexistent-token",
        surveyId: 1,
        phaseType: "single",
      })
    ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
  });

  it("accepts three phase type", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateCustomerInfo({
        token: "nonexistent-token",
        surveyId: 1,
        phaseType: "three",
      })
    ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
  });

  it("works with empty optional fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shareLink.publicUpdateCustomerInfo({
        token: "nonexistent-token",
        surveyId: 1,
      })
    ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
  });
});
