import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for the html2pdf.js-based PDF export with proper Thai font support.
 * Verifies that the export uses HTML rendering (not jsPDF doc.text) for correct Thai text.
 */

describe("PDF Export - html2pdf.js Thai Font Support", () => {
  let pdfSource: string;

  beforeAll(() => {
    const filePath = path.resolve(__dirname, "../client/src/lib/pdfExport.ts");
    pdfSource = fs.readFileSync(filePath, "utf-8");
  });

  describe("html2pdf.js Integration", () => {
    it("should import html2pdf.js", () => {
      expect(pdfSource).toContain('import html2pdf from "html2pdf.js"');
    });

    it("should NOT import jsPDF directly (replaced by html2pdf.js)", () => {
      expect(pdfSource).not.toContain('import { jsPDF }');
      expect(pdfSource).not.toContain("from 'jspdf'");
    });

    it("should use Sarabun font via Google Fonts CSS", () => {
      expect(pdfSource).toContain("fonts.googleapis.com");
      expect(pdfSource).toContain("Sarabun");
    });

    it("should set font-family to Sarabun in global styles", () => {
      expect(pdfSource).toContain("font-family: 'Sarabun', sans-serif");
    });

    it("should wait for fonts to load before generating PDF", () => {
      expect(pdfSource).toContain("document.fonts.ready");
    });
  });

  describe("HTML-based Layout", () => {
    it("should create a container with A4 width (210mm)", () => {
      expect(pdfSource).toContain('container.style.width = "210mm"');
    });

    it("should use html2pdf options with A4 format", () => {
      expect(pdfSource).toContain('format: "a4"');
      expect(pdfSource).toContain('orientation: "portrait"');
    });

    it("should use html2canvas with scale 2 for quality", () => {
      expect(pdfSource).toContain("scale: 2");
    });

    it("should clean up container after PDF generation", () => {
      expect(pdfSource).toContain("document.body.removeChild(container)");
    });

    it("should use hidden container (off-screen)", () => {
      expect(pdfSource).toContain('container.style.left = "-9999px"');
    });
  });

  describe("Survey PDF Export", () => {
    it("should export exportSurveyPDF function", () => {
      expect(pdfSource).toContain("export async function exportSurveyPDF");
    });

    it("should use amber color (#f59e0b) for survey header", () => {
      expect(pdfSource).toContain('"#f59e0b"');
    });

    it("should include report title 'รายงานการสำรวจ Solar'", () => {
      expect(pdfSource).toContain("รายงานการสำรวจ Solar");
    });

    it("should include customer info section", () => {
      expect(pdfSource).toContain("ข้อมูลลูกค้า");
    });

    it("should include technical info section", () => {
      expect(pdfSource).toContain("ข้อมูลทางเทคนิค");
    });

    it("should include photo grid for survey photos", () => {
      expect(pdfSource).toContain("รูปภาพหน้างาน");
    });

    it("should include survey notes when available", () => {
      expect(pdfSource).toContain("หมายเหตุสำรวจ");
    });

    it("should show print date in header", () => {
      expect(pdfSource).toContain("พิมพ์เมื่อ:");
    });

    it("should include status labels", () => {
      expect(pdfSource).toContain("รอดำเนินการ");
      expect(pdfSource).toContain("นัดสำรวจแล้ว");
    });
  });

  describe("Installation PDF Export", () => {
    it("should export exportInstallationPDF function", () => {
      expect(pdfSource).toContain("export async function exportInstallationPDF");
    });

    it("should use emerald color (#10b981) for installation header", () => {
      expect(pdfSource).toContain('"#10b981"');
    });

    it("should include report title 'รายงานส่งมอบงานติดตั้ง Solar'", () => {
      expect(pdfSource).toContain("รายงานส่งมอบงานติดตั้ง Solar");
    });

    it("should include installation status section", () => {
      expect(pdfSource).toContain("สถานะติดตั้ง");
    });

    it("should include delivery info section", () => {
      expect(pdfSource).toContain("ข้อมูลส่งมอบงาน");
    });

    it("should include installation photos section", () => {
      expect(pdfSource).toContain("รูปภาพการติดตั้ง");
    });

    it("should include completion note", () => {
      expect(pdfSource).toContain("ติดตั้งเสร็จสิ้น");
    });

    it("should include installation status labels", () => {
      expect(pdfSource).toContain("รอติดตั้ง");
      expect(pdfSource).toContain("กำลังติดตั้ง");
    });
  });

  describe("Header Structure", () => {
    it("should build header with company name", () => {
      expect(pdfSource).toContain("companyInfo?.companyName");
    });

    it("should include logo in header", () => {
      expect(pdfSource).toContain("logoBase64");
      expect(pdfSource).toContain('<img src="${logoBase64}"');
    });

    it("should include customer name and survey ID in header", () => {
      expect(pdfSource).toContain("ลูกค้า: ${escapeHtml(customerName)}  |  #${surveyId}");
    });

    it("should include company contact info in header", () => {
      expect(pdfSource).toContain("companyInfo?.phone");
      expect(pdfSource).toContain("companyInfo?.address");
    });
  });

  describe("Photo Grid", () => {
    it("should use 3-column grid for photos", () => {
      expect(pdfSource).toContain("grid-template-columns:1fr 1fr 1fr");
    });

    it("should maintain aspect ratio for photos", () => {
      expect(pdfSource).toContain("aspect-ratio:1");
    });

    it("should show category label under each photo", () => {
      expect(pdfSource).toContain("photo.label");
    });

    it("should handle failed image loads gracefully", () => {
      expect(pdfSource).toContain("โหลดรูปไม่ได้");
    });
  });

  describe("Thai Text Support", () => {
    it("should use HTML rendering (not jsPDF doc.text) for Thai text", () => {
      expect(pdfSource).not.toContain("doc.text(");
      expect(pdfSource).not.toContain("doc.setFont(");
    });

    it("should include Thai text with combining characters in labels", () => {
      expect(pdfSource).toContain("ทั้งสองแบบ");
      expect(pdfSource).toContain("ค่าไฟ/เดือน:");
    });

    it("should escape HTML in user content", () => {
      expect(pdfSource).toContain("function escapeHtml");
      expect(pdfSource).toContain("escapeHtml(");
    });
  });

  describe("CompanyInfo Interface", () => {
    it("should export CompanyInfo interface", () => {
      expect(pdfSource).toContain("export interface CompanyInfo");
    });

    it("should include all required fields", () => {
      expect(pdfSource).toContain("companyName?: string | null");
      expect(pdfSource).toContain("phone?: string | null");
      expect(pdfSource).toContain("address?: string | null");
      expect(pdfSource).toContain("logoUrl?: string | null");
    });
  });

  describe("ImageProxyFn", () => {
    it("should export ImageProxyFn type", () => {
      expect(pdfSource).toContain("export type ImageProxyFn");
    });

    it("should use image proxy for loading photos", () => {
      expect(pdfSource).toContain("loadImageAsBase64");
      expect(pdfSource).toContain("proxyFn");
    });
  });

  describe("Footer", () => {
    it("should include footer with company name", () => {
      expect(pdfSource).toContain("buildFooter(footerCompanyName)");
    });

    it("should position footer at bottom", () => {
      expect(pdfSource).toContain("position:fixed;bottom:0");
    });
  });
});
