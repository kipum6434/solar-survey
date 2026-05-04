import jsPDF from "jspdf";

// ==================== TYPES ====================
interface CustomerData {
  name: string;
  phone?: string | null;
  email?: string | null;
  fullAddress?: string | null;
  subDistrict?: string | null;
  district?: string | null;
  province?: string | null;
  postalCode?: string | null;
  electricityBill?: string | number | null;
  roofType?: string | null;
  roofArea?: string | number | null;
  phaseType?: string | null;
  meterSize?: string | null;
  notes?: string | null;
}

interface SurveyData {
  id: number;
  status: string;
  scheduledDate?: number | null;
  systemSize?: string | number | null;
  panelCount?: number | null;
  panelBrand?: string | null;
  inverterModel?: string | null;
  quotedPrice?: string | number | null;
  estimatedCost?: string | number | null;
  needBattery?: string | null;
  needOptimizer?: string | null;
  systemType?: string | null;
  surveyNotes?: string | null;
  installationDate?: number | null;
  installationStatus?: string | null;
  completedAt?: number | null;
}

interface PhotoData {
  url: string;
  category?: string | null;
  caption?: string | null;
}

export interface CompanyInfo {
  companyName?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

// ==================== CONSTANTS ====================
const MARGIN = 15;
const PAGE_WIDTH = 210; // A4 width in mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_HEIGHT = 297; // A4 height in mm
const LINE_HEIGHT = 6;
const SECTION_GAP = 8;

const STATUS_LABELS: Record<string, string> = {
  pending: "รอดำเนินการ",
  scheduled: "นัดสำรวจแล้ว",
  in_progress: "กำลังสำรวจ",
  surveyed: "สำรวจเสร็จ",
  follow_up: "รอติดตาม",
  quoted: "เสนอราคาแล้ว",
  negotiating: "เจรจาต่อรอง",
  won: "ปิดการขาย",
  lost: "ไม่สำเร็จ",
  cancelled: "ยกเลิก",
};

const INSTALLATION_STATUS_LABELS: Record<string, string> = {
  waiting: "รอติดตั้ง",
  in_progress: "กำลังติดตั้ง",
  completed: "ติดตั้งเสร็จ",
  delivered: "ส่งมอบแล้ว",
};

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  string: "String Inverter",
  micro: "Micro Inverter",
  both: "ทั้งสองแบบ",
};

// ==================== FONT LOADING ====================
// Use Sarabun font for Thai support
let fontLoaded = false;
let fontBase64: string | null = null;

async function loadThaiFont(): Promise<string> {
  if (fontBase64) return fontBase64;
  
  // Try multiple font sources for reliability
  const fontUrls = [
    "https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf",
    "https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew-webfont.ttf",
  ];
  
  for (const fontUrl of fontUrls) {
    try {
      const response = await fetch(fontUrl);
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 1000) continue; // Too small, probably not a valid font
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64 = btoa(binary);
      return fontBase64;
    } catch (e) {
      console.warn(`Failed to load font from ${fontUrl}:`, e);
      continue;
    }
  }
  throw new Error("ไม่สามารถโหลดฟอนต์ภาษาไทยได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
}

async function setupFont(doc: jsPDF): Promise<void> {
  const base64 = await loadThaiFont();
  doc.addFileToVFS("Sarabun-Regular.ttf", base64);
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.setFont("Sarabun");
  fontLoaded = true;
}

// ==================== HELPERS ====================
function formatDate(ts: number | null | undefined): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatNumber(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "-";
  return Number(val).toLocaleString("th-TH");
}

// Full header height for pages 2+ (same as page 1, drawn in final pass)
const FULL_HEADER_HEIGHT = 36; // mm — same as page 1 header with company info

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    // Leave space for full header that will be drawn in final pass
    return FULL_HEADER_HEIGHT + 8;
  }
  return y;
}

/**
 * Draw a full repeating header on pages 2+ — identical to page 1 header.
 * Includes company name, address/phone, report title, customer info, date, logo, and page number.
 * @param headerColor - RGB tuple for the header bar color
 * @param reportTitle - e.g. "รายงานการสำรวจ Solar" or "รายงานส่งมอบงานติดตั้ง Solar"
 */
