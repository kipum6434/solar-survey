# PDF Refactor Analysis Notes

## Problem Summary
- Channel 1 (public handover /handover/:token) PDF: Missing company header, photos don't load, surveyId=0, page shows 1/1
- Channel 2 (admin /delivery-forms/:id) PDF: Has company info, photos, full data - but layout needs polish

## Root Cause
The `getByHandoverToken` API (server/routers.ts line 2903-2956):
- Already fetches `companySettings` (line 2931) but only returns `disclaimerText` from it
- Does NOT return: companyName, phone, address, logoUrl, photoBorderColor, surveyId
- `customerAddress` only returns `fullAddress || address` (not combined with district/province)

## Fix Plan

### 1. Fix getByHandoverToken API (server/routers.ts ~line 2932-2955)
Add to return object:
- `surveyId: form.surveyId` (currently missing → shows as 0)
- `companyName: settings?.companyName || null`
- `companyPhone: settings?.phone || null`  
- `companyAddress: settings?.address || null`
- `companyLogoUrl: settings?.logoUrl || null`
- `photoBorderColor: settings?.photoBorderColor || null`
- Build full address: combine customer.fullAddress || customer.address + district + subDistrict + province

### 2. Fix HandoverSign.tsx (client/src/pages/HandoverSign.tsx)
- Build `companyInfo` from the new fields in data
- Pass `surveyId: data.surveyId` instead of 0
- Use server-side image proxy via `trpc.util.proxyImage` mutation for CORS

### 3. Key Files
- `server/routers.ts` line 2903-2956: getByHandoverToken
- `client/src/pages/HandoverSign.tsx` line 40-93: handleDownloadPdf
- `client/src/lib/pdfExport.ts` line 865-1177: exportDeliveryPDF (already good, just needs correct data)

### 4. companySettings schema fields
- companyName, phone, address, logoUrl, logoFileKey, photoBorderColor, disclaimerText

### 5. Customer schema relevant fields
- name, phone, address, fullAddress, subDistrict, district, province, postalCode, roofType, phaseType
