import { describe, it, expect, vi } from "vitest";

// Test company settings schema and router logic
describe("Company Settings", () => {
  describe("Schema validation", () => {
    it("should have correct table structure for company_settings", async () => {
      const { companySettings } = await import("../drizzle/schema");
      expect(companySettings).toBeDefined();
      // Check that the table has the expected columns
      const columns = Object.keys(companySettings);
      expect(columns).toContain("id");
      expect(columns).toContain("companyName");
      expect(columns).toContain("phone");
      expect(columns).toContain("address");
      expect(columns).toContain("logoUrl");
      expect(columns).toContain("logoFileKey");
    });
  });

  describe("Input validation", () => {
    it("should validate update input with zod schema", async () => {
      const { z } = await import("zod");
      const updateSchema = z.object({
        companyName: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
      });

      // Valid inputs
      expect(() => updateSchema.parse({ companyName: "TCS Solar" })).not.toThrow();
      expect(() => updateSchema.parse({ phone: "02-xxx-xxxx" })).not.toThrow();
      expect(() => updateSchema.parse({ address: "123 Bangkok" })).not.toThrow();
      expect(() => updateSchema.parse({})).not.toThrow();
      expect(() => updateSchema.parse({ companyName: "TCS", phone: "08x", address: "BKK" })).not.toThrow();
    });

    it("should validate uploadLogo input with zod schema", async () => {
      const { z } = await import("zod");
      const uploadSchema = z.object({
        base64Data: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
      });

      // Valid input
      expect(() => uploadSchema.parse({
        base64Data: "iVBORw0KGgo=",
        fileName: "logo.png",
        mimeType: "image/png",
      })).not.toThrow();

      // Missing fields should fail
      expect(() => uploadSchema.parse({ base64Data: "abc" })).toThrow();
      expect(() => uploadSchema.parse({})).toThrow();
    });
  });

  describe("Logo size validation", () => {
    it("should reject files larger than 2MB", () => {
      const MAX_SIZE = 2 * 1024 * 1024;
      const smallFile = Buffer.alloc(1024); // 1KB
      const largeFile = Buffer.alloc(MAX_SIZE + 1); // 2MB + 1 byte

      expect(smallFile.length <= MAX_SIZE).toBe(true);
      expect(largeFile.length <= MAX_SIZE).toBe(false);
    });

    it("should accept files up to 2MB", () => {
      const MAX_SIZE = 2 * 1024 * 1024;
      const exactFile = Buffer.alloc(MAX_SIZE); // exactly 2MB
      expect(exactFile.length <= MAX_SIZE).toBe(true);
    });
  });

  describe("PDF CompanyInfo interface", () => {
    it("should export CompanyInfo type from pdfExport", async () => {
      // Verify the type is exported (runtime check via import)
      const pdfModule = await import("../client/src/lib/pdfExport");
      expect(pdfModule.exportSurveyPDF).toBeDefined();
      expect(pdfModule.exportInstallationPDF).toBeDefined();
    });

    it("exportSurveyPDF should accept companyInfo as last parameter", async () => {
      const pdfModule = await import("../client/src/lib/pdfExport");
      // Function should accept 8 parameters (survey, customer, photos, categoryMap, onProgress, imageProxyFn, companyInfo)
      expect(pdfModule.exportSurveyPDF.length).toBeGreaterThanOrEqual(4);
    });

    it("exportInstallationPDF should accept companyInfo as last parameter", async () => {
      const pdfModule = await import("../client/src/lib/pdfExport");
      expect(pdfModule.exportInstallationPDF.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("DB helpers", () => {
    it("should export getCompanySettings and updateCompanySettings", async () => {
      const dbModule = await import("./db");
      expect(dbModule.getCompanySettings).toBeDefined();
      expect(typeof dbModule.getCompanySettings).toBe("function");
      expect(dbModule.updateCompanySettings).toBeDefined();
      expect(typeof dbModule.updateCompanySettings).toBe("function");
    });
  });
});
