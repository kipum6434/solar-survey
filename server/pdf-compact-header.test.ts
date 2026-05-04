import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for the full repeating header on all pages of PDF exports.
 * Verifies that pages 2+ get the same full header as page 1
 * (company name, address, report title, customer, logo, page X/Y).
 */

describe("PDF Full Header - Design Contract", () => {
  const pdfExportPath = path.resolve(__dirname, "../client/src/lib/pdfExport.ts");
  let pdfExportContent: string;
  let surveySection: string;
  let installSection: string;

  beforeAll(() => {
    pdfExportContent = fs.readFileSync(pdfExportPath, "utf-8");
    surveySection = pdfExportContent.slice(
      pdfExportContent.indexOf("export async function exportSurveyPDF"),
      pdfExportContent.indexOf("export async function exportInstallationPDF")
    );
    installSection = pdfExportContent.slice(
      pdfExportContent.indexOf("export async function exportInstallationPDF")
    );
  });

  describe("Full header constant and function", () => {
    it("should define FULL_HEADER_HEIGHT constant at 36mm", () => {
      expect(pdfExportContent).toContain("FULL_HEADER_HEIGHT");
      const match = pdfExportContent.match(/FULL_HEADER_HEIGHT\s*=\s*(\d+)/);
      expect(match).toBeTruthy();
      expect(parseInt(match![1])).toBe(36);
    });

    it("should define drawFullHeader function (not drawCompactHeader)", () => {
      expect(pdfExportContent).toContain("function drawFullHeader(");
      expect(pdfExportContent).not.toContain("function drawCompactHeader(");
    });

    it("drawFullHeader should accept headerColor as RGB tuple", () => {
      expect(pdfExportContent).toContain("headerColor: [number, number, number]");
    });

    it("drawFullHeader should accept reportTitle parameter", () => {
      expect(pdfExportContent).toContain("reportTitle: string");
    });

    it("drawFullHeader should accept companyInfo parameter", () => {
      expect(pdfExportContent).toContain("companyInfo?: CompanyInfo | null");
    });

    it("drawFullHeader should accept logoData parameter", () => {
      expect(pdfExportContent).toContain("logoData?: string | null");
    });
  });

  describe("drawFullHeader renders full header content", () => {
    let headerFn: string;

    beforeAll(() => {
      const start = pdfExportContent.indexOf("function drawFullHeader(");
      const end = pdfExportContent.indexOf("function drawSectionHeader(");
      headerFn = pdfExportContent.slice(start, end);
    });

    it("should draw company name at font size 14", () => {
      expect(headerFn).toContain("doc.setFontSize(14)");
      expect(headerFn).toContain("companyInfo?.companyName || reportTitle");
    });

    it("should draw company contact info (phone + address)", () => {
      expect(headerFn).toContain("companyInfo.phone");
      expect(headerFn).toContain("companyInfo.address");
    });

    it("should draw report title line", () => {
      expect(headerFn).toContain("doc.text(reportTitle, MARGIN, 23)");
    });

    it("should draw customer name and survey ID", () => {
      expect(headerFn).toContain("`ลูกค้า: ${customerName}  |  #${surveyId}`");
    });

    it("should draw page number on header", () => {
      expect(headerFn).toContain("`หน้า ${pageNum}/${totalPages}`");
    });

    it("should draw logo with white background and rounded rect", () => {
      expect(headerFn).toContain("doc.roundedRect(");
      expect(headerFn).toContain("doc.addImage(logoData");
    });

    it("should use white text color on colored header bar", () => {
      expect(headerFn).toContain("doc.setTextColor(255, 255, 255)");
    });

    it("should draw colored bar spanning full page width", () => {
      expect(headerFn).toContain("doc.rect(0, 0, PAGE_WIDTH, headerHeight");
    });
  });

  describe("checkPageBreak accounts for full header space", () => {
    it("should return FULL_HEADER_HEIGHT + 8 when adding new page", () => {
      expect(pdfExportContent).toContain("return FULL_HEADER_HEIGHT + 8;");
    });
  });

  describe("Survey PDF (orange) uses full header on all pages", () => {
    it("should use amber-500 color [245, 158, 11]", () => {
      expect(surveySection).toContain("[245, 158, 11]");
    });

    it("should call drawFullHeader for pages 2+", () => {
      expect(surveySection).toContain("drawFullHeader(");
      expect(surveySection).toContain("if (i > 1)");
    });

    it("should pass report title 'รายงานการสำรวจ Solar' to drawFullHeader", () => {
      expect(surveySection).toContain('"รายงานการสำรวจ Solar"');
    });

    it("should pass companyInfo to drawFullHeader", () => {
      // Verify companyInfo is passed in the drawFullHeader call
      const drawCallIdx = surveySection.indexOf("drawFullHeader(");
      const drawCallEnd = surveySection.indexOf(");", drawCallIdx);
      const drawCallBlock = surveySection.slice(drawCallIdx, drawCallEnd);
      expect(drawCallBlock).toContain("companyInfo");
    });

    it("should add page number to page 1 as well", () => {
      expect(surveySection).toContain("`หน้า 1/${pageCount}`");
    });

    it("should not use addWatermarkToAllPages or drawCompactHeader", () => {
      expect(surveySection).not.toContain("addWatermarkToAllPages");
      expect(surveySection).not.toContain("drawCompactHeader");
    });
  });

  describe("Installation PDF (green) uses full header on all pages", () => {
    it("should use emerald-500 color [16, 185, 129]", () => {
      expect(installSection).toContain("[16, 185, 129]");
    });

    it("should call drawFullHeader for pages 2+", () => {
      expect(installSection).toContain("drawFullHeader(");
      expect(installSection).toContain("if (i > 1)");
    });

    it("should pass report title 'รายงานส่งมอบงานติดตั้ง Solar' to drawFullHeader", () => {
      expect(installSection).toContain('"รายงานส่งมอบงานติดตั้ง Solar"');
    });

    it("should pass companyInfo to drawFullHeader", () => {
      const drawCallIdx = installSection.indexOf("drawFullHeader(");
      const drawCallEnd = installSection.indexOf(");", drawCallIdx);
      const drawCallBlock = installSection.slice(drawCallIdx, drawCallEnd);
      expect(drawCallBlock).toContain("companyInfo");
    });

    it("should add page number to page 1 as well", () => {
      expect(installSection).toContain("`หน้า 1/${pageCount}`");
    });

    it("should not use addWatermarkToAllPages or drawCompactHeader", () => {
      expect(installSection).not.toContain("addWatermarkToAllPages");
      expect(installSection).not.toContain("drawCompactHeader");
    });
  });

  describe("Footer still present on all pages", () => {
    it("should draw footer text on all pages in survey PDF", () => {
      expect(surveySection).toContain("for (let i = 1; i <= pageCount; i++)");
      expect(surveySection).toContain("PAGE_HEIGHT - 8");
    });

    it("should draw footer text on all pages in installation PDF", () => {
      expect(installSection).toContain("for (let i = 1; i <= pageCount; i++)");
      expect(installSection).toContain("PAGE_HEIGHT - 8");
    });
  });

  describe("Full header is same size as page 1 header", () => {
    it("FULL_HEADER_HEIGHT should equal 36mm (same as page 1 with company info)", () => {
      // Page 1 uses: const headerHeight = hasCompanyInfo ? 36 : 28;
      // FULL_HEADER_HEIGHT should match the 36mm case
      expect(surveySection).toContain("hasCompanyInfo ? 36 : 28");
      const match = pdfExportContent.match(/FULL_HEADER_HEIGHT\s*=\s*(\d+)/);
      expect(parseInt(match![1])).toBe(36);
    });

    it("drawFullHeader should also use 36 for hasCompanyInfo case", () => {
      const headerFn = pdfExportContent.slice(
        pdfExportContent.indexOf("function drawFullHeader("),
        pdfExportContent.indexOf("function drawSectionHeader(")
      );
      expect(headerFn).toContain("hasCompanyInfo ? FULL_HEADER_HEIGHT : 28");
    });
  });
});
