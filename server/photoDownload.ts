import { Express, Request, Response } from "express";
import JSZip from "jszip";
import { getSurveyPhotos } from "./db";

/**
 * Map Thai category keys (from DB) to ASCII-safe English folder names.
 * This prevents Windows ZIP extraction errors with Thai characters.
 */
const CATEGORY_FOLDER_MAP: Record<string, string> = {
  "รูปหน้าบ้าน_อาคาร_ถ่ายไกลให้เห็นทั้งหลัง": "01-house-front",
  "ทางเข้า_ดูว่ารถเครน_ขนของเข้าได้ไหม": "02-entrance",
  "หลังคามุมกว้าง_ภาพโดรน": "03-roof-wide-drone",
  "หลังคาซูมใกล้_วัสดุ_โครงสร้าง": "04-roof-zoom-material",
  "มิเตอร์ไฟฟ้า": "05-meter",
  "บิลค่าไฟ": "06-electric-bill",
  "ตู้ไฟ_เปิดฝา": "07-mdb-panel",
  "จุดติดตั้ง_inverter": "08-inverter-location",
  "รูปบริเวณโดยรอบ_ซ้าย_ขวา_หน้า_หลัง": "09-surroundings",
  "เส้นทางเดินสาย_บนล่าง_ผนังเจาะ": "10-cable-route",
  "จุดอันตราย_อุปสรรค": "11-danger-obstacles",
  "อื่นๆ": "12-other",
};

/**
 * Get a safe ASCII folder name for a category key.
 * Falls back to a numbered generic name if key is not in the map.
 */
function getCategoryFolder(key: string, fallbackIndex: number): string {
  if (CATEGORY_FOLDER_MAP[key]) {
    return CATEGORY_FOLDER_MAP[key];
  }
  // Fallback: use a numbered folder with only ASCII-safe chars from the key
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
  return safe ? `${String(fallbackIndex).padStart(2, '0')}-${safe}` : `${String(fallbackIndex).padStart(2, '0')}-category`;
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

      const photos = await getSurveyPhotos(surveyId);
      
      if (!photos || photos.length === 0) {
        res.status(404).json({ error: "No photos found" });
        return;
      }

      const zip = new JSZip();
      // Use ASCII-safe root folder name
      const rootFolderName = `survey-${surveyId}`;
      const rootFolder = zip.folder(rootFolderName)!;
      
      // Track counters per category folder
      const catCounters: Record<string, number> = {};
      // Track unique categories for fallback index
      const seenCategories: string[] = [];
      let successCount = 0;

      // Fetch all photos server-side
      for (const photo of photos) {
        try {
          const resp = await fetch(photo.url, { 
            signal: AbortSignal.timeout(30000)
          });
          if (!resp.ok) {
            console.warn(`[PhotoDownload] Failed to fetch photo ${photo.id}: HTTP ${resp.status}`);
            continue;
          }
          const buffer = Buffer.from(await resp.arrayBuffer());
          const ext = photo.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
          const catKey = photo.category || 'อื่นๆ';
          
          // Get fallback index
          if (!seenCategories.includes(catKey)) {
            seenCategories.push(catKey);
          }
          const fallbackIdx = seenCategories.indexOf(catKey) + 1;
          const folderName = getCategoryFolder(catKey, fallbackIdx);
          
          if (!catCounters[folderName]) catCounters[folderName] = 0;
          catCounters[folderName]++;
          
          const catFolder = rootFolder.folder(folderName)!;
          const fileNum = String(catCounters[folderName]).padStart(3, '0');
          catFolder.file(`photo_${fileNum}.${ext}`, buffer);
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
              const ext = photo.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
              const catKey = photo.category || 'อื่นๆ';
              if (!seenCategories.includes(catKey)) {
                seenCategories.push(catKey);
              }
              const fallbackIdx = seenCategories.indexOf(catKey) + 1;
              const folderName = getCategoryFolder(catKey, fallbackIdx);
              if (!catCounters[folderName]) catCounters[folderName] = 0;
              catCounters[folderName]++;
              const catFolder = rootFolder.folder(folderName)!;
              const fileNum = String(catCounters[folderName]).padStart(3, '0');
              catFolder.file(`photo_${fileNum}.${ext}`, buffer);
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

      const zipBuffer = await zip.generateAsync({ 
        type: "nodebuffer", 
        compression: "DEFLATE", 
        compressionOptions: { level: 6 } 
      });
      
      // Use ASCII-safe filename for the ZIP download
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeFileName = `photos-survey-${surveyId}-${dateStr}.zip`;
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
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
