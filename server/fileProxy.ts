/**
 * File download proxy endpoint.
 * Solves the issue where files with Thai/special characters in their names
 * get 403 Access Denied from CloudFront because the browser sends unencoded
 * Unicode characters but S3 expects percent-encoded paths.
 *
 * The server properly encodes the URL path before fetching from CloudFront.
 *
 * Endpoints:
 *   /api/files/download?type=photo&id=123
 *   /api/files/download?type=document&id=456
 */
import type { Express, Request, Response } from "express";

/**
 * Properly encode a CloudFront/S3 URL that may contain unencoded Unicode characters.
 * Splits the pathname into segments, encodes each, and reconstructs the URL.
 */
function encodeStorageUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl);
    const encodedPath = urlObj.pathname
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");
    return urlObj.origin + encodedPath + urlObj.search;
  } catch {
    return rawUrl;
  }
}

export function registerFileProxyRoutes(app: Express) {
  app.get("/api/files/download", async (req: Request, res: Response) => {
    try {
      const { type, id } = req.query;

      if (!type || !id) {
        return res.status(400).json({ error: "Missing type or id parameter" });
      }

      const numId = parseInt(id as string);
      if (isNaN(numId)) {
        return res.status(400).json({ error: "Invalid id" });
      }

      // Dynamic import to avoid circular dependencies
      const db = await import("./db");

      let fileUrl: string | null | undefined;
      let fileKey: string | null | undefined;
      let fileName: string | null | undefined;
      let mimeType: string = "application/octet-stream";

      if (type === "photo") {
        const photo = await db.getSurveyPhotoById(numId);
        if (!photo) return res.status(404).json({ error: "Photo not found" });
        fileUrl = photo.url;
        fileKey = photo.fileKey;
        fileName = photo.fileName;
        mimeType = "image/jpeg";
      } else if (type === "document") {
        const doc = await db.getSurveyDocumentById(numId);
        if (!doc) return res.status(404).json({ error: "Document not found" });
        fileUrl = doc.url;
        fileKey = doc.fileKey;
        fileName = doc.fileName;
        mimeType = doc.mimeType || "application/pdf";
      } else {
        return res.status(400).json({ error: "Invalid type. Use 'photo' or 'document'" });
      }

      if (!fileUrl && !fileKey) {
        return res.status(404).json({ error: "File URL not found" });
      }

      // Try to get a fresh URL from storage API first
      let downloadUrl = fileUrl || "";
      if (fileKey) {
        try {
          const { storageGet } = await import("./storage");
          const result = await storageGet(fileKey);
          downloadUrl = result.url;
        } catch {
          // Fall back to stored URL
        }
      }

      // Properly encode the URL path for CloudFront/S3
      const encodedUrl = encodeStorageUrl(downloadUrl);

      const s3Response = await fetch(encodedUrl);

      if (!s3Response.ok) {
        console.error(`[FileProxy] Failed to fetch: ${s3Response.status} ${s3Response.statusText}`);
        return res.status(502).json({ error: "Failed to fetch file from storage" });
      }

      // Clean filename for Content-Disposition (remove timestamp prefix)
      const cleanName = (fileName || "file").replace(/^\d+-/, "");
      const encodedName = encodeURIComponent(cleanName);

      res.setHeader("Content-Type", s3Response.headers.get("content-type") || mimeType);
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodedName}`);
      if (s3Response.headers.get("content-length")) {
        res.setHeader("Content-Length", s3Response.headers.get("content-length")!);
      }
      // Allow cross-origin access for preview
      res.setHeader("Cache-Control", "private, max-age=3600");

      // Stream the response body
      if (s3Response.body) {
        const reader = s3Response.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        return pump();
      }

      res.status(502).json({ error: "No response body" });
    } catch (error: any) {
      console.error("[FileProxy] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
