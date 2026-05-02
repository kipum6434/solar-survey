import { describe, it, expect } from "vitest";

/**
 * Test the sanitization logic used in the survey update procedures.
 * These mirror the exact logic in routers.ts for publicUpdateSurveyTechnical and survey.update.
 */

// Replicate the sanitization functions from routers.ts
function sanitizeDecimal(value: string): string | null {
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? null : String(num);
}

function sanitizeInt(value: string): number | null {
  const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? null : num;
}

describe("Numeric field sanitization", () => {
  describe("sanitizeDecimal (systemSize, quotedPrice, electricityBill)", () => {
    it("handles plain numbers", () => {
      expect(sanitizeDecimal("5.5")).toBe("5.5");
      expect(sanitizeDecimal("200000")).toBe("200000");
    });

    it("strips commas from formatted numbers", () => {
      expect(sanitizeDecimal("200,000")).toBe("200000");
      expect(sanitizeDecimal("1,500,000")).toBe("1500000");
    });

    it("strips text suffixes like 'kw'", () => {
      expect(sanitizeDecimal("5kw")).toBe("5");
      expect(sanitizeDecimal("5.5kw")).toBe("5.5");
      expect(sanitizeDecimal("10 kW")).toBe("10");
    });

    it("strips Thai text", () => {
      expect(sanitizeDecimal("253,000บาท")).toBe("253000");
      expect(sanitizeDecimal("5 กิโลวัตต์")).toBe("5");
    });

    it("handles numbers with spaces", () => {
      expect(sanitizeDecimal("200 000")).toBe("200000");
    });

    it("returns null for non-numeric strings", () => {
      expect(sanitizeDecimal("abc")).toBe(null);
      expect(sanitizeDecimal("")).toBe(null);
    });

    it("handles decimal values", () => {
      expect(sanitizeDecimal("253,000.50")).toBe("253000.5");
      expect(sanitizeDecimal("5.5")).toBe("5.5");
    });
  });

  describe("sanitizeInt (panelCount)", () => {
    it("handles plain integers", () => {
      expect(sanitizeInt("12")).toBe(12);
      expect(sanitizeInt("100")).toBe(100);
    });

    it("strips text", () => {
      expect(sanitizeInt("12 ตัว")).toBe(12);
      expect(sanitizeInt("12ตัว")).toBe(12);
      expect(sanitizeInt("12 panels")).toBe(12);
    });

    it("strips commas", () => {
      expect(sanitizeInt("1,000")).toBe(1000);
    });

    it("returns null for non-numeric", () => {
      expect(sanitizeInt("abc")).toBe(null);
      expect(sanitizeInt("")).toBe(null);
    });
  });
});
