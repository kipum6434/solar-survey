import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for the compact repeating header on pages 2+ of PDF exports.
 * These are contract/design tests that verify the implementation structure
 * without rendering actual PDFs (which requires browser environment).
 */

describe("PDF Compact Header - Design Contract", () => {
  const pdfExportPath = path.resolve(__dirname, "../client/src/lib/pdfExport.ts");
  let pdfExportContent: string;

  beforeAll(() => {
    pdfExportContent = fs.readFileSync(pdfExportPath, "utf-8");
  });

  describe("Compact header constant and function", () => {
    it("should define COMPACT_HEADER_HEIGHT constant", () => {
      expect(pdfExportContent).toContain("COMPACT_HEADER_HEIGHT");
      // Should be around 18mm
      const match = pdfExportContent.match(/COMPACT_HEADER_HEIGHT\s*=\s*(\d+)/);
      expect(match).toBeTruthy();
      const height = parseInt(match![1]);
      expect(height).toBeGreaterThanOrEqual(15);
      expect(height).toBeLessThanOrEqual(25);
    });

    it("should define drawCompactHeader function", () => {
      expect(pdfExportContent).toContain("function drawCompactHeader(");
    });

    it("drawCompactHeader should accept headerColor as RGB tuple parameter", () => {
      // Verify the function signature includes headerColor
      expect(pdfExportContent).toContain("headerColor: [number, number, number]");
    });

    it("drawCompactHeader should accept logoData parameter", () => {
      expect(pdfExportContent).toContain("logoData?: string | null");
    });

    it("drawCompactHeader should draw company name", () => {
      // Should contain text drawing for company name
      expect(pdfExportContent).toContain("doc.text(companyName, MARGIN,");
    });

    it("drawCompactHeader should draw customer name and survey ID", () => {
      expect(pdfExportContent).toContain("ลูกค้า: ${customerName}  |  #${surveyId}");
    });

    it("drawCompactHeader should draw page number", () => {
      expect(pdfExportContent).toContain("หน้า ${pageNum}/${totalPages}");
    });
  });

  describe("checkPageBreak accounts for compact header space", () => {
    it("should return COMPACT_HEADER_HEIGHT + offset when adding new page", () => {
      // The checkPageBreak function should leave space for the compact header
      expect(pdfExportContent).toContain("return COMPACT_HEADER_HEIGHT + 4;");
    });
  });

  describe("Survey PDF (orange) uses compact header on pages 2+", () => {
    it("should use amber-500 color [245, 158, 11] for survey PDF header", () => {
      // Find the section in exportSurveyPDF that sets headerColor
      const surveySection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportSurveyPDF"),
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      expect(surveySection).toContain("[245, 158, 11]");
    });

    it("should call drawCompactHeader for pages 2+ in survey PDF", () => {
      const surveySection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportSurveyPDF"),
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      expect(surveySection).toContain("drawCompactHeader(");
      expect(surveySection).toContain("if (i > 1)");
    });

    it("should only add logo watermark on page 1 in survey PDF", () => {
      const surveySection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportSurveyPDF"),
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      // Page 1 should still get logo but via inline code, not addWatermarkToAllPages
      expect(surveySection).not.toContain("addWatermarkToAllPages");
    });
  });

  describe("Installation PDF (green) uses compact header on pages 2+", () => {
    it("should use emerald-500 color [16, 185, 129] for installation PDF header", () => {
      const installSection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      expect(installSection).toContain("[16, 185, 129]");
    });

    it("should call drawCompactHeader for pages 2+ in installation PDF", () => {
      const installSection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      expect(installSection).toContain("drawCompactHeader(");
      expect(installSection).toContain("if (i > 1)");
    });

    it("should only add logo watermark on page 1 in installation PDF", () => {
      const installSection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      expect(installSection).not.toContain("addWatermarkToAllPages");
    });
  });

  describe("Footer still present on all pages", () => {
    it("should draw footer text on all pages in survey PDF", () => {
      const surveySection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportSurveyPDF"),
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      // Footer loop should iterate all pages
      expect(surveySection).toContain("for (let i = 1; i <= pageCount; i++)");
      expect(surveySection).toContain("PAGE_HEIGHT - 8");
    });

    it("should draw footer text on all pages in installation PDF", () => {
      const installSection = pdfExportContent.slice(
        pdfExportContent.indexOf("export async function exportInstallationPDF")
      );
      expect(installSection).toContain("for (let i = 1; i <= pageCount; i++)");
      expect(installSection).toContain("PAGE_HEIGHT - 8");
    });
  });

  describe("Compact header design constraints", () => {
    it("compact header should be smaller than full page-1 header (36mm)", () => {
      const match = pdfExportContent.match(/COMPACT_HEADER_HEIGHT\s*=\s*(\d+)/);
      const compactHeight = parseInt(match![1]);
      // Full header is 36mm with company info, compact should be significantly smaller
      expect(compactHeight).toBeLessThan(36);
    });

    it("should use white text color (255,255,255) on colored header bar", () => {
      // Within drawCompactHeader function
      const headerFn = pdfExportContent.slice(
        pdfExportContent.indexOf("function drawCompactHeader("),
        pdfExportContent.indexOf("function drawSectionHeader(")
      );
      expect(headerFn).toContain("doc.setTextColor(255, 255, 255)");
    });

    it("compact header bar should span full page width", () => {
      const headerFn = pdfExportContent.slice(
        pdfExportContent.indexOf("function drawCompactHeader("),
        pdfExportContent.indexOf("function drawSectionHeader(")
      );
      // Should draw rect from 0 to PAGE_WIDTH
      expect(headerFn).toContain("doc.rect(0, 0, PAGE_WIDTH, COMPACT_HEADER_HEIGHT");
    });
  });
});
