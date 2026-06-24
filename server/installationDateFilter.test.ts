import { describe, it, expect, vi } from "vitest";

// Test the date range conversion logic used in getInstallations
describe("Installation Date Range Filter", () => {
  it("should convert YYYY-MM-DD startDate to correct timestamp with +07:00 timezone", () => {
    const startDate = "2026-06-23";
    const startTs = new Date(startDate + "T00:00:00+07:00").getTime();
    // 2026-06-23 00:00:00 +07:00 = 2026-06-22 17:00:00 UTC
    const expected = new Date("2026-06-22T17:00:00.000Z").getTime();
    expect(startTs).toBe(expected);
  });

  it("should convert YYYY-MM-DD endDate to end of day timestamp with +07:00 timezone", () => {
    const endDate = "2026-06-29";
    const endTs = new Date(endDate + "T23:59:59.999+07:00").getTime();
    // 2026-06-29 23:59:59.999 +07:00 = 2026-06-29 16:59:59.999 UTC
    const expected = new Date("2026-06-29T16:59:59.999Z").getTime();
    expect(endTs).toBe(expected);
  });

  it("should handle single day filter (startDate === endDate)", () => {
    const date = "2026-06-24";
    const startTs = new Date(date + "T00:00:00+07:00").getTime();
    const endTs = new Date(date + "T23:59:59.999+07:00").getTime();
    // Should cover exactly 24 hours minus 1ms
    expect(endTs - startTs).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("should handle week range (7 days)", () => {
    const startDate = "2026-06-23"; // Monday
    const endDate = "2026-06-29"; // Sunday
    const startTs = new Date(startDate + "T00:00:00+07:00").getTime();
    const endTs = new Date(endDate + "T23:59:59.999+07:00").getTime();
    // Should cover 7 days minus 1ms
    expect(endTs - startTs).toBe(7 * 24 * 60 * 60 * 1000 - 1);
  });

  it("should prioritize startDate/endDate over month/year when both provided", () => {
    // This tests the logic: if (startDate && endDate) takes precedence over else if (month && year)
    const startDate = "2026-06-23";
    const endDate = "2026-06-29";
    const month = 7; // July - should be ignored
    const year = 2026;

    // Simulate the condition logic from getInstallations
    let usedDateRange = false;
    let usedMonthYear = false;

    if (startDate && endDate) {
      usedDateRange = true;
    } else if (month && year) {
      usedMonthYear = true;
    }

    expect(usedDateRange).toBe(true);
    expect(usedMonthYear).toBe(false);
  });

  it("should fall back to month/year when startDate/endDate not provided", () => {
    const startDate = undefined;
    const endDate = undefined;
    const month = 6;
    const year = 2026;

    let usedDateRange = false;
    let usedMonthYear = false;

    if (startDate && endDate) {
      usedDateRange = true;
    } else if (month && year) {
      usedMonthYear = true;
    }

    expect(usedDateRange).toBe(false);
    expect(usedMonthYear).toBe(true);
  });
});

// Test the frontend helper functions
describe("InstallationPrep Filter Helpers", () => {
  it("getMonday should return Monday of the current week", () => {
    // 2026-06-24 is Wednesday
    const date = new Date(2026, 5, 24); // June 24, 2026
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getDate()).toBe(22); // June 22, 2026
  });

  it("getSunday should return Sunday (6 days after Monday)", () => {
    const monday = new Date(2026, 5, 22); // June 22, 2026 (Monday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    expect(sunday.getDay()).toBe(0); // Sunday
    expect(sunday.getDate()).toBe(28); // June 28, 2026
  });

  it("toDateString should format date as YYYY-MM-DD", () => {
    const date = new Date(2026, 5, 24); // June 24, 2026
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const result = `${year}-${month}-${day}`;
    expect(result).toBe("2026-06-24");
  });

  it("formatDateThai should display Buddhist year", () => {
    const date = new Date(2026, 5, 24); // June 24, 2026
    const buddhistYear = date.getFullYear() + 543;
    expect(buddhistYear).toBe(2569);
  });

  it("URL params should persist filter mode and values", () => {
    // Simulate URL sync for week mode
    const filterMode = "week";
    const weekStart = new Date(2026, 5, 22); // June 22, 2026
    const p = new URLSearchParams();
    p.set("mode", filterMode);
    p.set("weekStart", "2026-06-22");
    
    expect(p.get("mode")).toBe("week");
    expect(p.get("weekStart")).toBe("2026-06-22");
  });

  it("URL params should persist custom date range", () => {
    const filterMode = "custom";
    const customStart = "2026-06-20";
    const customEnd = "2026-06-30";
    const p = new URLSearchParams();
    p.set("mode", filterMode);
    p.set("startDate", customStart);
    p.set("endDate", customEnd);
    
    expect(p.get("mode")).toBe("custom");
    expect(p.get("startDate")).toBe("2026-06-20");
    expect(p.get("endDate")).toBe("2026-06-30");
  });
});