function drawFullHeader(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  companyName: string,
  customerName: string,
  surveyId: number,
  headerColor: [number, number, number],
  reportTitle: string,
  companyInfo?: CompanyInfo | null,
  logoData?: string | null,
): void {
  const hasCompanyInfo = companyInfo?.companyName || companyInfo?.phone || companyInfo?.address;
  const headerHeight = hasCompanyInfo ? FULL_HEADER_HEIGHT : 28;
  
  // Draw colored bar
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.rect(0, 0, PAGE_WIDTH, headerHeight, "F");
  
  // Logo (top-right)
  if (logoData) {
    const LOGO_SIZE = 14;
    const LOGO_X = PAGE_WIDTH - MARGIN - LOGO_SIZE;
    const LOGO_Y = 3;
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.roundedRect(LOGO_X - 1, LOGO_Y - 1, LOGO_SIZE + 2, LOGO_SIZE + 2, 2, 2, 'FD');
      doc.addImage(logoData, 'PNG', LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
    } catch { /* skip */ }
  }
  
  if (hasCompanyInfo) {
    // Company name as main title
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(companyInfo?.companyName || reportTitle, MARGIN, 10);
    
    // Company contact info
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    const contactParts: string[] = [];
    if (companyInfo?.phone) contactParts.push(`โทร: ${companyInfo.phone}`);
    if (companyInfo?.address) contactParts.push(companyInfo.address);
    if (contactParts.length > 0) {
      const contactText = contactParts.join("  |  ");
      const maxWidth = PAGE_WIDTH - MARGIN * 2 - 20;
      let displayText = contactText;
      if (doc.getTextWidth(displayText) > maxWidth) {
        while (doc.getTextWidth(displayText + "...") > maxWidth && displayText.length > 0) {
          displayText = displayText.slice(0, -1);
        }
        displayText += "...";
      }
      doc.text(displayText, MARGIN, 16);
    }
    
    // Report title line
    doc.setFontSize(10);
    doc.text(reportTitle, MARGIN, 23);
    
    // Customer + job number
    doc.setFontSize(9);
    doc.text(`ลูกค้า: ${customerName}  |  #${surveyId}`, MARGIN, 29);
    
    // Page number (right side, same line as customer)
    doc.setFontSize(8);
    const pageText = `หน้า ${pageNum}/${totalPages}`;
    doc.text(pageText, PAGE_WIDTH - MARGIN - doc.getTextWidth(pageText), 29);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(reportTitle, MARGIN, 12);
    doc.setFontSize(10);
    doc.text(`ลูกค้า: ${customerName}  |  #${surveyId}`, MARGIN, 20);
    
    // Page number
    doc.setFontSize(8);
    const pageText = `หน้า ${pageNum}/${totalPages}`;
    doc.text(pageText, PAGE_WIDTH - MARGIN - doc.getTextWidth(pageText), 20);
  }
}

function drawSectionHeader(doc: jsPDF, y: number, title: string): number {
  y = checkPageBreak(doc, y, 12);
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(MARGIN, y, 3, 8, "F");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(title, MARGIN + 6, y + 6);
  doc.setFontSize(9);
  return y + 12;
}

function drawKeyValue(doc: jsPDF, y: number, key: string, value: string, x?: number): number {
  y = checkPageBreak(doc, y, LINE_HEIGHT + 2);
  const startX = x || MARGIN + 4;
  doc.setTextColor(100, 100, 100);
  doc.text(key, startX, y);
  doc.setTextColor(30, 30, 30);
  const keyWidth = doc.getTextWidth(key + "  ");
  doc.text(value || "-", startX + keyWidth, y);
  return y + LINE_HEIGHT;
}

function drawKeyValueGrid(doc: jsPDF, y: number, items: { key: string; value: string }[]): number {
  const colWidth = CONTENT_WIDTH / 2;
  for (let i = 0; i < items.length; i += 2) {
    y = checkPageBreak(doc, y, LINE_HEIGHT + 2);
    // Left column
    doc.setTextColor(100, 100, 100);
    doc.text(items[i].key, MARGIN + 4, y);
    doc.setTextColor(30, 30, 30);
    const kw1 = doc.getTextWidth(items[i].key + "  ");
    const val1 = items[i].value || "-";
    doc.text(val1, MARGIN + 4 + kw1, y);
    
    // Right column
    if (i + 1 < items.length) {
      doc.setTextColor(100, 100, 100);
      doc.text(items[i + 1].key, MARGIN + colWidth, y);
      doc.setTextColor(30, 30, 30);
      const kw2 = doc.getTextWidth(items[i + 1].key + "  ");
      const val2 = items[i + 1].value || "-";
      doc.text(val2, MARGIN + colWidth + kw2, y);
    }
    y += LINE_HEIGHT;
  }
  return y;
}

// Type for image proxy function passed from components
export type ImageProxyFn = (url: string) => Promise<string | null>;

