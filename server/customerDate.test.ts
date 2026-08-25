import { describe, expect, it } from "vitest";
import { formatCustomerCreatedDate } from "../shared/customerDate";

describe("formatCustomerCreatedDate", () => {
  it("formats a valid customer creation date in Thai Buddhist Era", () => {
    expect(formatCustomerCreatedDate("2026-08-25T10:00:00.000Z")).toBe("25/08/2569");
  });

  it("returns a dash when the date is missing or invalid", () => {
    expect(formatCustomerCreatedDate(null)).toBe("-");
    expect(formatCustomerCreatedDate("not-a-date")).toBe("-");
  });
});
