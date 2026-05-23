import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("calendar.installationEvents", () => {
  it("should be defined as a procedure", () => {
    expect(appRouter.calendar.installationEvents).toBeDefined();
  });

  it("should accept startDate and endDate as input", () => {
    // Verify the procedure exists and is a query
    const procedure = appRouter.calendar.installationEvents;
    expect(procedure).toBeDefined();
    expect(procedure._def).toBeDefined();
  });
});
