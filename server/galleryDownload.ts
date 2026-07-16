import { Express, Request, Response } from "express";
import JSZip from "jszip";
import { getAlbumPhotosForZip, getInstallationPhotoCategories } from "./db";

/**
 * Server-side Gallery ZIP download endpoint.
 * Downloads all installation photos for a survey from S3 server-side,
 * avoiding browser CORS/timeout issues that cause 1 photo to consistently fail.
 * 
 * Features:
 * - Retry up to 5 times per photo with exponential backoff
 * - 60 second timeout per fetch attempt
 * - Parallel download (10 at a time)
 * - Reports success/total in response headers
 */

/**
 * Fetch a single photo URL with retry logic.
 * Returns Buffer on success, null on failure.
 */
async function fetchWithRetry(url: string, maxRetries = 5): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(60000), // 60s timeout
      });
      if (resp.ok) {
        return Buffer.from(await resp.arrayBuffer());
      }
      // 4xx errors (except 429) - don't retry
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        console.warn(`[GalleryDownload] HTTP ${resp.status} for: ${url.slice(0, 100)}...`);
        return null;
      }
      // 5xx or 429 - retry
      console.warn(`[GalleryDownload] HTTP ${resp.status} (attempt ${attempt}/${maxRetries}) for: ${url.slice(0, 100)}...`);
    } catch (err: any) {
      console.warn(`[GalleryDownload] Fetch error (attempt ${attempt}/${maxRetries}): ${err.message} for: ${url.slice(0, 100)}...`);
    }
    if (attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  return null;
}

/**
 * Process photos in parallel batches.
 */
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

export function registerGalleryDownloadRoutes(app: Express) {
  // Server-side ZIP generation for gallery (installation photos) downloads
  app.get("/api/gallery/download-zip/:surveyId", async (req: Request, res: Response) => {
    try {
      const surveyId = parseInt(req.params.surveyId);
      if (isNaN(surveyId)) {
        res.status(400).json({ error: "Invalid surveyId" });
        return;
      }

      const photos = await getAlbumPhotosForZip(surveyId);

      if (!photos || photos.length === 0) {
        res.status(404).json({ error: "No photos found" });
        return;
      }

      // Get category labels for folder naming
      const categories = await getInstallationPhotoCategories();
      const categoryLabelMap: Record<string, string> = {};
      for (const cat of categories) {
        // Use key as folder name (sanitized)
        categoryLabelMap[cat.key] = cat.label;
      }

      const zip = new JSZip();
      const catCounters: Record<string, number> = {};
      let successCount = 0;
      const failedPhotos: { id: number; url: string }[] = [];

      // Process photos in parallel batches of 10
      const BATCH_SIZE = 10;
      
      await processInBatches(photos, BATCH_SIZE, async (photo) => {
        const buffer = await fetchWithRetry(photo.url);
        if (buffer) {
          const catKey = photo.category || "other";
          // Create a safe folder name from category label
          const catLabel = categoryLabelMap[catKey] || catKey;
          // Sanitize folder name: replace problematic chars
          const safeFolder = catLabel.replace(/[\/\\:*?"<>|]/g, "_").slice(0, 50);
          
          if (!catCounters[safeFolder]) catCounters[safeFolder] = 0;
          catCounters[safeFolder]++;
          
          const ext = (photo.fileName || "photo.jpg").split(".").pop()?.toLowerCase() || "jpg";
          const fileNum = String(catCounters[safeFolder]).padStart(3, "0");
          const fileName = `${safeFolder}/${fileNum}.${ext}`;
          
          zip.file(fileName, buffer);
          successCount++;
        } else {
          failedPhotos.push({ id: photo.id, url: photo.url });
        }
      });

      if (successCount === 0) {
        res.status(500).json({ error: "Failed to download any photos" });
        return;
      }

      // Log failed photos for debugging
      if (failedPhotos.length > 0) {
        console.warn(`[GalleryDownload] Survey ${surveyId}: ${failedPhotos.length} photos failed:`);
        for (const fp of failedPhotos) {
          console.warn(`  - Photo ID ${fp.id}: ${fp.url.slice(0, 120)}`);
        }
      }

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeFileName = `installation-photos-${surveyId}-${dateStr}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
      res.setHeader("Content-Length", zipBuffer.length.toString());
      res.setHeader("X-Photos-Success", successCount.toString());
      res.setHeader("X-Photos-Total", photos.length.toString());
      res.setHeader("X-Photos-Failed", failedPhotos.length.toString());
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("[GalleryDownload] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