async function loadImageAsBase64(
  url: string,
  proxyFn?: ImageProxyFn,
): Promise<{ data: string; width: number; height: number } | null> {
  try {
    // Strategy 1: Use server-side proxy if provided (bypasses CORS)
    if (proxyFn) {
      const dataUrl = await proxyFn(url);
      if (dataUrl) {
        // Get dimensions by loading the data URL into an Image
        return await new Promise((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            resolve({ data: dataUrl, width: img.naturalWidth, height: img.naturalHeight });
          };
          img.onerror = () => resolve(null);
          img.src = dataUrl;
        });
      }
    }
    
    // Strategy 2: Direct canvas approach (works for same-origin or CORS-enabled images)
    return await new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        try {
          const data = canvas.toDataURL("image/jpeg", 0.7);
          resolve({ data, width: img.naturalWidth, height: img.naturalHeight });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

// ==================== LOGO WATERMARK ====================
const LOGO_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_LOGO) || '';
let cachedLogoBase64: string | null = null;

let lastLogoSource: string | null = null;

async function loadLogoBase64(proxyFn?: ImageProxyFn, customLogoUrl?: string | null): Promise<string | null> {
  const logoSource = customLogoUrl || LOGO_URL;
  if (!logoSource) return null;
  
  // Use cache only if the logo source hasn't changed
  if (cachedLogoBase64 && lastLogoSource === logoSource) return cachedLogoBase64;
  
  try {
    const result = await loadImageAsBase64(logoSource, proxyFn);
    if (result) {
      cachedLogoBase64 = result.data;
      lastLogoSource = logoSource;
      return cachedLogoBase64;
    }
  } catch { /* ignore */ }
  return null;
}

function addWatermarkToAllPages(doc: jsPDF, logoData: string): void {
  const pageCount = doc.getNumberOfPages();
  const LOGO_SIZE = 14; // mm
  const LOGO_X = PAGE_WIDTH - MARGIN - LOGO_SIZE;
  const LOGO_Y = 3; // top margin offset
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    try {
      // Draw semi-transparent background circle for the logo
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.roundedRect(LOGO_X - 1, LOGO_Y - 1, LOGO_SIZE + 2, LOGO_SIZE + 2, 2, 2, 'FD');
      
      // Add the logo image
      doc.addImage(logoData, 'PNG', LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
    } catch {
      // Silently skip if logo can't be added to a page
    }
  }
}

// ==================== SURVEY PDF ====================
export async function exportSurveyPDF(
  survey: SurveyData,
  customer: CustomerData,
  photos: PhotoData[],
  categoryMap: Record<string, string>,
  onProgress?: (step: string) => void,
  imageProxyFn?: ImageProxyFn,
  companyInfo?: CompanyInfo | null,
): Promise<void> {
  onProgress?.("กำลังเตรียมเอกสาร...");
  
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await setupFont(doc);
  
  let y = MARGIN;
  
  // ==================== HEADER ====================
  const hasCompanyInfo = companyInfo?.companyName || companyInfo?.phone || companyInfo?.address;
  const headerHeight = hasCompanyInfo ? 36 : 28;
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, PAGE_WIDTH, headerHeight, "F");
  
  if (hasCompanyInfo) {
    // Company name as main title
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(companyInfo?.companyName || "รายงานการสำรวจ Solar", MARGIN, 10);
    
    // Company contact info
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let contactY = 16;
    const contactParts: string[] = [];
    if (companyInfo?.phone) contactParts.push(`โทร: ${companyInfo.phone}`);
    if (companyInfo?.address) contactParts.push(companyInfo.address);
    if (contactParts.length > 0) {
      const contactText = contactParts.join("  |  ");
      // Truncate if too long
      const maxWidth = PAGE_WIDTH - MARGIN * 2 - 20;
      let displayText = contactText;
      if (doc.getTextWidth(displayText) > maxWidth) {
        while (doc.getTextWidth(displayText + "...") > maxWidth && displayText.length > 0) {
          displayText = displayText.slice(0, -1);
        }
        displayText += "...";
      }
      doc.text(displayText, MARGIN, contactY);
    }
    
    // Survey info line
    doc.setFontSize(10);
    doc.text("รายงานการสำรวจ Solar", MARGIN, 23);
    doc.setFontSize(9);
    doc.text(`ลูกค้า: ${customer.name}  |  #${survey.id}`, MARGIN, 29);
    doc.setFontSize(8);
    const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`พิมพ์เมื่อ: ${now}`, PAGE_WIDTH - MARGIN - doc.getTextWidth(`พิมพ์เมื่อ: ${now}`), 29);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("รายงานการสำรวจ Solar", MARGIN, 12);
    doc.setFontSize(10);
    doc.text(`ลูกค้า: ${customer.name}  |  #${survey.id}`, MARGIN, 20);
    doc.setFontSize(8);
    const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`พิมพ์เมื่อ: ${now}`, PAGE_WIDTH - MARGIN - doc.getTextWidth(`พิมพ์เมื่อ: ${now}`), 20);
  }
  
  y = headerHeight + 8;
  
  // ==================== STATUS ====================
  const statusLabel = STATUS_LABELS[survey.status] || survey.status;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("สถานะ: ", MARGIN + 4, y);
  doc.setTextColor(30, 30, 30);
  doc.text(statusLabel, MARGIN + 4 + doc.getTextWidth("สถานะ: "), y);
  if (survey.scheduledDate) {
    const dateStr = formatDate(survey.scheduledDate);
    doc.setTextColor(100, 100, 100);
    doc.text("  |  วันนัดสำรวจ: ", MARGIN + 4 + doc.getTextWidth("สถานะ: " + statusLabel), y);
    doc.setTextColor(30, 30, 30);
    doc.text(dateStr, MARGIN + 4 + doc.getTextWidth("สถานะ: " + statusLabel + "  |  วันนัดสำรวจ: "), y);
  }
  y += SECTION_GAP + 2;
  
  // ==================== CUSTOMER INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลลูกค้า...");
  y = drawSectionHeader(doc, y, "ข้อมูลลูกค้า");
  
  const customerItems: { key: string; value: string }[] = [
    { key: "ชื่อ:", value: customer.name },
    { key: "โทรศัพท์:", value: customer.phone || "-" },
  ];
  if (customer.email) customerItems.push({ key: "อีเมล:", value: customer.email });
  if (customer.fullAddress) customerItems.push({ key: "ที่อยู่:", value: customer.fullAddress });
  if (customer.subDistrict || customer.district || customer.province) {
    customerItems.push({ key: "พื้นที่:", value: [customer.subDistrict, customer.district, customer.province, customer.postalCode].filter(Boolean).join(", ") });
  }
  if (customer.electricityBill) customerItems.push({ key: "ค่าไฟ/เดือน:", value: `${customer.electricityBill} บาท` });
  if (customer.roofType) customerItems.push({ key: "ประเภทหลังคา:", value: customer.roofType });
  if (customer.roofArea) customerItems.push({ key: "พื้นที่หลังคา:", value: `${formatNumber(customer.roofArea)} ตร.ม.` });
  if (customer.phaseType) customerItems.push({ key: "ระบบไฟ:", value: customer.phaseType === "single" ? "1 เฟส" : "3 เฟส" });
  if (customer.meterSize) customerItems.push({ key: "ขนาดมิเตอร์:", value: customer.meterSize });
  if (customer.notes) customerItems.push({ key: "หมายเหตุ:", value: customer.notes });
  
  y = drawKeyValueGrid(doc, y, customerItems);
  y += SECTION_GAP;
  
  // ==================== TECHNICAL INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลเทคนิค...");
  y = drawSectionHeader(doc, y, "ข้อมูลทางเทคนิค");
  
  const techItems: { key: string; value: string }[] = [];
  if (survey.systemSize) techItems.push({ key: "ขนาดระบบ:", value: `${survey.systemSize} kW` });
  if (survey.panelCount) techItems.push({ key: "จำนวนแผง:", value: `${survey.panelCount} แผง` });
  if (survey.panelBrand) techItems.push({ key: "ยี่ห้อแผง:", value: survey.panelBrand });
  if (survey.inverterModel) techItems.push({ key: "อินเวอร์เตอร์:", value: survey.inverterModel });
  if (survey.quotedPrice) techItems.push({ key: "ราคาเสนอ:", value: `${formatNumber(survey.quotedPrice)} บาท` });
  if (survey.systemType) techItems.push({ key: "ประเภทระบบ:", value: SYSTEM_TYPE_LABELS[survey.systemType] || survey.systemType });
  if (survey.needBattery) techItems.push({ key: "แบตเตอรี่:", value: survey.needBattery });
  if (survey.needOptimizer) techItems.push({ key: "Optimizer:", value: survey.needOptimizer });
  
  if (techItems.length > 0) {
    y = drawKeyValueGrid(doc, y, techItems);
  } else {
    doc.setTextColor(150, 150, 150);
    doc.text("ยังไม่มีข้อมูลเทคนิค", MARGIN + 4, y);
    y += LINE_HEIGHT;
  }
  
  if (survey.surveyNotes) {
    y += 3;
    y = checkPageBreak(doc, y, LINE_HEIGHT * 3);
    doc.setTextColor(100, 100, 100);
    doc.text("หมายเหตุสำรวจ:", MARGIN + 4, y);
    y += LINE_HEIGHT;
    doc.setTextColor(30, 30, 30);
    const noteLines = doc.splitTextToSize(survey.surveyNotes, CONTENT_WIDTH - 8);
    for (const line of noteLines) {
      y = checkPageBreak(doc, y, LINE_HEIGHT);
      doc.text(line, MARGIN + 4, y);
      y += LINE_HEIGHT;
    }
  }
  y += SECTION_GAP;
  
  // ==================== PHOTOS ====================
  if (photos.length > 0) {
    onProgress?.(`กำลังเพิ่มรูปภาพ (${photos.length} รูป)...`);
    y = drawSectionHeader(doc, y, `รูปภาพหน้างาน (${photos.length} รูป)`);
    
    const PHOTO_SIZE = 55; // mm per photo
    const GAP = 5;
    const COLS = 3;
    
    for (let i = 0; i < photos.length; i++) {
      const col = i % COLS;
      if (col === 0 && i > 0) {
        y += PHOTO_SIZE + 16;
      }
      if (col === 0) {
        y = checkPageBreak(doc, y, PHOTO_SIZE + 18);
      }
      
      const x = MARGIN + col * (PHOTO_SIZE + GAP);
      
      onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${photos.length}...`);
      const imgData = await loadImageAsBase64(photos[i].url, imageProxyFn);
      
      if (imgData) {
        // Calculate aspect ratio
        const ratio = imgData.width / imgData.height;
        let imgW = PHOTO_SIZE;
        let imgH = PHOTO_SIZE;
        if (ratio > 1) {
          imgH = PHOTO_SIZE / ratio;
        } else {
          imgW = PHOTO_SIZE * ratio;
        }
        const offsetX = (PHOTO_SIZE - imgW) / 2;
        const offsetY = (PHOTO_SIZE - imgH) / 2;
        
        // Draw border
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.rect(x, y, PHOTO_SIZE, PHOTO_SIZE);
        
        doc.addImage(imgData.data, "JPEG", x + offsetX, y + offsetY, imgW, imgH);
      } else {
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, PHOTO_SIZE, PHOTO_SIZE, "FD");
        doc.setTextColor(180, 180, 180);
        doc.setFontSize(8);
        doc.text("โหลดรูปไม่ได้", x + PHOTO_SIZE / 2, y + PHOTO_SIZE / 2, { align: "center" });
        doc.setFontSize(9);
      }
      
      // Category label - wrap text to fit within column width
      const catLabel = categoryMap[photos[i].category || "other"] || photos[i].category || "อื่นๆ";
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      const maxCaptionWidth = PHOTO_SIZE - 2;
      const captionLines = doc.splitTextToSize(catLabel, maxCaptionWidth);
      // Show max 2 lines to keep layout clean
      const displayLines = captionLines.slice(0, 2);
      for (let lineIdx = 0; lineIdx < displayLines.length; lineIdx++) {
        doc.text(displayLines[lineIdx], x + PHOTO_SIZE / 2, y + PHOTO_SIZE + 4 + (lineIdx * 3.5), { align: "center" });
      }
      doc.setFontSize(9);
    }
    
    // Move past last row of photos
    y += PHOTO_SIZE + 16;
  }
  
  // ==================== FULL HEADER (all pages) + LOGO + FOOTER ====================
  onProgress?.("กำลังเพิ่มส่วนหัวและลายน้ำ...");
  const logoData = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);
  
  const pageCount = doc.getNumberOfPages();
  const footerCompanyName = companyInfo?.companyName || "Solar Survey Management System";
  const headerColor: [number, number, number] = [245, 158, 11]; // amber-500
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    if (i > 1) {
      // Pages 2+: draw full header identical to page 1
      drawFullHeader(
        doc, i, pageCount,
        footerCompanyName,
        customer.name,
        survey.id,
        headerColor,
        "รายงานการสำรวจ Solar",
        companyInfo,
        logoData,
      );
    } else {
      // Page 1: add logo + page number overlay on existing header
      if (logoData) {
        const LOGO_SIZE = 14;
        const LOGO_X = PAGE_WIDTH - MARGIN - LOGO_SIZE;
        const LOGO_Y = 3;
        try {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(230, 230, 230);
          doc.setLineWidth(0.2);
          doc.roundedRect(LOGO_X - 1, LOGO_Y - 1, LOGO_SIZE + 2, LOGO_SIZE + 2, 2, 2, 'FD');
          doc.addImage(logoData, 'PNG', LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
        } catch { /* skip */ }
      }
      // Add page number to page 1 as well
      const hasCI = companyInfo?.companyName || companyInfo?.phone || companyInfo?.address;
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      const p1Text = `หน้า 1/${pageCount}`;
      const p1Y = hasCI ? 29 : 20;
      doc.text(p1Text, PAGE_WIDTH - MARGIN - doc.getTextWidth(p1Text), p1Y);
    }
    
    // Footer on all pages
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`${footerCompanyName}  |  หน้า ${i}/${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: "center" });
  }
  
  onProgress?.("กำลังบันทึกไฟล์...");
  doc.save(`สำรวจ-${customer.name}-${survey.id}.pdf`);
}

