import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

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
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
// Scale factor: pixels per mm (at 2x for retina quality)
const SCALE = 3; // 3px per mm for high quality
const PAGE_WIDTH_PX = PAGE_WIDTH_MM * SCALE;
const PAGE_HEIGHT_PX = PAGE_HEIGHT_MM * SCALE;
const MARGIN_PX = MARGIN_MM * SCALE;
const CONTENT_WIDTH_PX = CONTENT_WIDTH_MM * SCALE;

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

// Type for image proxy function passed from components
export type ImageProxyFn = (url: string) => Promise<string | null>;

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

function escHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ==================== FONT LOADING ====================
const FONT_URL_REGULAR = "/manus-storage/Sarabun-Regular_6dc461fe.ttf";
const FONT_URL_BOLD = "/manus-storage/Sarabun-Bold_4a9808be.ttf";

let fontStyleInjected = false;

async function ensureFontLoaded(): Promise<void> {
  if (fontStyleInjected) return;
  
  // Load fonts via CSS @font-face for html2canvas rendering
  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: 'SarabunPDF';
      src: url('${FONT_URL_REGULAR}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'SarabunPDF';
      src: url('${FONT_URL_BOLD}') format('truetype');
      font-weight: bold;
      font-style: normal;
    }
  `;
  document.head.appendChild(style);
  
  // Wait for fonts to actually load
  try {
    await document.fonts.load("16px SarabunPDF");
    await document.fonts.load("bold 16px SarabunPDF");
    // Small delay to ensure fonts are fully ready
    await new Promise(r => setTimeout(r, 200));
  } catch (e) {
    console.warn("Font loading warning:", e);
  }
  
  fontStyleInjected = true;
}

// ==================== IMAGE LOADING ====================
async function loadImageAsBase64(
  url: string,
  proxyFn?: ImageProxyFn,
): Promise<{ data: string; width: number; height: number } | null> {
  try {
    if (proxyFn) {
      const dataUrl = await proxyFn(url);
      if (dataUrl) {
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

// ==================== LOGO ====================
const LOGO_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_LOGO) || '';
let cachedLogoBase64: string | null = null;
let lastLogoSource: string | null = null;

async function loadLogoBase64(proxyFn?: ImageProxyFn, customLogoUrl?: string | null): Promise<string | null> {
  const logoSource = customLogoUrl || LOGO_URL;
  if (!logoSource) return null;
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

// ==================== HTML-BASED PDF RENDERING ====================

/**
 * Build the header HTML for a page.
 */
function buildHeaderHtml(
  headerColor: string,
  companyName: string,
  contactInfo: string,
  reportTitle: string,
  customerName: string,
  surveyId: number,
  pageNum: number,
  totalPages: number,
  logoData: string | null,
  printDate: string,
): string {
  const logoHtml = logoData
    ? `<div style="position:absolute;top:${8*SCALE}px;right:${MARGIN_PX}px;width:${14*SCALE}px;height:${14*SCALE}px;background:#fff;border-radius:${2*SCALE}px;border:1px solid #e6e6e6;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${logoData}" style="width:${13*SCALE}px;height:${13*SCALE}px;object-fit:contain;" />
      </div>`
    : "";

  return `
    <div style="position:relative;width:${PAGE_WIDTH_PX}px;height:${36*SCALE}px;background:${headerColor};padding:${MARGIN_PX}px;box-sizing:border-box;font-family:'SarabunPDF',sans-serif;">
      <div style="color:#fff;font-size:${14*SCALE}px;font-weight:bold;line-height:1.3;padding-right:${16*SCALE}px;">${escHtml(companyName)}</div>
      <div style="color:rgba(255,255,255,0.9);font-size:${7*SCALE}px;line-height:1.4;margin-top:${1*SCALE}px;padding-right:${16*SCALE}px;">${escHtml(contactInfo)}</div>
      <div style="color:#fff;font-size:${10*SCALE}px;margin-top:${2*SCALE}px;">${escHtml(reportTitle)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:${1*SCALE}px;padding-right:${16*SCALE}px;">
        <span style="color:#fff;font-size:${9*SCALE}px;">ลูกค้า: ${escHtml(customerName)}  |  #${surveyId}</span>
        <span style="color:#fff;font-size:${8*SCALE}px;">หน้า ${pageNum}/${totalPages}</span>
      </div>
      <div style="position:absolute;bottom:${2*SCALE}px;right:${MARGIN_PX}px;color:rgba(255,255,255,0.85);font-size:${7*SCALE}px;">${escHtml(printDate)}</div>
      ${logoHtml}
    </div>
  `;
}

/**
 * Build a section header HTML
 */
function buildSectionHeaderHtml(title: string, accentColor: string = "#f59e0b"): string {
  return `
    <div style="display:flex;align-items:center;margin-top:${8*SCALE}px;margin-bottom:${4*SCALE}px;">
      <div style="width:${3*SCALE}px;height:${8*SCALE}px;background:${accentColor};margin-right:${4*SCALE}px;border-radius:1px;"></div>
      <span style="font-size:${12*SCALE}px;font-weight:bold;color:#1e1e1e;">${escHtml(title)}</span>
    </div>
  `;
}

/**
 * Build key-value grid HTML (2 columns)
 */
function buildKeyValueGridHtml(items: { key: string; value: string }[]): string {
  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${2*SCALE}px ${8*SCALE}px;margin-bottom:${4*SCALE}px;">`;
  for (const item of items) {
    html += `
      <div style="font-size:${9*SCALE}px;line-height:1.5;">
        <span style="color:#646464;">${escHtml(item.key)}</span>
        <span style="color:#1e1e1e;font-weight:bold;margin-left:${2*SCALE}px;">${escHtml(item.value || "-")}</span>
      </div>
    `;
  }
  html += `</div>`;
  return html;
}

/**
 * Build photo grid HTML
 */
function buildPhotoGridHtml(
  photos: { url: string; dataUrl: string | null; category: string }[],
): string {
  const PHOTO_SIZE = 55 * SCALE;
  const GAP = 5 * SCALE;
  
  let html = `<div style="display:flex;flex-wrap:wrap;gap:${GAP}px;margin-top:${4*SCALE}px;">`;
  for (const photo of photos) {
    html += `
      <div style="width:${PHOTO_SIZE}px;text-align:center;">
        <div style="width:${PHOTO_SIZE}px;height:${PHOTO_SIZE}px;border:1px solid #dcdcdc;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f5f5f5;">
          ${photo.dataUrl
            ? `<img src="${photo.dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
            : `<span style="color:#b4b4b4;font-size:${8*SCALE}px;">โหลดรูปไม่ได้</span>`
          }
        </div>
        <div style="font-size:${6.5*SCALE}px;color:#646464;margin-top:${2*SCALE}px;word-break:break-word;">${escHtml(photo.category)}</div>
      </div>
    `;
  }
  html += `</div>`;
  return html;
}

/**
 * Build footer HTML
 */
function buildFooterHtml(companyName: string, pageNum: number, totalPages: number): string {
  return `
    <div style="position:absolute;bottom:${6*SCALE}px;left:0;right:0;text-align:center;font-size:${7*SCALE}px;color:#b4b4b4;">
      ${escHtml(companyName)}  |  หน้า ${pageNum}/${totalPages}
    </div>
  `;
}

/**
 * Render an HTML element to a canvas image, then add to PDF page.
 * This is the core function that ensures Thai text renders correctly
 * by using the browser's text rendering engine.
 */
async function renderHtmlToPdfPage(
  doc: jsPDF,
  htmlContent: string,
  pageIndex: number,
): Promise<void> {
  // Create a temporary container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = `${PAGE_WIDTH_PX}px`;
  container.style.minHeight = `${PAGE_HEIGHT_PX}px`;
  container.style.fontFamily = "'SarabunPDF', sans-serif";
  container.style.fontSize = `${9*SCALE}px`;
  container.style.lineHeight = "1.5";
  container.style.color = "#1e1e1e";
  container.style.background = "#ffffff";
  container.innerHTML = htmlContent;
  
  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      scale: 1, // Already at high resolution via our SCALE factor
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: PAGE_WIDTH_PX,
      height: PAGE_HEIGHT_PX,
    });
    
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    
    if (pageIndex > 0) {
      doc.addPage();
    }
    
    doc.addImage(imgData, "JPEG", 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Split content into pages. Each page has a header, content area, and footer.
 * Returns an array of HTML strings, one per page.
 */
function paginateContent(
  headerHtmlFn: (pageNum: number, totalPages: number) => string,
  footerHtmlFn: (pageNum: number, totalPages: number) => string,
  contentBlocks: string[],
): string[] {
  // Available content height per page (in px)
  const HEADER_HEIGHT = 36 * SCALE;
  const FOOTER_HEIGHT = 12 * SCALE;
  const CONTENT_AREA_HEIGHT = PAGE_HEIGHT_PX - HEADER_HEIGHT - FOOTER_HEIGHT - (8 * SCALE); // 8*SCALE padding
  
  // We'll estimate content heights and split into pages
  // For simplicity, we render all content first, then split by measuring
  const pages: string[][] = [[]];
  let currentPageHeight = 0;
  
  for (const block of contentBlocks) {
    // Estimate block height based on content
    const estimatedHeight = estimateBlockHeight(block);
    
    if (currentPageHeight + estimatedHeight > CONTENT_AREA_HEIGHT && currentPageHeight > 0) {
      // Start new page
      pages.push([]);
      currentPageHeight = 0;
    }
    
    pages[pages.length - 1].push(block);
    currentPageHeight += estimatedHeight;
  }
  
  const totalPages = pages.length;
  
  return pages.map((pageBlocks, idx) => {
    const pageNum = idx + 1;
    return `
      <div style="width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;position:relative;overflow:hidden;background:#fff;">
        ${headerHtmlFn(pageNum, totalPages)}
        <div style="padding:${4*SCALE}px ${MARGIN_PX}px;box-sizing:border-box;">
          ${pageBlocks.join("")}
        </div>
        ${footerHtmlFn(pageNum, totalPages)}
      </div>
    `;
  });
}

/**
 * Estimate the height of an HTML block in pixels.
 * This is a rough estimate used for pagination.
 */
function estimateBlockHeight(html: string): number {
  // Count approximate lines based on content
  const lineHeight = 9 * SCALE * 1.5; // font-size * line-height
  
  // Photo grid: estimate based on number of photos
  const photoMatches = html.match(/<img /g);
  if (photoMatches && photoMatches.length > 0) {
    const photoSize = 55 * SCALE;
    const rows = Math.ceil(photoMatches.length / 3);
    return rows * (photoSize + 20 * SCALE) + 16 * SCALE;
  }
  
  // Section header
  if (html.includes("font-weight:bold") && html.includes("margin-top")) {
    const lines = (html.match(/<div/g) || []).length;
    if (lines <= 3) return 16 * SCALE;
  }
  
  // Key-value grid
  if (html.includes("grid-template-columns")) {
    const items = (html.match(/<span/g) || []).length / 2;
    const rows = Math.ceil(items / 2);
    return rows * lineHeight + 8 * SCALE;
  }
  
  // Generic text blocks
  const divCount = (html.match(/<div/g) || []).length;
  const textLength = html.replace(/<[^>]*>/g, "").length;
  const estimatedLines = Math.max(divCount, Math.ceil(textLength / 60));
  
  return Math.max(estimatedLines * lineHeight, lineHeight) + 4 * SCALE;
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
  
  await ensureFontLoaded();
  
  const logoData = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);
  const headerColor = "#f59e0b"; // amber-500
  const companyName = companyInfo?.companyName || "รายงานการสำรวจ Solar";
  const contactParts: string[] = [];
  if (companyInfo?.phone) contactParts.push(`โทร: ${companyInfo.phone}`);
  if (companyInfo?.address) contactParts.push(companyInfo.address);
  const contactInfo = contactParts.join("  |  ");
  const reportTitle = "รายงานการสำรวจ Solar";
  const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const printDate = `พิมพ์เมื่อ: ${now}`;
  
  // Build content blocks
  const contentBlocks: string[] = [];
  
  // Status line
  const statusLabel = STATUS_LABELS[survey.status] || survey.status;
  let statusHtml = `<div style="font-size:${9*SCALE}px;margin-top:${4*SCALE}px;margin-bottom:${6*SCALE}px;">`;
  statusHtml += `<span style="color:#646464;">สถานะ: </span><span style="color:#1e1e1e;">${escHtml(statusLabel)}</span>`;
  if (survey.scheduledDate) {
    statusHtml += `<span style="color:#646464;">  |  วันนัดสำรวจ: </span><span style="color:#1e1e1e;">${escHtml(formatDate(survey.scheduledDate))}</span>`;
  }
  statusHtml += `</div>`;
  contentBlocks.push(statusHtml);
  
  // Customer info section
  onProgress?.("กำลังเพิ่มข้อมูลลูกค้า...");
  contentBlocks.push(buildSectionHeaderHtml("ข้อมูลลูกค้า"));
  
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
  
  contentBlocks.push(buildKeyValueGridHtml(customerItems));
  
  // Technical info section
  onProgress?.("กำลังเพิ่มข้อมูลเทคนิค...");
  contentBlocks.push(buildSectionHeaderHtml("ข้อมูลทางเทคนิค"));
  
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
    contentBlocks.push(buildKeyValueGridHtml(techItems));
  } else {
    contentBlocks.push(`<div style="font-size:${9*SCALE}px;color:#969696;margin-bottom:${4*SCALE}px;">ยังไม่มีข้อมูลเทคนิค</div>`);
  }
  
  // Survey notes
  if (survey.surveyNotes) {
    let notesHtml = `<div style="margin-top:${3*SCALE}px;margin-bottom:${6*SCALE}px;">`;
    notesHtml += `<div style="font-size:${9*SCALE}px;color:#646464;margin-bottom:${2*SCALE}px;">หมายเหตุสำรวจ:</div>`;
    notesHtml += `<div style="font-size:${9*SCALE}px;color:#1e1e1e;white-space:pre-wrap;padding-left:${4*SCALE}px;">${escHtml(survey.surveyNotes)}</div>`;
    notesHtml += `</div>`;
    contentBlocks.push(notesHtml);
  }
  
  // Photos section
  if (photos.length > 0) {
    onProgress?.(`กำลังเพิ่มรูปภาพ (${photos.length} รูป)...`);
    contentBlocks.push(buildSectionHeaderHtml(`รูปภาพหน้างาน (${photos.length} รูป)`));
    
    // Load all photo data
    const photoDataList: { url: string; dataUrl: string | null; category: string }[] = [];
    for (let i = 0; i < photos.length; i++) {
      onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${photos.length}...`);
      const imgData = await loadImageAsBase64(photos[i].url, imageProxyFn);
      photoDataList.push({
        url: photos[i].url,
        dataUrl: imgData?.data || null,
        category: categoryMap[photos[i].category || "other"] || photos[i].category || "อื่นๆ",
      });
    }
    
    // Split photos into groups of 6 (2 rows of 3) per content block for pagination
    for (let i = 0; i < photoDataList.length; i += 6) {
      const chunk = photoDataList.slice(i, i + 6);
      contentBlocks.push(buildPhotoGridHtml(chunk));
    }
  }
  
  // Paginate
  onProgress?.("กำลังจัดหน้า...");
  const headerFn = (pn: number, tp: number) => buildHeaderHtml(
    headerColor, companyName, contactInfo, reportTitle,
    customer.name, survey.id, pn, tp, logoData, printDate,
  );
  const footerFn = (pn: number, tp: number) => buildFooterHtml(
    companyInfo?.companyName || "Solar Survey Management System", pn, tp,
  );
  
  const pages = paginateContent(headerFn, footerFn, contentBlocks);
  
  // Render pages to PDF
  onProgress?.("กำลังสร้าง PDF...");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(`กำลังเรนเดอร์หน้า ${i + 1}/${pages.length}...`);
    await renderHtmlToPdfPage(doc, pages[i], i);
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
  
  await ensureFontLoaded();
  
  const logoData = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);
  const headerColor = "#10b981"; // emerald-500
  const companyName = companyInfo?.companyName || "รายงานส่งมอบงานติดตั้ง Solar";
  const contactParts: string[] = [];
  if (companyInfo?.phone) contactParts.push(`โทร: ${companyInfo.phone}`);
  if (companyInfo?.address) contactParts.push(companyInfo.address);
  const contactInfo = contactParts.join("  |  ");
  const reportTitle = "รายงานส่งมอบงานติดตั้ง Solar";
  const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const printDate = `พิมพ์เมื่อ: ${now}`;
  
  // Build content blocks
  const contentBlocks: string[] = [];
  
  // Installation status line
  const installLabel = survey.installationStatus ? (INSTALLATION_STATUS_LABELS[survey.installationStatus] || survey.installationStatus) : "-";
  let statusHtml = `<div style="font-size:${9*SCALE}px;margin-top:${4*SCALE}px;margin-bottom:${6*SCALE}px;">`;
  statusHtml += `<span style="color:#646464;">สถานะติดตั้ง: </span><span style="color:#1e1e1e;">${escHtml(installLabel)}</span>`;
  if (survey.installationDate) {
    statusHtml += `<span style="color:#646464;">  |  วันติดตั้ง: </span><span style="color:#1e1e1e;">${escHtml(formatDate(survey.installationDate))}</span>`;
  }
  statusHtml += `</div>`;
  contentBlocks.push(statusHtml);
  
  // Customer info
  onProgress?.("กำลังเพิ่มข้อมูลลูกค้า...");
  contentBlocks.push(buildSectionHeaderHtml("ข้อมูลลูกค้า", "#10b981"));
  
  const customerItems: { key: string; value: string }[] = [
    { key: "ชื่อ:", value: customer.name },
    { key: "โทรศัพท์:", value: customer.phone || "-" },
  ];
  if (customer.fullAddress) customerItems.push({ key: "ที่อยู่:", value: customer.fullAddress });
  if (customer.subDistrict || customer.district || customer.province) {
    customerItems.push({ key: "พื้นที่:", value: [customer.subDistrict, customer.district, customer.province, customer.postalCode].filter(Boolean).join(", ") });
  }
  
  contentBlocks.push(buildKeyValueGridHtml(customerItems));
  
  // Technical info
  onProgress?.("กำลังเพิ่มข้อมูลเทคนิค...");
  contentBlocks.push(buildSectionHeaderHtml("ข้อมูลระบบที่ติดตั้ง", "#10b981"));
  
  const techItems: { key: string; value: string }[] = [];
  if (survey.systemSize) techItems.push({ key: "ขนาดระบบ:", value: `${survey.systemSize} kW` });
  if (survey.panelCount) techItems.push({ key: "จำนวนแผง:", value: `${survey.panelCount} แผง` });
  if (survey.panelBrand) techItems.push({ key: "ยี่ห้อแผง:", value: survey.panelBrand });
  if (survey.inverterModel) techItems.push({ key: "อินเวอร์เตอร์:", value: survey.inverterModel });
  if (survey.systemType) techItems.push({ key: "ประเภทระบบ:", value: SYSTEM_TYPE_LABELS[survey.systemType] || survey.systemType });
  
  if (techItems.length > 0) {
    contentBlocks.push(buildKeyValueGridHtml(techItems));
  }
  
  // Delivery info
  if (deliveryInfo) {
    contentBlocks.push(buildSectionHeaderHtml("ข้อมูลส่งมอบงาน", "#10b981"));
    
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
      contentBlocks.push(buildKeyValueGridHtml(delItems));
    }
  }
  
  // Installation photos
  if (installPhotos.length > 0) {
    onProgress?.(`กำลังเพิ่มรูปติดตั้ง (${installPhotos.length} รูป)...`);
    contentBlocks.push(buildSectionHeaderHtml(`รูปภาพการติดตั้ง (${installPhotos.length} รูป)`, "#10b981"));
    
    const photoDataList: { url: string; dataUrl: string | null; category: string }[] = [];
    for (let i = 0; i < installPhotos.length; i++) {
      onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${installPhotos.length}...`);
      const imgData = await loadImageAsBase64(installPhotos[i].url, imageProxyFn);
      photoDataList.push({
        url: installPhotos[i].url,
        dataUrl: imgData?.data || null,
        category: categoryMap[installPhotos[i].category || "other"] || installPhotos[i].category || "อื่นๆ",
      });
    }
    
    for (let i = 0; i < photoDataList.length; i += 6) {
      const chunk = photoDataList.slice(i, i + 6);
      contentBlocks.push(buildPhotoGridHtml(chunk));
    }
  }
  
  // Completion note
  if (survey.completedAt) {
    contentBlocks.push(`
      <div style="margin-top:${5*SCALE}px;padding:${4*SCALE}px;background:#f0fdf4;border-radius:${2*SCALE}px;">
        <div style="font-size:${10*SCALE}px;color:#16a34a;font-weight:bold;">✓ ติดตั้งเสร็จสิ้น</div>
        <div style="font-size:${8*SCALE}px;color:#16a34a;margin-top:${2*SCALE}px;">วันที่เสร็จ: ${escHtml(formatDate(survey.completedAt))}</div>
      </div>
    `);
  }
  
  // Paginate
  onProgress?.("กำลังจัดหน้า...");
  const headerFn = (pn: number, tp: number) => buildHeaderHtml(
    headerColor, companyName, contactInfo, reportTitle,
    customer.name, survey.id, pn, tp, logoData, printDate,
  );
  const footerFn = (pn: number, tp: number) => buildFooterHtml(
    companyInfo?.companyName || "Solar Survey Management System", pn, tp,
  );
  
  const pages = paginateContent(headerFn, footerFn, contentBlocks);
  
  // Render pages to PDF
  onProgress?.("กำลังสร้าง PDF...");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(`กำลังเรนเดอร์หน้า ${i + 1}/${pages.length}...`);
    await renderHtmlToPdfPage(doc, pages[i], i);
  }
  
  onProgress?.("กำลังบันทึกไฟล์...");
  doc.save(`ติดตั้ง-${customer.name}-${survey.id}.pdf`);
}
