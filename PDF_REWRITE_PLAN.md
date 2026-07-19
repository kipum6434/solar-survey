# PDF Rewrite Plan - Delivery/Handover PDF

## Strategy
Create `exportDeliveryPDF` function in `client/src/lib/pdfExport.ts` that reuses existing helpers:
- `ensureFontsRegistered()` - registers Sarabun font (with italics)
- `loadLogoBase64(proxyFn, logoUrl)` - loads company logo
- `buildHeader(config, currentPage, pageCount)` - company header bar
- `buildSectionHeader(title, color)` - section headers with colored left bar
- `buildKeyValueGrid(items)` - key-value pairs in 2-column grid
- `buildPhotoGrid(photos, borderColor)` - photos in 3-column grid with borders
- `loadImageWithDimensions(url, proxyFn)` - loads image with dimensions
- `loadImageAsBase64(url, proxyFn)` - loads image as base64

## Header Color
Use `#2563eb` (blue-600) for delivery PDF to differentiate from survey (amber) and installation (emerald).

## Sections (in order, matching HandoverSign.tsx web page):
1. Customer Info (name, phone, address, roofType, phaseType)
2. Technical Info (systemSize, panelCount, panelBrand, inverterModel)
3. Installation Photos (selected photos in grid)
4. Checklist (grouped by template name using templateNameMap)
5. Custom Sections (title + content)
6. Notes
7. Disclaimer Text
8. Signatures (customer + technician with names and date)

## Interface for the new function:
```ts
interface DeliveryPDFData {
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
```

## Files to Update After Creating exportDeliveryPDF:
1. `client/src/components/DeliveryFormSection.tsx` - Replace inline PDF with call to exportDeliveryPDF
2. `client/src/pages/DeliveryFormDetail.tsx` - Replace inline PDF with call to exportDeliveryPDF
3. `client/src/pages/HandoverSign.tsx` - Replace inline PDF with call to exportDeliveryPDF

## Key Pattern from exportInstallationPDF (lines 684-862):
- Uses `pdfMake.createPdf(docDefinition)` then `await pdfDoc.download(filename)`
- pageMargins: [15, 100, 15, 35] (top 100 for header)
- header function returns buildHeader(...)
- footer function returns centered text
- content array built incrementally with push

## Important: pdfmake v0.3.7 API
- `pdfDoc.download(filename)` works (Promise-based)
- `pdfDoc.getBlob()` also works (Promise-based)
- Font italics MUST be registered (using Regular as fallback)