// ==================== INSTALLATION/HANDOVER PDF ====================
export async function exportInstallationPDF(
  survey: SurveyData,
  customer: CustomerData,
  installPhotos: PhotoData[],
  categoryMap: Record<string, string>,
  deliveryInfo?: { deliveryStatus?: string; deliverySubmittedAt?: number; deliveryApprovedAt?: number; deliveryRejectionReason?: string } | null,
  onProgress?: (step: string) => void,
  imageProxyFn?: ImageProxyFn,
  companyInfo?: CompanyInfo | null,
): Promise<void> {
  onProgress?.("กำลังเตรียมเอกสาร...");
  
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await setupFont(doc);
  
  let y = MARGIN;
  
  // ==================== HEADER ====================
  const hasCompanyInfo = companyInfo?.companyName || companyInfo?.phone || companyInfo?.address;
  const headerHeight = hasCompanyInfo ? 36 : 28;
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, PAGE_WIDTH, headerHeight, "F");
  
  if (hasCompanyInfo) {
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(companyInfo?.companyName || "รายงานส่งมอบงานติดตั้ง Solar", MARGIN, 10);
    
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    const contactParts: string[] = [];
    if (companyInfo?.phone) contactParts.push(`โทร: ${companyInfo.phone}`);
    if (companyInfo?.address) contactParts.push(companyInfo.address);
    if (contactParts.length > 0) {
      const contactText = contactParts.join("  |  ");
      const maxWidth = PAGE_WIDTH - MARGIN * 2 - 20;
      let displayText = contactText;
      if (doc.getTextWidth(displayText) > maxWidth) {
        while (doc.getTextWidth(displayText + "...") > maxWidth && displayText.length > 0) {
          displayText = displayText.slice(0, -1);
        }
        displayText += "...";
      }
      doc.text(displayText, MARGIN, 16);
    }
    
    doc.setFontSize(10);
    doc.text("รายงานส่งมอบงานติดตั้ง Solar", MARGIN, 23);
    doc.setFontSize(9);
    doc.text(`ลูกค้า: ${customer.name}  |  #${survey.id}`, MARGIN, 29);
    doc.setFontSize(8);
    const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`พิมพ์เมื่อ: ${now}`, PAGE_WIDTH - MARGIN - doc.getTextWidth(`พิมพ์เมื่อ: ${now}`), 29);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("รายงานส่งมอบงานติดตั้ง Solar", MARGIN, 12);
    doc.setFontSize(10);
    doc.text(`ลูกค้า: ${customer.name}  |  #${survey.id}`, MARGIN, 20);
    doc.setFontSize(8);
    const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`พิมพ์เมื่อ: ${now}`, PAGE_WIDTH - MARGIN - doc.getTextWidth(`พิมพ์เมื่อ: ${now}`), 20);
  }
  
  y = headerHeight + 8;
  
  // ==================== INSTALLATION STATUS ====================
  const installLabel = survey.installationStatus ? (INSTALLATION_STATUS_LABELS[survey.installationStatus] || survey.installationStatus) : "-";
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("สถานะติดตั้ง: ", MARGIN + 4, y);
  doc.setTextColor(30, 30, 30);
  doc.text(installLabel, MARGIN + 4 + doc.getTextWidth("สถานะติดตั้ง: "), y);
  
  if (survey.installationDate) {
    const dateStr = formatDate(survey.installationDate);
    const offset = doc.getTextWidth("สถานะติดตั้ง: " + installLabel + "  |  ");
    doc.setTextColor(100, 100, 100);
    doc.text("  |  วันติดตั้ง: ", MARGIN + 4 + doc.getTextWidth("สถานะติดตั้ง: " + installLabel), y);
    doc.setTextColor(30, 30, 30);
    doc.text(dateStr, MARGIN + 4 + doc.getTextWidth("สถานะติดตั้ง: " + installLabel + "  |  วันติดตั้ง: "), y);
  }
  y += SECTION_GAP + 2;
  
  // ==================== CUSTOMER INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลลูกค้า...");
  y = drawSectionHeader(doc, y, "ข้อมูลลูกค้า");
  
  const customerItems: { key: string; value: string }[] = [
    { key: "ชื่อ:", value: customer.name },
    { key: "โทรศัพท์:", value: customer.phone || "-" },
  ];
  if (customer.fullAddress) customerItems.push({ key: "ที่อยู่:", value: customer.fullAddress });
  if (customer.subDistrict || customer.district || customer.province) {
    customerItems.push({ key: "พื้นที่:", value: [customer.subDistrict, customer.district, customer.province, customer.postalCode].filter(Boolean).join(", ") });
  }
  
  y = drawKeyValueGrid(doc, y, customerItems);
  y += SECTION_GAP;
  
  // ==================== TECHNICAL SUMMARY ====================
  onProgress?.("กำลังเพิ่มข้อมูลเทคนิค...");
  y = drawSectionHeader(doc, y, "ข้อมูลระบบที่ติดตั้ง");
  
  const techItems: { key: string; value: string }[] = [];
  if (survey.systemSize) techItems.push({ key: "ขนาดระบบ:", value: `${survey.systemSize} kW` });
  if (survey.panelCount) techItems.push({ key: "จำนวนแผง:", value: `${survey.panelCount} แผง` });
  if (survey.panelBrand) techItems.push({ key: "ยี่ห้อแผง:", value: survey.panelBrand });
  if (survey.inverterModel) techItems.push({ key: "อินเวอร์เตอร์:", value: survey.inverterModel });
  if (survey.systemType) techItems.push({ key: "ประเภทระบบ:", value: SYSTEM_TYPE_LABELS[survey.systemType] || survey.systemType });
  
  if (techItems.length > 0) {
    y = drawKeyValueGrid(doc, y, techItems);
  }
  y += SECTION_GAP;
  
  // ==================== DELIVERY INFO ====================
  if (deliveryInfo) {
    y = drawSectionHeader(doc, y, "ข้อมูลส่งมอบงาน");
    
    const deliveryStatusLabels: Record<string, string> = {
      pending: "รอส่งมอบ",
      submitted: "รออนุมัติ",
      approved: "อนุมัติแล้ว",
      rejected: "ถูกปฏิเสธ",
    };
    
    const delItems: { key: string; value: string }[] = [];
    if (deliveryInfo.deliveryStatus) delItems.push({ key: "สถานะส่งมอบ:", value: deliveryStatusLabels[deliveryInfo.deliveryStatus] || deliveryInfo.deliveryStatus });
    if (deliveryInfo.deliverySubmittedAt) delItems.push({ key: "วันส่งมอบ:", value: formatDate(deliveryInfo.deliverySubmittedAt) });
    if (deliveryInfo.deliveryApprovedAt) delItems.push({ key: "วันอนุมัติ:", value: formatDate(deliveryInfo.deliveryApprovedAt) });
    if (deliveryInfo.deliveryRejectionReason) delItems.push({ key: "เหตุผลปฏิเสธ:", value: deliveryInfo.deliveryRejectionReason });
    
    if (delItems.length > 0) {
      y = drawKeyValueGrid(doc, y, delItems);
    }
    y += SECTION_GAP;
  }
  
  // ==================== INSTALLATION PHOTOS ====================
  if (installPhotos.length > 0) {
    onProgress?.(`กำลังเพิ่มรูปติดตั้ง (${installPhotos.length} รูป)...`);
    y = drawSectionHeader(doc, y, `รูปภาพการติดตั้ง (${installPhotos.length} รูป)`);
    
    const PHOTO_SIZE = 55;
    const GAP = 5;
    const COLS = 3;
    
    for (let i = 0; i < installPhotos.length; i++) {
      const col = i % COLS;
      if (col === 0 && i > 0) {
        y += PHOTO_SIZE + 16;
      }
      if (col === 0) {
        y = checkPageBreak(doc, y, PHOTO_SIZE + 18);
      }
      
      const x = MARGIN + col * (PHOTO_SIZE + GAP);
      
      onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${installPhotos.length}...`);
      const imgData = await loadImageAsBase64(installPhotos[i].url, imageProxyFn);
      
      if (imgData) {
        const ratio = imgData.width / imgData.height;
        let imgW = PHOTO_SIZE;
        let imgH = PHOTO_SIZE;
        if (ratio > 1) {
          imgH = PHOTO_SIZE / ratio;
        } else {
          imgW = PHOTO_SIZE * ratio;
        }
        const offsetX = (PHOTO_SIZE - imgW) / 2;
        const offsetY = (PHOTO_SIZE - imgH) / 2;
        
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.rect(x, y, PHOTO_SIZE, PHOTO_SIZE);
        doc.addImage(imgData.data, "JPEG", x + offsetX, y + offsetY, imgW, imgH);
      } else {
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, PHOTO_SIZE, PHOTO_SIZE, "FD");
        doc.setTextColor(180, 180, 180);
        doc.setFontSize(8);
        doc.text("โหลดรูปไม่ได้", x + PHOTO_SIZE / 2, y + PHOTO_SIZE / 2, { align: "center" });
        doc.setFontSize(9);
      }
      
      const catLabel = categoryMap[installPhotos[i].category || "other"] || installPhotos[i].category || "อื่นๆ";
      doc.setFontSize(6.5);
      doc.setTextColor(100, 100, 100);
      const maxCaptionWidth = PHOTO_SIZE - 2;
      const captionLines = doc.splitTextToSize(catLabel, maxCaptionWidth);
      // Show max 2 lines to keep layout clean
      const displayLines = captionLines.slice(0, 2);
      for (let lineIdx = 0; lineIdx < displayLines.length; lineIdx++) {
        doc.text(displayLines[lineIdx], x + PHOTO_SIZE / 2, y + PHOTO_SIZE + 4 + (lineIdx * 3.5), { align: "center" });
      }
      doc.setFontSize(9);
    }
    
    y += PHOTO_SIZE + 16;
  }
  
  // ==================== COMPLETION NOTE ====================
  if (survey.completedAt) {
    y = checkPageBreak(doc, y, 20);
    y += 5;
    doc.setFillColor(240, 253, 244); // green-50
    doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 14, "F");
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74); // green-600
    doc.text("✓ ติดตั้งเสร็จสิ้น", MARGIN + 4, y + 2);
    doc.setFontSize(8);
    doc.text(`วันที่เสร็จ: ${formatDate(survey.completedAt)}`, MARGIN + 4, y + 8);
  }
  
  // ==================== FULL HEADER (all pages) + LOGO + FOOTER ====================
  onProgress?.("กำลังเพิ่มส่วนหัวและลายน้ำ...");
  const logoData = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);
  
  const pageCount = doc.getNumberOfPages();
  const footerCompanyName = companyInfo?.companyName || "Solar Survey Management System";
  const headerColor: [number, number, number] = [16, 185, 129]; // emerald-500
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    if (i > 1) {
      // Pages 2+: draw full header identical to page 1
      drawFullHeader(
        doc, i, pageCount,
        footerCompanyName,
        customer.name,
        survey.id,
        headerColor,
        "รายงานส่งมอบงานติดตั้ง Solar",
        companyInfo,
        logoData,
      );
    } else {
      // Page 1: add logo + page number overlay on existing header
      if (logoData) {
        const LOGO_SIZE = 14;
        const LOGO_X = PAGE_WIDTH - MARGIN - LOGO_SIZE;
        const LOGO_Y = 3;
        try {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(230, 230, 230);
          doc.setLineWidth(0.2);
          doc.roundedRect(LOGO_X - 1, LOGO_Y - 1, LOGO_SIZE + 2, LOGO_SIZE + 2, 2, 2, 'FD');
          doc.addImage(logoData, 'PNG', LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
        } catch { /* skip */ }
      }
      // Add page number to page 1 as well
      const hasCI = companyInfo?.companyName || companyInfo?.phone || companyInfo?.address;
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      const p1Text = `หน้า 1/${pageCount}`;
      const p1Y = hasCI ? 29 : 20;
      doc.text(p1Text, PAGE_WIDTH - MARGIN - doc.getTextWidth(p1Text), p1Y);
    }
    
    // Footer on all pages
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`${footerCompanyName}  |  หน้า ${i}/${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: "center" });
  }
  
  onProgress?.("กำลังบันทึกไฟล์...");
  doc.save(`ติดตั้ง-${customer.name}-${survey.id}.pdf`);
}
