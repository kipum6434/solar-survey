import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-vitest-user",
    email: "test@vitest.com",
    name: "Test Vitest User",
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

let caller: ReturnType<typeof appRouter.createCaller>;
let testCustomerId: number;
let testSurveyId: number;
let testSourceId: number;

beforeAll(async () => {
  caller = appRouter.createCaller(createTestContext());

  // Create a test customer with district
  const customer = await caller.customer.create({
    name: "Round5 Test " + Date.now(),
    phone: "0999999999",
    email: "round5@test.com",
    province: "กรุงเทพ",
    district: "บางรัก",
    source: "website",
  });
  testCustomerId = customer.id;

  // Create a test survey with new fields
  const survey = await caller.survey.create({
    customerId: testCustomerId,
    status: "pending",
    panelBrand: "Longi",
    needBattery: "yes",
    needOptimizer: "no",
    systemType: "string",
  });
  testSurveyId = survey.id;

  // Create a test source
  const source = await caller.source.create({ name: "round5_src_" + Date.now() });
  testSourceId = source.id;
});

describe("Round 5 - New Survey Fields", () => {
  it("survey.getById returns new tech fields", async () => {
    const result = await caller.survey.getById({ id: testSurveyId });
    expect(result.survey.panelBrand).toBe("Longi");
    expect(result.survey.needBattery).toBe("yes");
    expect(result.survey.needOptimizer).toBe("no");
    expect(result.survey.systemType).toBe("string");
  });

  it("survey.update can update new tech fields", async () => {
    await caller.survey.update({
      id: testSurveyId,
      panelBrand: "JA Solar",
      needBattery: "undecided",
      needOptimizer: "yes",
      systemType: "micro",
    });
    const result = await caller.survey.getById({ id: testSurveyId });
    expect(result.survey.panelBrand).toBe("JA Solar");
    expect(result.survey.needBattery).toBe("undecided");
    expect(result.survey.needOptimizer).toBe("yes");
    expect(result.survey.systemType).toBe("micro");
  });
});

describe("Round 5 - Customer District", () => {
  it("customer.getById returns district field", async () => {
    const result = await caller.customer.getById({ id: testCustomerId });
    expect(result.district).toBe("บางรัก");
  });

  it("customer.update can update district", async () => {
    await caller.customer.update({
      id: testCustomerId,
      district: "สาทร",
    });
    const result = await caller.customer.getById({ id: testCustomerId });
    expect(result.district).toBe("สาทร");
  });
});

describe("Round 5 - Source Delete", () => {
  it("source.delete removes a source", async () => {
    const beforeList = await caller.source.list();
    const beforeCount = beforeList.length;

    await caller.source.delete({ id: testSourceId });

    const afterList = await caller.source.list();
    expect(afterList.length).toBe(beforeCount - 1);
    expect(afterList.find((s: any) => s.id === testSourceId)).toBeUndefined();
  });
});

describe("Round 5 - Assignment Null Removal", () => {
  it("survey.update with null adminSenderId removes admin sender", async () => {
    // First set an admin sender (user id 1)
    await caller.survey.update({
      id: testSurveyId,
      adminSenderId: 1,
    });
    let result = await caller.survey.getById({ id: testSurveyId });
    const adminBefore = result.assignments.find((a: any) => a.assignment.role === "admin_sender");
    expect(adminBefore).toBeDefined();

    // Now remove with null
    await caller.survey.update({
      id: testSurveyId,
      adminSenderId: null,
    });
    result = await caller.survey.getById({ id: testSurveyId });
    const adminAfter = result.assignments.find((a: any) => a.assignment.role === "admin_sender");
    expect(adminAfter).toBeUndefined();
  });
});

describe("Round 5 - Export Excel", () => {
  it("survey.exportExcel returns data array", async () => {
    const result = await caller.survey.exportExcel({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("survey");
      expect(result[0]).toHaveProperty("customer");
    }
  });
});
