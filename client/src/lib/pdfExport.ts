import pdfMakeModule from "pdfmake/build/pdfmake";
const pdfMake = pdfMakeModule as any;
import { SARABUN_REGULAR_BASE64, SARABUN_BOLD_BASE64 } from "./sarabunFont";

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
  photoBorderColor?: string | null;
  deliveryReportTitle?: string | null;
  surveyReportTitle?: string | null;
  installReportTitle?: string | null;
}

// ==================== CONSTANTS ====================
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
  hybrid: "Hybrid",
};

// ==================== FONT SETUP ====================
let fontsRegistered = false;

function ensureFontsRegistered(): void {
  if (fontsRegistered) return;

  // Register fonts in pdfmake's virtual file system
  const vfs: Record<string, string> = {
    "Sarabun-Regular.ttf": SARABUN_REGULAR_BASE64,
    "Sarabun-Bold.ttf": SARABUN_BOLD_BASE64,
  };

  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.setFonts({
    Sarabun: {
      normal: "Sarabun-Regular.ttf",
      bold: "Sarabun-Bold.ttf",
      italics: "Sarabun-Regular.ttf",
      bolditalics: "Sarabun-Bold.ttf",
    },
  });

  fontsRegistered = true;
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

// Type for image proxy function passed from components
export type ImageProxyFn = (url: string) => Promise<string | null>;

interface ImageLoadResult {
  data: string;
  width: number;
  height: number;
}

async function loadImageWithDimensions(
  url: string,
  proxyFn?: ImageProxyFn,
): Promise<ImageLoadResult | null> {
  try {
    // Strategy 1: Use server-side proxy if provided (bypasses CORS)
    if (proxyFn) {
      const dataUrl = await proxyFn(url);
      if (dataUrl) {
        // Get dimensions from the data URL
        const dims = await getImageDimensions(dataUrl);
        return dims ? { data: dataUrl, width: dims.width, height: dims.height } : { data: dataUrl, width: 1, height: 1 };
      }
    }

    // Strategy 2: Direct canvas approach
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

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function loadImageAsBase64(
  url: string,
  proxyFn?: ImageProxyFn,
): Promise<string | null> {
  try {
    // Strategy 1: Use server-side proxy if provided (bypasses CORS)
    if (proxyFn) {
      const dataUrl = await proxyFn(url);
      if (dataUrl) return dataUrl;
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
          resolve(data);
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
const LOGO_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_LOGO) || "";
let cachedLogoBase64: string | null = null;
let lastLogoSource: string | null = null;

async function loadLogoBase64(proxyFn?: ImageProxyFn, customLogoUrl?: string | null): Promise<string | null> {
  const logoSource = customLogoUrl || LOGO_URL;
  if (!logoSource) return null;

  if (cachedLogoBase64 && lastLogoSource === logoSource) return cachedLogoBase64;

  try {
    const result = await loadImageAsBase64(logoSource, proxyFn);
    if (result) {
      cachedLogoBase64 = result;
      lastLogoSource = logoSource;
      return cachedLogoBase64;
    }
  } catch { /* ignore */ }
  return null;
}

// ==================== PDF HEADER BUILDER ====================
interface HeaderConfig {
  companyName: string;
  reportTitle: string;
  customerName: string;
  surveyId: number;
  headerColor: string; // hex color like '#f59e0b'
  companyInfo?: CompanyInfo | null;
  logoData?: string | null;
  documentNumber?: string; // ISO document number e.g. FM-SA-01-04 REV.00
}

function buildHeader(
  config: HeaderConfig,
  currentPage: number,
  pageCount: number,
): any {
  const { companyName, reportTitle, customerName, surveyId, headerColor, companyInfo, logoData, documentNumber } = config;
  const hasCompanyInfo = companyInfo?.companyName || companyInfo?.phone || companyInfo?.address;

  // Build text content for the header
  const headerTexts: any[] = [];

  if (hasCompanyInfo) {
    // Line 1: Company name (large, white, bold)
    headerTexts.push({
      text: companyInfo?.companyName || reportTitle,
      fontSize: 13,
      bold: true,
      color: "#ffffff",
      margin: [0, 0, 0, 1] as number[],
    });

    // Line 2: Contact info (small, white)
    const contactParts: string[] = [];
    if (companyInfo?.phone) contactParts.push(`โทร: ${companyInfo.phone}`);
    if (companyInfo?.address) contactParts.push(companyInfo.address);
    if (contactParts.length > 0) {
      headerTexts.push({
        text: contactParts.join("  |  "),
        fontSize: 7,
        color: "#ffffff",
        margin: [0, 0, 0, 2] as number[],
      });
    }

    // Line 3: Report title
    headerTexts.push({
      text: reportTitle,
      fontSize: 10,
      color: "#ffffff",
      margin: [0, 0, 0, 1] as number[],
    });

    // Line 4: Customer + job ID + document number + page number
    headerTexts.push({
      columns: [
        {
          text: `ลูกค้า: ${customerName}  |  #${surveyId}`,
          fontSize: 9,
          color: "#ffffff",
          width: "*" as any,
        },
        {
          text: [documentNumber ? `${documentNumber}  |  ` : "", `หน้า ${currentPage}/${pageCount}`],
          fontSize: 8,
          color: "#ffffff",
          alignment: "right" as const,
          width: "auto" as any,
        },
      ],
      margin: [0, 0, 0, 0] as number[],
    });
  } else {
    // Simpler header without company info
    headerTexts.push({
      text: reportTitle,
      fontSize: 15,
      bold: true,
      color: "#ffffff",
      margin: [0, 0, 0, 2] as number[],
    });

    headerTexts.push({
      columns: [
        {
          text: `ลูกค้า: ${customerName}  |  #${surveyId}`,
          fontSize: 10,
          color: "#ffffff",
          width: "*" as any,
        },
        {
          text: [documentNumber ? `${documentNumber}  |  ` : "", `หน้า ${currentPage}/${pageCount}`],
          fontSize: 8,
          color: "#ffffff",
          alignment: "right" as const,
          width: "auto" as any,
        },
      ],
      margin: [0, 0, 0, 0] as number[],
    });
  }

  // Build the header table with colored background
  // If we have a logo, use columns layout
  let bodyContent: any;
  if (logoData) {
    bodyContent = {
      columns: [
        { stack: headerTexts, width: "*" },
        {
          image: logoData,
          width: 32,
          height: 32,
          margin: [0, 2, 0, 0] as number[],
        },
      ],
      columnGap: 5,
    };
  } else {
    bodyContent = { stack: headerTexts };
  }

  return {
    table: {
      widths: ["*"],
      body: [[bodyContent]],
    },
    layout: {
      fillColor: () => headerColor,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 15,
      paddingRight: () => 15,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
  };
}

// ==================== SECTION BUILDERS ====================
function buildSectionHeader(title: string, color: string = "#f59e0b"): any {
  return {
    table: {
      widths: [3, "*"],
      body: [[
        { text: "", fillColor: color },
        { text: title, fontSize: 11, bold: true, color: "#1e1e1e", margin: [4, 0, 0, 0] as number[] },
      ]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 4, 0, 4] as number[],
  };
}

function buildKeyValueGrid(items: { key: string; value: string }[]): any {
  const rows: any[][] = [];

  for (let i = 0; i < items.length; i += 2) {
    const row: any[] = [];
    // Left column key
    row.push({ text: items[i].key, fontSize: 9, color: "#646464" });
    // Left column value
    row.push({ text: items[i].value || "-", fontSize: 9, color: "#1e1e1e" });

    // Right column
    if (i + 1 < items.length) {
      row.push({ text: items[i + 1].key, fontSize: 9, color: "#646464" });
      row.push({ text: items[i + 1].value || "-", fontSize: 9, color: "#1e1e1e" });
    } else {
      row.push({ text: "", fontSize: 9 });
      row.push({ text: "", fontSize: 9 });
    }

    rows.push(row);
  }

  if (rows.length === 0) return { text: "" };

  return {
    table: {
      widths: ["auto", "*", "auto", "*"],
      body: rows,
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 1.5,
      paddingBottom: () => 1.5,
    },
    margin: [0, 0, 0, 4] as number[],
  };
}

function buildPhotoGrid(photos: { data: string; label: string; caption?: string | null; width?: number; height?: number }[], borderColor: string = "#d4d4d4"): any[] {
  // Build individual rows as separate tables so each row won't break across pages
  const COLS = 3;
  const result: any[] = [];

  for (let i = 0; i < photos.length; i += COLS) {
    const imageRow: any[] = [];
    const labelRow: any[] = [];

    for (let col = 0; col < COLS; col++) {
      const idx = i + col;
      if (idx < photos.length && photos[idx].data) {
        const IMG_BOX_SIZE = 148;
        const photo = photos[idx];

        // Calculate top margin for landscape images to center them vertically
        let topMargin = 0;
        if (photo.width && photo.height && photo.width > photo.height) {
          // Landscape image: calculate rendered height after fit
          const aspectRatio = photo.height / photo.width;
          const renderedHeight = IMG_BOX_SIZE * aspectRatio;
          topMargin = Math.max(0, (IMG_BOX_SIZE - renderedHeight) / 2);
        }

        imageRow.push({
          table: {
            widths: ["*"],
            heights: [IMG_BOX_SIZE],
            body: [[
              {
                image: photo.data,
                width: IMG_BOX_SIZE,
                height: IMG_BOX_SIZE,
                fit: [IMG_BOX_SIZE, IMG_BOX_SIZE] as [number, number],
                alignment: "center" as const,
                margin: [0, topMargin, 0, 0] as number[],
              },
            ]],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => borderColor,
            vLineColor: () => borderColor,
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 3,
            paddingBottom: () => 3,
            vLineAlignment: () => "center",
          },
        });
        const labelParts: any[] = [
          { text: photos[idx].label, fontSize: 7, color: "#646464" },
        ];
        if (photos[idx].caption) {
          labelParts.push({ text: "\n" + photos[idx].caption, fontSize: 7, color: "#333333", italics: true });
        }
        labelRow.push({
          text: labelParts,
          alignment: "center" as const,
          margin: [0, 2, 0, 6] as number[],
        });
      } else {
        imageRow.push({ text: "" });
        labelRow.push({ text: "" });
      }
    }

    // Each photo row is its own unbreakable table
    result.push({
      table: {
        widths: ["*", "*", "*"],
        body: [imageRow, labelRow],
        dontBreakRows: true,
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 3,
        paddingRight: () => 3,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      unbreakable: true,
      margin: [0, 0, 0, 2] as number[],
    });
  }

  return result;
}

// ==================== SURVEY PDF EXPORT ====================
export async function exportSurveyPDF(
  survey: SurveyData,
  customer: CustomerData,
  photos: PhotoData[],
  categoryMap: Record<string, string>,
  onProgress?: (step: string) => void,
  imageProxyFn?: ImageProxyFn,
  companyInfo?: CompanyInfo | null,
  categoryOrder?: string[],
  documentNumber?: string,
): Promise<void> {
  onProgress?.("กำลังเตรียมเอกสาร...");
  ensureFontsRegistered();

  const headerColor = "#f59e0b"; // amber-500
  const sectionColor = "#f59e0b"; // amber-500
  const footerCompanyName = companyInfo?.companyName || "Solar Survey Management System";

  // Load logo
  onProgress?.("กำลังโหลดโลโก้...");
  const logoData = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);

  const headerConfig: HeaderConfig = {
    companyName: footerCompanyName,
    reportTitle: companyInfo?.surveyReportTitle || "รายงานการสำรวจ Solar",
    customerName: customer.name,
    surveyId: survey.id,
    headerColor,
    companyInfo,
    logoData,
    documentNumber: documentNumber || "FM-SA-01-04 REV.00",
  };

  // Build content
  const content: any[] = [];

  // ==================== STATUS (hidden from PDF - internal use only) ====================

  // ==================== CUSTOMER INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลลูกค้า...");
  content.push(buildSectionHeader("ข้อมูลลูกค้า", sectionColor));

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
  // customer.notes hidden from PDF (internal use only)

  content.push(buildKeyValueGrid(customerItems));

  // ==================== TECHNICAL INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลเทคนิค...");
  content.push(buildSectionHeader("ข้อมูลทางเทคนิค", sectionColor));

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
    content.push(buildKeyValueGrid(techItems));
  } else {
    content.push({ text: "ยังไม่มีข้อมูลเทคนิค", fontSize: 9, color: "#969696", margin: [4, 0, 0, 4] as number[] });
  }

  // Survey notes hidden from PDF (internal use only)

  // ==================== PHOTOS ====================
  if (photos.length > 0) {
    onProgress?.(`กำลังเพิ่มรูปภาพ (${photos.length} รูป)...`);
    content.push(buildSectionHeader(`รูปภาพหน้างาน (${photos.length} รูป)`, sectionColor));

    // Sort photos by category order if provided
    const sortedPhotos = categoryOrder && categoryOrder.length > 0
      ? [...photos].sort((a, b) => {
          const catA = a.category || "other";
          const catB = b.category || "other";
          const idxA = categoryOrder.indexOf(catA);
          const idxB = categoryOrder.indexOf(catB);
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        })
      : photos;

    const loadedPhotos: { data: string; label: string; caption?: string | null; width?: number; height?: number }[] = [];

    for (let i = 0; i < sortedPhotos.length; i++) {
      onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${sortedPhotos.length}...`);
      const imgResult = await loadImageWithDimensions(sortedPhotos[i].url, imageProxyFn);
      const catLabel = categoryMap[sortedPhotos[i].category || "other"] || sortedPhotos[i].category || "อื่นๆ";

      if (imgResult) {
        loadedPhotos.push({ data: imgResult.data, label: catLabel, caption: sortedPhotos[i].caption, width: imgResult.width, height: imgResult.height });
      }
    }

    const borderColor = companyInfo?.photoBorderColor || "#d4d4d4";
    if (loadedPhotos.length > 0) {
      content.push(...buildPhotoGrid(loadedPhotos, borderColor));
    }
  }

  // ==================== BUILD DOC DEFINITION ====================
  onProgress?.("กำลังสร้าง PDF...");

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [15, 100, 15, 35],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 9,
    },
    header: (currentPage: number, pageCount: number) => {
      return buildHeader(headerConfig, currentPage, pageCount);
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        text: `${footerCompanyName}  |  หน้า ${currentPage}/${pageCount}`,
        alignment: "center",
        fontSize: 7,
        color: "#b4b4b4",
        margin: [0, 10, 0, 0] as number[],
      };
    },
    content,
  };

  onProgress?.("กำลังบันทึกไฟล์...");
  const pdfDoc = pdfMake.createPdf(docDefinition);
  await pdfDoc.download(`สำรวจ-${customer.name}-${survey.id}.pdf`);
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
  categoryOrder?: string[],
  documentNumber?: string,
): Promise<void> {
  onProgress?.("กำลังเตรียมเอกสาร...");
  ensureFontsRegistered();

  const headerColor = "#10b981"; // emerald-500
  const sectionColor = "#10b981"; // emerald-500
  const footerCompanyName = companyInfo?.companyName || "Solar Survey Management System";

  // Load logo
  onProgress?.("กำลังโหลดโลโก้...");
  const logoData = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);

  const headerConfig: HeaderConfig = {
    companyName: footerCompanyName,
    reportTitle: companyInfo?.installReportTitle || "รายงานส่งมอบงานติดตั้ง Solar",
    customerName: customer.name,
    surveyId: survey.id,
    headerColor,
    companyInfo,
    logoData,
    documentNumber: documentNumber || "FM-SA-01-04 REV.00",
  };

  // Build content
  const content: any[] = [];

  // ==================== INSTALLATION STATUS (hidden from PDF - internal use only) ====================

  // ==================== CUSTOMER INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลลูกค้า...");
  content.push(buildSectionHeader("ข้อมูลลูกค้า", sectionColor));

  const customerItems: { key: string; value: string }[] = [
    { key: "ชื่อ:", value: customer.name },
    { key: "โทรศัพท์:", value: customer.phone || "-" },
  ];
  if (customer.fullAddress) customerItems.push({ key: "ที่อยู่:", value: customer.fullAddress });
  if (customer.subDistrict || customer.district || customer.province) {
    customerItems.push({ key: "พื้นที่:", value: [customer.subDistrict, customer.district, customer.province, customer.postalCode].filter(Boolean).join(", ") });
  }

  content.push(buildKeyValueGrid(customerItems));

  // ==================== TECHNICAL SUMMARY ====================
  onProgress?.("กำลังเพิ่มข้อมูลเทคนิค...");
  content.push(buildSectionHeader("ข้อมูลระบบที่ติดตั้ง", sectionColor));

  const techItems: { key: string; value: string }[] = [];
  if (survey.systemSize) techItems.push({ key: "ขนาดระบบ:", value: `${survey.systemSize} kW` });
  if (survey.panelCount) techItems.push({ key: "จำนวนแผง:", value: `${survey.panelCount} แผง` });
  if (survey.panelBrand) techItems.push({ key: "ยี่ห้อแผง:", value: survey.panelBrand });
  if (survey.inverterModel) techItems.push({ key: "อินเวอร์เตอร์:", value: survey.inverterModel });
  if (survey.systemType) techItems.push({ key: "ประเภทระบบ:", value: SYSTEM_TYPE_LABELS[survey.systemType] || survey.systemType });

  if (techItems.length > 0) {
    content.push(buildKeyValueGrid(techItems));
  }

  // ==================== DELIVERY INFO ====================
  if (deliveryInfo) {
    content.push(buildSectionHeader("ข้อมูลส่งมอบงาน", sectionColor));

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
      content.push(buildKeyValueGrid(delItems));
    }
  }

  // ==================== INSTALLATION PHOTOS ====================
  if (installPhotos.length > 0) {
    onProgress?.(`กำลังเพิ่มรูปติดตั้ง (${installPhotos.length} รูป)...`);
    content.push(buildSectionHeader(`รูปภาพการติดตั้ง (${installPhotos.length} รูป)`, sectionColor));

    // Sort photos by category order if provided
    const sortedPhotos = categoryOrder && categoryOrder.length > 0
      ? [...installPhotos].sort((a, b) => {
          const catA = a.category || "other";
          const catB = b.category || "other";
          const idxA = categoryOrder.indexOf(catA);
          const idxB = categoryOrder.indexOf(catB);
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        })
      : installPhotos;

    const loadedPhotos: { data: string; label: string; caption?: string | null; width?: number; height?: number }[] = [];

    for (let i = 0; i < sortedPhotos.length; i++) {
      onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${sortedPhotos.length}...`);
      const imgResult = await loadImageWithDimensions(sortedPhotos[i].url, imageProxyFn);
      const catLabel = categoryMap[sortedPhotos[i].category || "other"] || sortedPhotos[i].category || "อื่นๆ";

      if (imgResult) {
        loadedPhotos.push({ data: imgResult.data, label: catLabel, caption: sortedPhotos[i].caption, width: imgResult.width, height: imgResult.height });
      }
    }

    const borderColor = companyInfo?.photoBorderColor || "#d4d4d4";
    if (loadedPhotos.length > 0) {
      content.push(...buildPhotoGrid(loadedPhotos, borderColor));
    }
  }

  // ==================== COMPLETION NOTE ====================
  if (survey.completedAt) {
    content.push({
      table: {
        widths: ["*"],
        body: [[{
          text: [
            { text: "✓ ติดตั้งเสร็จสิ้น", fontSize: 10, bold: true, color: "#16a34a" },
            { text: `    วันที่เสร็จ: ${formatDate(survey.completedAt)}`, fontSize: 8, color: "#16a34a" },
          ],
        }]],
      },
      layout: {
        fillColor: () => "#f0fdf4",
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 6,
        paddingBottom: () => 6,
      },
      margin: [0, 8, 0, 0] as number[],
    });
  }

  // ==================== BUILD DOC DEFINITION ====================
  onProgress?.("กำลังสร้าง PDF...");

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [15, 100, 15, 35],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 9,
    },
    header: (currentPage: number, pageCount: number) => {
      return buildHeader(headerConfig, currentPage, pageCount);
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        text: `${footerCompanyName}  |  หน้า ${currentPage}/${pageCount}`,
        alignment: "center",
        fontSize: 7,
        color: "#b4b4b4",
        margin: [0, 10, 0, 0] as number[],
      };
    },
    content,
  };

  onProgress?.("กำลังบันทึกไฟล์...");
  const pdfDoc = pdfMake.createPdf(docDefinition);
  await pdfDoc.download(`ติดตั้ง-${customer.name}-${survey.id}.pdf`);
}


// ==================== DELIVERY/HANDOVER PDF EXPORT ====================
export interface DeliveryPDFData {
  formId: number;
  surveyId: number;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  roofType?: string | null;
  phaseType?: string | null;
  systemSize?: string | number | null;
  panelCount?: number | null;
  panelBrand?: string | null;
  inverterModel?: string | null;
  checklistItems?: { label: string; checked: boolean; templateId?: number }[];
  templateNameMap?: Record<number, string>;
  customSections?: { title: string; content: string }[];
  notes?: string | null;
  disclaimerText?: string | null;
  photos?: { url: string; caption?: string | null }[];
  customerSignatureUrl?: string | null;
  customerSignerName?: string | null;
  technicianSignatureUrl?: string | null;
  technicianName?: string | null;
  signedAt?: number | null;
}

export async function exportDeliveryPDF(
  data: DeliveryPDFData,
  onProgress?: (step: string) => void,
  imageProxyFn?: ImageProxyFn,
  companyInfo?: CompanyInfo | null,
): Promise<void> {
  onProgress?.("กำลังเตรียมเอกสาร...");
  ensureFontsRegistered();

  const headerColor = companyInfo?.photoBorderColor || "#2563eb";
  const sectionColor = "#2563eb";
  const footerCompanyName = companyInfo?.companyName || "Solar Survey Management System";

  // Load logo
  onProgress?.("กำลังโหลดโลโก้...");
  const logoData = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);

  const headerConfig: HeaderConfig = {
    companyName: footerCompanyName,
    reportTitle: companyInfo?.deliveryReportTitle || "ใบส่งมอบงานติดตั้ง Solar",
    customerName: data.customerName,
    surveyId: data.surveyId,
    headerColor,
    companyInfo,
    logoData,
  };

  // Build content
  const content: any[] = [];

  // ==================== CUSTOMER INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลลูกค้า...");
  content.push(buildSectionHeader("ข้อมูลลูกค้า", sectionColor));

  const customerItems: { key: string; value: string }[] = [
    { key: "ชื่อ:", value: data.customerName },
    { key: "โทรศัพท์:", value: data.customerPhone || "-" },
  ];
  if (data.customerAddress) customerItems.push({ key: "ที่อยู่:", value: data.customerAddress });
  if (data.roofType) customerItems.push({ key: "ประเภทหลังคา:", value: data.roofType });
  if (data.phaseType) customerItems.push({ key: "ระบบไฟ:", value: data.phaseType === "three" ? "3 เฟส" : "1 เฟส" });

  content.push(buildKeyValueGrid(customerItems));

  // ==================== TECHNICAL INFO ====================
  onProgress?.("กำลังเพิ่มข้อมูลเทคนิค...");
  content.push(buildSectionHeader("ข้อมูลทางเทคนิค", sectionColor));

  const techItems: { key: string; value: string }[] = [];
  if (data.systemSize) techItems.push({ key: "ขนาดระบบ:", value: `${data.systemSize} kW` });
  if (data.panelCount) techItems.push({ key: "จำนวนแผง:", value: `${data.panelCount} แผง` });
  if (data.panelBrand) techItems.push({ key: "ยี่ห้อแผง:", value: data.panelBrand });
  if (data.inverterModel) techItems.push({ key: "อินเวอร์เตอร์:", value: data.inverterModel });

  if (techItems.length > 0) {
    content.push(buildKeyValueGrid(techItems));
  }

  // ==================== INSTALLATION PHOTOS ====================
  if (data.photos && data.photos.length > 0) {
    onProgress?.(`กำลังโหลดรูปภาพ (${data.photos.length} รูป)...`);
    content.push(buildSectionHeader(`รูปภาพหน้างาน (${data.photos.length} รูป)`, sectionColor));

    const loadedPhotos: { data: string; label: string; caption?: string | null; width?: number; height?: number }[] = [];

    for (let i = 0; i < data.photos.length; i++) {
      onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${data.photos.length}...`);
      const imgResult = await loadImageWithDimensions(data.photos[i].url, imageProxyFn);
      if (imgResult) {
        loadedPhotos.push({
          data: imgResult.data,
          label: `รูปที่ ${i + 1}`,
          caption: data.photos[i].caption,
          width: imgResult.width,
          height: imgResult.height,
        });
      }
    }

    const borderColor = companyInfo?.photoBorderColor || "#d4d4d4";
    if (loadedPhotos.length > 0) {
      content.push(...buildPhotoGrid(loadedPhotos, borderColor));
    }
  }

  // ==================== CHECKLIST (grouped by template) ====================
  if (data.checklistItems && data.checklistItems.length > 0) {
    onProgress?.("กำลังเพิ่มรายการตรวจสอบ...");
    content.push(buildSectionHeader("รายการตรวจสอบส่งมอบ", sectionColor));

    // Group by templateId
    const templateNameMap = data.templateNameMap || {};
    const groups: { templateId: number | undefined; name: string; items: typeof data.checklistItems }[] = [];
    let currentGroup: typeof groups[0] | null = null;

    data.checklistItems.forEach((item) => {
      const tid = item.templateId;
      if (!currentGroup || currentGroup.templateId !== tid) {
        currentGroup = {
          templateId: tid,
          name: tid ? (templateNameMap[tid] || `หมวด ${tid}`) : "รายการเพิ่มเติม",
          items: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });

    groups.forEach((group) => {
      // Group header
      if (groups.length > 1) {
        content.push({
          text: group.name,
          fontSize: 9,
          bold: true,
          color: "#374151",
          margin: [0, 4, 0, 2] as number[],
        });
      }

      // Checklist items
      const checklistRows: any[][] = group.items.map((item) => [
        { text: item.checked ? "☑" : "☐", fontSize: 11, alignment: "center" as const, color: item.checked ? "#16a34a" : "#9ca3af" },
        { text: item.label, fontSize: 9, color: item.checked ? "#1e1e1e" : "#6b7280" },
      ]);

      content.push({
        table: {
          widths: [16, "*"],
          body: checklistRows,
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 2,
          paddingRight: () => 4,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 4] as number[],
      });
    });
  }

  // ==================== CUSTOM SECTIONS ====================
  if (data.customSections && data.customSections.length > 0) {
    data.customSections.forEach((section) => {
      content.push(buildSectionHeader(section.title || "เนื้อหาเพิ่มเติม", sectionColor));
      content.push({
        text: section.content,
        fontSize: 9,
        color: "#374151",
        margin: [0, 0, 0, 6] as number[],
      });
    });
  }

  // ==================== NOTES ====================
  if (data.notes) {
    content.push(buildSectionHeader("หมายเหตุ", sectionColor));
    content.push({
      text: data.notes,
      fontSize: 9,
      color: "#374151",
      margin: [0, 0, 0, 6] as number[],
    });
  }

  // ==================== DISCLAIMER TEXT ====================
  if (data.disclaimerText) {
    content.push({
      table: {
        widths: ["*"],
        body: [[{
          text: data.disclaimerText,
          fontSize: 8,
          color: "#4b5563",
          lineHeight: 1.4,
        }]],
      },
      layout: {
        fillColor: () => "#f0f9ff",
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => "#bfdbfe",
        vLineColor: () => "#bfdbfe",
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 8, 0, 8] as number[],
    });
  }

  // ==================== SIGNATURES ====================
  onProgress?.("กำลังเพิ่มลายเซ็น...");

  // Load signature images
  let customerSigBase64: string | null = null;
  let technicianSigBase64: string | null = null;

  if (data.customerSignatureUrl) {
    customerSigBase64 = await loadImageAsBase64(data.customerSignatureUrl, imageProxyFn);
  }
  if (data.technicianSignatureUrl) {
    technicianSigBase64 = await loadImageAsBase64(data.technicianSignatureUrl, imageProxyFn);
  }

  content.push(buildSectionHeader("ลายเซ็น", sectionColor));

  // Professional signature table with balanced columns
  const SIG_IMG_W = 140;
  const SIG_IMG_H = 60;
  const LINE_LENGTH = 160;
  const LINE_X_START = (LINE_LENGTH > 0) ? (200 - LINE_LENGTH) / 2 : 20;
  const LINE_X_END = LINE_X_START + LINE_LENGTH;

  // Build left column (customer)
  const sigLeftContent: any[] = [
    { text: "ลายเซ็นลูกค้า (ผู้รับมอบ)", fontSize: 9, bold: true, alignment: "center" as const, margin: [0, 0, 0, 8] as number[] },
  ];
  if (customerSigBase64) {
    sigLeftContent.push({ image: customerSigBase64, width: SIG_IMG_W, height: SIG_IMG_H, fit: [SIG_IMG_W, SIG_IMG_H] as [number, number], alignment: "center" as const, margin: [0, 4, 0, 8] as number[] });
  } else {
    sigLeftContent.push({ text: "(ยังไม่ได้เซ็น)", fontSize: 8, color: "#9ca3af", alignment: "center" as const, margin: [0, 20, 0, 20] as number[] });
  }
  sigLeftContent.push({ canvas: [{ type: "line" as const, x1: LINE_X_START, y1: 0, x2: LINE_X_END, y2: 0, lineWidth: 0.5, lineColor: "#374151" }] });
  sigLeftContent.push({ text: data.customerSignerName ? `(${data.customerSignerName})` : "(..................................)", fontSize: 8, alignment: "center" as const, margin: [0, 4, 0, 0] as number[], color: "#374151" });

  // Build right column (technician)
  const sigRightContent: any[] = [
    { text: "ลายเซ็นช่าง (ผู้ส่งมอบ)", fontSize: 9, bold: true, alignment: "center" as const, margin: [0, 0, 0, 8] as number[] },
  ];
  if (technicianSigBase64) {
    sigRightContent.push({ image: technicianSigBase64, width: SIG_IMG_W, height: SIG_IMG_H, fit: [SIG_IMG_W, SIG_IMG_H] as [number, number], alignment: "center" as const, margin: [0, 4, 0, 8] as number[] });
  } else {
    sigRightContent.push({ text: "(ยังไม่ได้เซ็น)", fontSize: 8, color: "#9ca3af", alignment: "center" as const, margin: [0, 20, 0, 20] as number[] });
  }
  sigRightContent.push({ canvas: [{ type: "line" as const, x1: LINE_X_START, y1: 0, x2: LINE_X_END, y2: 0, lineWidth: 0.5, lineColor: "#374151" }] });
  sigRightContent.push({ text: data.technicianName ? `(${data.technicianName})` : "(..................................)", fontSize: 8, alignment: "center" as const, margin: [0, 4, 0, 0] as number[], color: "#374151" });

  // Signature area in a bordered table for formal look
  content.push({
    table: {
      widths: ["*", "*"],
      body: [
        [
          { stack: sigLeftContent, alignment: "center" as const, margin: [10, 12, 10, 12] as number[] },
          { stack: sigRightContent, alignment: "center" as const, margin: [10, 12, 10, 12] as number[] },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#e5e7eb",
      vLineColor: () => "#e5e7eb",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 8, 0, 6] as number[],
  });

  // Date centered below signature box
  if (data.signedAt) {
    content.push({
      text: `วันที่เซ็น: ${formatDate(data.signedAt)}`,
      fontSize: 8,
      alignment: "center" as const,
      color: "#4b5563",
      margin: [0, 4, 0, 0] as number[],
    });
  }

  // ==================== BUILD DOC DEFINITION ====================
  onProgress?.("กำลังสร้าง PDF...");

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [15, 100, 15, 35],
    defaultStyle: {
      font: "Sarabun",
      fontSize: 9,
    },
    header: (currentPage: number, pageCount: number) => {
      return buildHeader(headerConfig, currentPage, pageCount);
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        text: `${footerCompanyName}  |  หน้า ${currentPage}/${pageCount}`,
        alignment: "center",
        fontSize: 7,
        color: "#b4b4b4",
        margin: [0, 10, 0, 0] as number[],
      };
    },
    content,
  };

  onProgress?.("กำลังบันทึกไฟล์...");
  const pdfDoc = pdfMake.createPdf(docDefinition);
  await pdfDoc.download(`ใบส่งมอบ-${data.customerName}-DF${data.formId}.pdf`);
}
