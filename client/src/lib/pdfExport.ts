import html2pdf from "html2pdf.js";

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================== IMAGE LOADING ====================
async function loadImageAsBase64(
  url: string,
  proxyFn?: ImageProxyFn,
): Promise<string | null> {
  try {
    if (proxyFn) {
      const dataUrl = await proxyFn(url);
      if (dataUrl) return dataUrl;
    }
    // Fallback: canvas approach
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
          resolve(canvas.toDataURL("image/jpeg", 0.7));
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

async function loadLogoBase64(proxyFn?: ImageProxyFn, customLogoUrl?: string | null): Promise<string | null> {
  const logoUrl = customLogoUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_LOGO) || '';
  if (!logoUrl) return null;
  return await loadImageAsBase64(logoUrl, proxyFn);
}

// ==================== HTML BUILDERS ====================

function buildHeaderHtml(
  companyName: string,
  customerName: string,
  surveyId: number,
  headerColor: string,
  reportTitle: string,
  companyInfo?: CompanyInfo | null,
  logoBase64?: string | null,
  pageInfo?: string,
  printDate?: string,
): string {
  const hasCompanyInfo = companyInfo?.companyName || companyInfo?.phone || companyInfo?.address;
  const logoHtml = logoBase64
    ? `<div style="position:absolute;top:4mm;right:4mm;width:14mm;height:14mm;background:#fff;border-radius:2mm;border:0.3mm solid #e6e6e6;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <img src="${logoBase64}" style="width:12mm;height:12mm;object-fit:contain;" />
      </div>`
    : '';

  if (hasCompanyInfo) {
    const contactParts: string[] = [];
    if (companyInfo?.phone) contactParts.push(`โทร: ${companyInfo.phone}`);
    if (companyInfo?.address) contactParts.push(escapeHtml(companyInfo.address));
    const contactLine = contactParts.join("  |  ");

    return `
      <div style="position:relative;background:${headerColor};padding:3mm 4mm;min-height:32mm;color:#fff;font-family:'Sarabun',sans-serif;page-break-inside:avoid;">
        ${logoHtml}
        <div style="font-size:14pt;font-weight:bold;margin-bottom:1mm;padding-right:18mm;">${escapeHtml(companyInfo?.companyName || reportTitle)}</div>
        <div style="font-size:7pt;margin-bottom:2mm;padding-right:18mm;opacity:0.95;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:150mm;">${contactLine}</div>
        <div style="font-size:10pt;margin-bottom:1mm;">${escapeHtml(reportTitle)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-right:18mm;">
          <span style="font-size:9pt;">ลูกค้า: ${escapeHtml(customerName)}  |  #${surveyId}</span>
          <span style="font-size:8pt;">${pageInfo || ''}</span>
        </div>
        ${printDate ? `<div style="position:absolute;bottom:3mm;right:20mm;font-size:7.5pt;opacity:0.9;">${escapeHtml(printDate)}</div>` : ''}
      </div>`;
  } else {
    return `
      <div style="position:relative;background:${headerColor};padding:3mm 4mm;min-height:24mm;color:#fff;font-family:'Sarabun',sans-serif;page-break-inside:avoid;">
        ${logoHtml}
        <div style="font-size:16pt;font-weight:bold;margin-bottom:2mm;">${escapeHtml(reportTitle)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-right:18mm;">
          <span style="font-size:10pt;">ลูกค้า: ${escapeHtml(customerName)}  |  #${surveyId}</span>
          <span style="font-size:8pt;">${pageInfo || ''}</span>
        </div>
        ${printDate ? `<div style="position:absolute;bottom:3mm;right:20mm;font-size:7.5pt;opacity:0.9;">${escapeHtml(printDate)}</div>` : ''}
      </div>`;
  }
}

function buildSectionHeader(title: string): string {
  return `
    <div style="display:flex;align-items:center;margin:4mm 0 2mm 0;page-break-inside:avoid;">
      <div style="width:3mm;height:6mm;background:#f59e0b;border-radius:0.5mm;margin-right:2mm;flex-shrink:0;"></div>
      <span style="font-size:12pt;font-weight:bold;color:#1e1e1e;">${escapeHtml(title)}</span>
    </div>`;
}

function buildKeyValueGrid(items: { key: string; value: string }[]): string {
  let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1mm 4mm;margin:0 1mm;font-size:9pt;">';
  for (const item of items) {
    html += `
      <div style="display:flex;gap:2mm;min-height:5mm;align-items:baseline;">
        <span style="color:#646464;white-space:nowrap;">${escapeHtml(item.key)}</span>
        <span style="color:#1e1e1e;word-break:break-word;">${escapeHtml(item.value || "-")}</span>
      </div>`;
  }
  html += '</div>';
  return html;
}

function buildPhotoGrid(photos: { src: string; label: string }[]): string {
  let html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;margin:2mm 0;">';
  for (const photo of photos) {
    html += `
      <div style="page-break-inside:avoid;text-align:center;">
        <div style="width:100%;aspect-ratio:1;border:0.3mm solid #dcdcdc;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fafafa;">
          ${photo.src
            ? `<img src="${photo.src}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
            : `<span style="color:#b4b4b4;font-size:8pt;">โหลดรูปไม่ได้</span>`
          }
        </div>
        <div style="font-size:6.5pt;color:#646464;margin-top:1mm;line-height:1.3;max-height:8mm;overflow:hidden;">${escapeHtml(photo.label)}</div>
      </div>`;
  }
  html += '</div>';
  return html;
}

function buildFooter(companyName: string): string {
  return `
    <div style="position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:7pt;color:#b4b4b4;padding:2mm 0;font-family:'Sarabun',sans-serif;">
      ${escapeHtml(companyName)}
    </div>`;
}

// ==================== GLOBAL STYLES ====================
function getGlobalStyles(): string {
  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body, html { font-family: 'Sarabun', sans-serif; font-size: 9pt; line-height: 1.4; color: #1e1e1e; }
    </style>`;
}

// ==================== PDF GENERATION ====================
async function generatePdfFromHtml(
  htmlContent: string,
  filename: string,
  onProgress?: (step: string) => void,
): Promise<void> {
  onProgress?.("กำลังสร้าง PDF...");

  // Create a hidden container with exact A4 dimensions
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.fontFamily = "'Sarabun', sans-serif";
  container.style.fontSize = "9pt";
  container.style.lineHeight = "1.4";
  container.style.color = "#1e1e1e";
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  // Wait for fonts and images to load
  await document.fonts.ready;
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const worker = html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        filename,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: container.scrollWidth,
          windowWidth: container.scrollWidth,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },

      })
      .from(container);

    onProgress?.("กำลังบันทึกไฟล์...");
    await worker.save();
  } finally {
    document.body.removeChild(container);
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

  const headerColor = "#f59e0b"; // amber-500
  const footerCompanyName = companyInfo?.companyName || "Solar Survey Management System";
  const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Load logo
  const logoBase64 = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);

  // Load photos
  onProgress?.(`กำลังโหลดรูปภาพ (${photos.length} รูป)...`);
  const photoDataList: { src: string; label: string }[] = [];
  for (let i = 0; i < photos.length; i++) {
    onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${photos.length}...`);
    const imgData = await loadImageAsBase64(photos[i].url, imageProxyFn);
    const label = categoryMap[photos[i].category || "other"] || photos[i].category || "อื่นๆ";
    photoDataList.push({ src: imgData || "", label });
  }

  // Build HTML content
  let html = getGlobalStyles();

  // Header
  html += buildHeaderHtml(
    footerCompanyName, customer.name, survey.id,
    headerColor, "รายงานการสำรวจ Solar",
    companyInfo, logoBase64, undefined, `พิมพ์เมื่อ: ${now}`
  );

  // Content area with padding
  html += '<div style="padding:4mm 4mm 8mm 4mm;">';

  // Status
  const statusLabel = STATUS_LABELS[survey.status] || survey.status;
  html += `<div style="font-size:9pt;color:#646464;margin-bottom:4mm;">
    สถานะ: <span style="color:#1e1e1e;">${escapeHtml(statusLabel)}</span>`;
  if (survey.scheduledDate) {
    html += `  |  วันนัดสำรวจ: <span style="color:#1e1e1e;">${formatDate(survey.scheduledDate)}</span>`;
  }
  html += '</div>';

  // Customer info
  html += buildSectionHeader("ข้อมูลลูกค้า");
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
  html += buildKeyValueGrid(customerItems);

  // Technical info
  html += '<div style="margin-top:4mm;"></div>';
  html += buildSectionHeader("ข้อมูลทางเทคนิค");
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
    html += buildKeyValueGrid(techItems);
  } else {
    html += '<div style="color:#969696;font-size:9pt;margin:1mm 0;">ยังไม่มีข้อมูลเทคนิค</div>';
  }

  // Survey notes
  if (survey.surveyNotes) {
    html += `<div style="margin-top:3mm;font-size:9pt;">
      <span style="color:#646464;">หมายเหตุสำรวจ:</span>
      <div style="color:#1e1e1e;margin-top:1mm;white-space:pre-wrap;padding-left:2mm;">${escapeHtml(survey.surveyNotes)}</div>
    </div>`;
  }

  // Photos
  if (photoDataList.length > 0) {
    html += '<div style="margin-top:4mm;"></div>';
    html += buildSectionHeader(`รูปภาพหน้างาน (${photos.length} รูป)`);
    html += buildPhotoGrid(photoDataList);
  }

  html += '</div>'; // End content area

  // Footer
  html += buildFooter(footerCompanyName);

  // Generate PDF
  await generatePdfFromHtml(html, `สำรวจ-${customer.name}-${survey.id}.pdf`, onProgress);
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

  const headerColor = "#10b981"; // emerald-500
  const footerCompanyName = companyInfo?.companyName || "Solar Survey Management System";
  const now = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Load logo
  const logoBase64 = await loadLogoBase64(imageProxyFn, companyInfo?.logoUrl);

  // Load photos
  onProgress?.(`กำลังโหลดรูปภาพ (${installPhotos.length} รูป)...`);
  const photoDataList: { src: string; label: string }[] = [];
  for (let i = 0; i < installPhotos.length; i++) {
    onProgress?.(`กำลังโหลดรูปภาพ ${i + 1}/${installPhotos.length}...`);
    const imgData = await loadImageAsBase64(installPhotos[i].url, imageProxyFn);
    const label = categoryMap[installPhotos[i].category || "other"] || installPhotos[i].category || "อื่นๆ";
    photoDataList.push({ src: imgData || "", label });
  }

  // Build HTML content
  let html = getGlobalStyles();

  // Header
  html += buildHeaderHtml(
    footerCompanyName, customer.name, survey.id,
    headerColor, "รายงานส่งมอบงานติดตั้ง Solar",
    companyInfo, logoBase64, undefined, `พิมพ์เมื่อ: ${now}`
  );

  // Content area
  html += '<div style="padding:4mm 4mm 8mm 4mm;">';

  // Installation status
  const installLabel = survey.installationStatus ? (INSTALLATION_STATUS_LABELS[survey.installationStatus] || survey.installationStatus) : "-";
  html += `<div style="font-size:9pt;color:#646464;margin-bottom:4mm;">
    สถานะติดตั้ง: <span style="color:#1e1e1e;">${escapeHtml(installLabel)}</span>`;
  if (survey.installationDate) {
    html += `  |  วันติดตั้ง: <span style="color:#1e1e1e;">${formatDate(survey.installationDate)}</span>`;
  }
  html += '</div>';

  // Customer info
  html += buildSectionHeader("ข้อมูลลูกค้า");
  const customerItems: { key: string; value: string }[] = [
    { key: "ชื่อ:", value: customer.name },
    { key: "โทรศัพท์:", value: customer.phone || "-" },
  ];
  if (customer.fullAddress) customerItems.push({ key: "ที่อยู่:", value: customer.fullAddress });
  if (customer.subDistrict || customer.district || customer.province) {
    customerItems.push({ key: "พื้นที่:", value: [customer.subDistrict, customer.district, customer.province, customer.postalCode].filter(Boolean).join(", ") });
  }
  html += buildKeyValueGrid(customerItems);

  // Technical summary
  html += '<div style="margin-top:4mm;"></div>';
  html += buildSectionHeader("ข้อมูลระบบที่ติดตั้ง");
  const techItems: { key: string; value: string }[] = [];
  if (survey.systemSize) techItems.push({ key: "ขนาดระบบ:", value: `${survey.systemSize} kW` });
  if (survey.panelCount) techItems.push({ key: "จำนวนแผง:", value: `${survey.panelCount} แผง` });
  if (survey.panelBrand) techItems.push({ key: "ยี่ห้อแผง:", value: survey.panelBrand });
  if (survey.inverterModel) techItems.push({ key: "อินเวอร์เตอร์:", value: survey.inverterModel });
  if (survey.systemType) techItems.push({ key: "ประเภทระบบ:", value: SYSTEM_TYPE_LABELS[survey.systemType] || survey.systemType });
  if (techItems.length > 0) {
    html += buildKeyValueGrid(techItems);
  }

  // Delivery info
  if (deliveryInfo) {
    html += '<div style="margin-top:4mm;"></div>';
    html += buildSectionHeader("ข้อมูลส่งมอบงาน");
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
      html += buildKeyValueGrid(delItems);
    }
  }

  // Installation photos
  if (photoDataList.length > 0) {
    html += '<div style="margin-top:4mm;"></div>';
    html += buildSectionHeader(`รูปภาพการติดตั้ง (${installPhotos.length} รูป)`);
    html += buildPhotoGrid(photoDataList);
  }

  // Completion note
  if (survey.completedAt) {
    html += `
      <div style="margin-top:4mm;background:#f0fdf4;padding:3mm 4mm;border-radius:1mm;page-break-inside:avoid;">
        <div style="font-size:10pt;color:#16a34a;font-weight:bold;">✓ ติดตั้งเสร็จสิ้น</div>
        <div style="font-size:8pt;color:#16a34a;margin-top:1mm;">วันที่เสร็จ: ${formatDate(survey.completedAt)}</div>
      </div>`;
  }

  html += '</div>'; // End content area

  // Footer
  html += buildFooter(footerCompanyName);

  // Generate PDF
  await generatePdfFromHtml(html, `ติดตั้ง-${customer.name}-${survey.id}.pdf`, onProgress);
}
