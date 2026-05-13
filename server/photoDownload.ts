import { Express, Request, Response } from "express";
import JSZip from "jszip";
import { getSurveyPhotos } from "./db";
// Default category map (same as client/src/lib/constants.ts)
const DEFAULT_CATEGORY_MAP: Record<string, string> = {
  roof_overview: "ภาพรวมหลังคา",
  roof_detail: "รายละเอียดหลังคา",
  electrical_panel: "ตู้ไฟ",
  meter: "มิเตอร์",
  inverter_location: "ตำแหน่งอินเวอร์เตอร์",
  surroundings: "บริเวณรอบบ้าน",
  other: "อื่นๆ",
};

// Fetch photo categories from DB for label mapping
async function getCategoryLabels(): Promise<Record<string, string>> {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return { ...DEFAULT_CATEGORY_MAP };
  
  const { photoCategories } = await import("../drizzle/schema");
  const cats = await db.select().from(photoCategories);
  const map: Record<string, string> = { ...DEFAULT_CATEGORY_MAP };
  for (const cat of cats) {
    map[cat.key] = cat.label;
  }
  return map;
}

function sanitize(s: string): string {
  return s.replace(/[\/:\\*\\?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

export function registerPhotoDownloadRoutes(app: Express) {
  // Server-side ZIP generation for photo downloads
  app.get("/api/photos/download-zip/:surveyId", async (req: Request, res: Response) => {
    try {
      const surveyId = parseInt(req.params.surveyId);
      if (isNaN(surveyId)) {
        res.status(400).json({ error: "Invalid surveyId" });
        return;
      }

      const customerName = req.query.customerName as string || "photos";
      const photos = await getSurveyPhotos(surveyId);
      
      if (!photos || photos.length === 0) {
        res.status(404).json({ error: "No photos found" });
        return;
      }

      const categoryMap = await getCategoryLabels();
      const zip = new JSZip();
      const rootFolderName = sanitize(`photos-${customerName}`);
      const rootFolder = zip.folder(rootFolderName)!;
      const catCounters: Record<string, number> = {};
      let successCount = 0;

      // Fetch all photos server-side (no CORS issues)
      for (const photo of photos) {
        try {
          const resp = await fetch(photo.url, { 
            signal: AbortSignal.timeout(30000) // 30s timeout per photo
          });
          if (!resp.ok) {
            console.warn(`[PhotoDownload] Failed to fetch photo ${photo.id}: HTTP ${resp.status}`);
            continue;
          }
          const buffer = Buffer.from(await resp.arrayBuffer());
          const ext = photo.fileName?.split('.').pop() || 'jpg';
          const catLabel = sanitize(categoryMap[photo.category || 'other'] || photo.category || 'other');
          
          if (!catCounters[catLabel]) catCounters[catLabel] = 0;
          catCounters[catLabel]++;
          
          const catFolder = rootFolder.folder(catLabel)!;
          catFolder.file(`${catLabel}_${catCounters[catLabel]}.${ext}`, buffer);
          successCount++;
        } catch (err: any) {
          console.warn(`[PhotoDownload] Error fetching photo ${photo.id}: ${err.message}`);
          // Retry once
          try {
            const resp = await fetch(photo.url, { 
              signal: AbortSignal.timeout(30000)
            });
            if (resp.ok) {
              const buffer = Buffer.from(await resp.arrayBuffer());
              const ext = photo.fileName?.split('.').pop() || 'jpg';
              const catLabel = sanitize(categoryMap[photo.category || 'other'] || photo.category || 'other');
              if (!catCounters[catLabel]) catCounters[catLabel] = 0;
              catCounters[catLabel]++;
              const catFolder = rootFolder.folder(catLabel)!;
              catFolder.file(`${catLabel}_${catCounters[catLabel]}.${ext}`, buffer);
              successCount++;
            }
          } catch (retryErr) {
            console.warn(`[PhotoDownload] Retry also failed for photo ${photo.id}`);
          }
        }
      }

      if (successCount === 0) {
        res.status(500).json({ error: "Failed to download any photos" });
        return;
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
      
      const fileName = encodeURIComponent(`photos-${sanitize(customerName)}-${new Date().toISOString().slice(0, 10)}.zip`);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
      res.setHeader("Content-Length", zipBuffer.length.toString());
      res.setHeader("X-Photos-Success", successCount.toString());
      res.setHeader("X-Photos-Total", photos.length.toString());
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("[PhotoDownload] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
