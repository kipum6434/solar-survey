import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for the HTML-based PDF export approach.
 * The new implementation uses html2canvas to render Thai text correctly
 * (fixing tone mark / diacritic issues with jsPDF's doc.text()).
 */

let pdfExportSource: string;
let surveySection: string;
let installSection: string;

beforeAll(() => {
  pdfExportSource = fs.readFileSync(
    path.resolve(__dirname, "../client/src/lib/pdfExport.ts"),
    "utf-8"
  );
  surveySection = pdfExportSource.slice(
    pdfExportSource.indexOf("export async function exportSurveyPDF"),
    pdfExportSource.indexOf("export async function exportInstallationPDF")
  );
  installSection = pdfExportSource.slice(
    pdfExportSource.indexOf("export async function exportInstallationPDF")
  );
});

describe("PDF Export - HTML-based rendering approach", () => {
  it("should import html2canvas-pro for browser-based text rendering", () => {
    expect(pdfExportSource).toContain('import html2canvas from "html2canvas-pro"');
  });

  it("should use SarabunPDF font family for Thai text support", () => {
    expect(pdfExportSource).toContain("SarabunPDF");
    expect(pdfExportSource).toContain("@font-face");
    expect(pdfExportSource).toContain("font-family: 'SarabunPDF'");
  });

  it("should load Sarabun font from storage proxy", () => {
    expect(pdfExportSource).toContain("/manus-storage/Sarabun-Regular");
    expect(pdfExportSource).toContain("/manus-storage/Sarabun-Bold");
  });

  it("should use document.fonts.load to ensure fonts are ready", () => {
    expect(pdfExportSource).toContain("document.fonts.load");
    expect(pdfExportSource).toContain("16px SarabunPDF");
  });

  it("should use html2canvas to render content instead of doc.text()", () => {
    expect(pdfExportSource).toContain("html2canvas(container");
    expect(pdfExportSource).toContain("renderHtmlToPdfPage");
  });

  it("should NOT use doc.text() for content rendering", () => {
    // The new approach should not use doc.text() for Thai content
    const docTextCalls = pdfExportSource.match(/doc\.text\(/g);
    expect(docTextCalls).toBeNull();
  });

  it("should have proper HTML escaping function", () => {
    expect(pdfExportSource).toContain("function escHtml");
    expect(pdfExportSource).toContain("&amp;");
    expect(pdfExportSource).toContain("&lt;");
    expect(pdfExportSource).toContain("&gt;");
  });
});

describe("PDF Export - Header rendering", () => {
  it("should have buildHeaderHtml function for header generation", () => {
    expect(pdfExportSource).toContain("function buildHeaderHtml");
  });

  it("should include company name in header", () => {
    expect(pdfExportSource).toContain("escHtml(companyName)");
  });

  it("should include contact info in header", () => {
    expect(pdfExportSource).toContain("escHtml(contactInfo)");
  });

  it("should include report title in header", () => {
    expect(pdfExportSource).toContain("escHtml(reportTitle)");
  });

  it("should include customer name and survey ID in header", () => {
    expect(pdfExportSource).toContain("escHtml(customerName)");
    expect(pdfExportSource).toContain("surveyId");
  });

  it("should include page numbers in header", () => {
    expect(pdfExportSource).toContain("หน้า ${pageNum}/${totalPages}");
  });

  it("should include logo in header when available", () => {
    expect(pdfExportSource).toContain("logoData");
    expect(pdfExportSource).toContain("logoHtml");
  });

  it("should include print date in header", () => {
    expect(pdfExportSource).toContain("printDate");
    expect(pdfExportSource).toContain("พิมพ์เมื่อ");
  });

  it("should use amber color for survey PDF header", () => {
    expect(pdfExportSource).toContain('"#f59e0b"');
  });

  it("should use emerald color for installation PDF header", () => {
    expect(pdfExportSource).toContain('"#10b981"');
  });
});

describe("PDF Export - Content sections", () => {
  it("should have section header builder", () => {
    expect(pdfExportSource).toContain("function buildSectionHeaderHtml");
  });

  it("should have key-value grid builder", () => {
    expect(pdfExportSource).toContain("function buildKeyValueGridHtml");
  });

  it("should have photo grid builder", () => {
    expect(pdfExportSource).toContain("function buildPhotoGridHtml");
  });

  it("should have footer builder", () => {
    expect(pdfExportSource).toContain("function buildFooterHtml");
  });

  it("should have pagination logic", () => {
    expect(pdfExportSource).toContain("function paginateContent");
    expect(pdfExportSource).toContain("CONTENT_AREA_HEIGHT");
  });
});

describe("PDF Export - Survey PDF function", () => {
  it("should export exportSurveyPDF function", () => {
    expect(pdfExportSource).toContain("export async function exportSurveyPDF");
  });

  it("should include customer info section", () => {
    expect(surveySection).toContain('buildSectionHeaderHtml("ข้อมูลลูกค้า")');
  });

  it("should include technical info section", () => {
    expect(surveySection).toContain('buildSectionHeaderHtml("ข้อมูลทางเทคนิค")');
  });

  it("should handle survey notes", () => {
    expect(surveySection).toContain("survey.surveyNotes");
    expect(surveySection).toContain("หมายเหตุสำรวจ");
  });

  it("should handle photos with proper loading", () => {
    expect(surveySection).toContain("loadImageAsBase64(photos[i].url");
  });

  it("should save with Thai filename", () => {
    expect(surveySection).toContain("doc.save(`สำรวจ-${customer.name}-${survey.id}.pdf`)");
  });

  it("should use amber header color", () => {
    expect(surveySection).toContain('"#f59e0b"');
  });
});

describe("PDF Export - Installation PDF function", () => {
  it("should export exportInstallationPDF function", () => {
    expect(pdfExportSource).toContain("export async function exportInstallationPDF");
  });

  it("should include delivery info section", () => {
    expect(installSection).toContain('buildSectionHeaderHtml("ข้อมูลส่งมอบงาน"');
  });

  it("should include installation photos", () => {
    expect(installSection).toContain("รูปภาพการติดตั้ง");
  });

  it("should handle completion note", () => {
    expect(installSection).toContain("ติดตั้งเสร็จสิ้น");
    expect(installSection).toContain("survey.completedAt");
  });

  it("should save with Thai filename", () => {
    expect(installSection).toContain("doc.save(`ติดตั้ง-${customer.name}-${survey.id}.pdf`)");
  });

  it("should use emerald header color", () => {
    expect(installSection).toContain('"#10b981"');
  });
});

describe("PDF Export - Types and interfaces", () => {
  it("should export CompanyInfo interface", () => {
    expect(pdfExportSource).toContain("export interface CompanyInfo");
  });

  it("should export ImageProxyFn type", () => {
    expect(pdfExportSource).toContain("export type ImageProxyFn");
  });

  it("should have proper status labels", () => {
    expect(pdfExportSource).toContain("รอดำเนินการ");
    expect(pdfExportSource).toContain("นัดสำรวจแล้ว");
    expect(pdfExportSource).toContain("ปิดการขาย");
  });

  it("should have system type labels including ทั้งสองแบบ", () => {
    expect(pdfExportSource).toContain("ทั้งสองแบบ");
  });
});

describe("PDF Export - Rendering quality", () => {
  it("should use high scale factor for quality", () => {
    expect(pdfExportSource).toContain("const SCALE = 3");
  });

  it("should render at A4 dimensions", () => {
    expect(pdfExportSource).toContain("PAGE_WIDTH_MM = 210");
    expect(pdfExportSource).toContain("PAGE_HEIGHT_MM = 297");
  });

  it("should use JPEG output for reasonable file size", () => {
    expect(pdfExportSource).toContain('toDataURL("image/jpeg"');
  });

  it("should add pages correctly for multi-page documents", () => {
    expect(pdfExportSource).toContain("doc.addPage()");
    expect(pdfExportSource).toContain("doc.addImage(imgData");
  });
});
