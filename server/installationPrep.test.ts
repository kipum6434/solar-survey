import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("installation.list (for prep page)", () => {
  const mockCtx: TrpcContext = {
    user: { id: "test-user", role: "admin", name: "Test", openId: "test-open-id" },
    setCookie: () => {},
    clearCookie: () => {},
  } as any;

  it("should return installation list with survey and customer data", async () => {
    const caller = appRouter.createCaller(mockCtx);
    const result = await caller.installation.list({
      page: 1,
      limit: 20,
    });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
    // Each item should have survey and customer nested objects
    if (result.data.length > 0) {
      const item = result.data[0];
      expect(item).toHaveProperty("survey");
      expect(item).toHaveProperty("customer");
      expect(item.survey).toHaveProperty("inverterModel");
      expect(item.survey).toHaveProperty("panelBrand");
      expect(item.survey).toHaveProperty("panelCount");
      expect(item.survey).toHaveProperty("systemSize");
      expect(item.customer).toHaveProperty("name");
    }
  });

  it("should filter by month when provided", async () => {
    const caller = appRouter.createCaller(mockCtx);
    const result = await caller.installation.list({
      page: 1,
      limit: 20,
      month: 5,
      year: 2025,
    });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });
});
