import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for the pdfmake-based PDF exports.
 * Verifies that the implementation uses pdfmake with Sarabun font,
 * has repeating headers/footers, and correct structure.
 */

describe("PDF Export - pdfmake Design Contract", () => {
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

  describe("Uses pdfmake instead of jsPDF", () => {
    it("should import pdfmake", () => {
      expect(pdfExportContent).toContain('from "pdfmake/build/pdfmake"');
    });

    it("should NOT import jsPDF", () => {
      expect(pdfExportContent).not.toContain('from "jspdf"');
      expect(pdfExportContent).not.toContain("new jsPDF");
    });

    it("should use Sarabun font base64 imports", () => {
      expect(pdfExportContent).toContain("SARABUN_REGULAR_BASE64");
      expect(pdfExportContent).toContain("SARABUN_BOLD_BASE64");
    });
  });

  describe("Font registration", () => {
    it("should register fonts via addVirtualFileSystem", () => {
      expect(pdfExportContent).toContain("pdfMake.addVirtualFileSystem");
    });

    it("should set Sarabun font family via setFonts", () => {
      expect(pdfExportContent).toContain("pdfMake.setFonts");
      expect(pdfExportContent).toContain("Sarabun");
    });

    it("should register both regular and bold variants", () => {
      expect(pdfExportContent).toContain('"Sarabun-Regular.ttf"');
      expect(pdfExportContent).toContain('"Sarabun-Bold.ttf"');
    });

    it("should use Sarabun as default font in document definition", () => {
      expect(pdfExportContent).toContain('font: "Sarabun"');
    });
  });

  describe("Header configuration", () => {
    it("should define buildHeader function", () => {
      expect(pdfExportContent).toContain("function buildHeader(");
    });

    it("should use header as a function for dynamic page numbering", () => {
      expect(surveySection).toContain("header: (currentPage: number, pageCount: number)");
    });

    it("should include company name in header", () => {
      expect(pdfExportContent).toContain("companyInfo?.companyName || reportTitle");
    });

    it("should include customer name and survey ID in header", () => {
      expect(pdfExportContent).toContain("`ลูกค้า: ${customerName}  |  #${surveyId}`");
    });

    it("should include page number in header", () => {
      expect(pdfExportContent).toContain("`หน้า ${currentPage}/${pageCount}`");
    });

    it("should support logo in header", () => {
      expect(pdfExportContent).toContain("logoData");
    });
  });

  describe("Footer configuration", () => {
    it("should use footer as a function for dynamic page numbering", () => {
      expect(surveySection).toContain("footer: (currentPage: number, pageCount: number)");
    });

    it("should include company name in footer", () => {
      expect(surveySection).toContain("footerCompanyName");
    });

    it("should include page number in footer", () => {
      expect(pdfExportContent).toContain("`${footerCompanyName}  |  หน้า ${currentPage}/${pageCount}`");
    });
  });

  describe("Survey PDF (orange/amber) configuration", () => {
    it("should use amber-500 hex color #f59e0b", () => {
      expect(surveySection).toContain('"#f59e0b"');
    });

    it("should use report title 'รายงานการสำรวจ Solar'", () => {
      expect(surveySection).toContain('"รายงานการสำรวจ Solar"');
    });

    it("should call pdfMake.createPdf", () => {
      expect(surveySection).toContain("pdfMake.createPdf(docDefinition)");
    });

    it("should call download with Thai filename", () => {
      expect(surveySection).toContain("pdfDoc.download(`สำรวจ-${customer.name}-${survey.id}.pdf`)");
    });

    it("should not use addWatermarkToAllPages or drawCompactHeader", () => {
      expect(surveySection).not.toContain("addWatermarkToAllPages");
      expect(surveySection).not.toContain("drawCompactHeader");
    });
  });

  describe("Installation PDF (green/emerald) configuration", () => {
    it("should use emerald-500 hex color #10b981", () => {
      expect(installSection).toContain('"#10b981"');
    });

    it("should use report title 'รายงานส่งมอบงานติดตั้ง Solar'", () => {
      expect(installSection).toContain('"รายงานส่งมอบงานติดตั้ง Solar"');
    });

    it("should call pdfMake.createPdf", () => {
      expect(installSection).toContain("pdfMake.createPdf(docDefinition)");
    });

    it("should call download with Thai filename", () => {
      expect(installSection).toContain("pdfDoc.download(`ติดตั้ง-${customer.name}-${survey.id}.pdf`)");
    });

    it("should include completion note section", () => {
      expect(installSection).toContain("ติดตั้งเสร็จสิ้น");
      expect(installSection).toContain("survey.completedAt");
    });
  });

  describe("Section builders", () => {
    it("should define buildSectionHeader function", () => {
      expect(pdfExportContent).toContain("function buildSectionHeader(");
    });

    it("should define buildKeyValueGrid function", () => {
      expect(pdfExportContent).toContain("function buildKeyValueGrid(");
    });

    it("should define buildPhotoGrid function", () => {
      expect(pdfExportContent).toContain("function buildPhotoGrid(");
    });
  });

  describe("Photo grid layout", () => {
    it("should use 3 columns for photos", () => {
      const photoGridFn = pdfExportContent.slice(
        pdfExportContent.indexOf("function buildPhotoGrid("),
        pdfExportContent.indexOf("// ==================== SURVEY PDF EXPORT")
      );
      expect(photoGridFn).toContain("COLS = 3");
    });

    it("should include image and label rows", () => {
      const photoGridFn = pdfExportContent.slice(
        pdfExportContent.indexOf("function buildPhotoGrid("),
        pdfExportContent.indexOf("// ==================== SURVEY PDF EXPORT")
      );
      expect(photoGridFn).toContain("imageRow");
      expect(photoGridFn).toContain("labelRow");
    });
  });

  describe("Page configuration", () => {
    it("should use A4 page size", () => {
      expect(pdfExportContent).toContain('"A4"');
    });

    it("should set page margins", () => {
      expect(pdfExportContent).toContain("pageMargins:");
    });
  });
});
