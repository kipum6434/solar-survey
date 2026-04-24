/**
 * Client-side image compression using Canvas API
 * Resizes images to max dimension and compresses as JPEG
 * to reduce file size before uploading to S3
 */

const MAX_DIMENSION = 1920; // Max width or height in pixels
const JPEG_QUALITY = 0.8; // JPEG quality (0-1)
const COMPRESSION_THRESHOLD = 500 * 1024; // Only compress files > 500KB

/**
 * Compress an image file using Canvas API
 * Returns a base64 string (without data URL prefix) and the new filename
 * If the file is small enough or not an image, returns the original as base64
 */
export async function compressImage(file: File): Promise<{ base64: string; fileName: string }> {
  // Skip non-image files
  if (!file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve({ base64, fileName: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Skip small files (already small enough)
  if (file.size <= COMPRESSION_THRESHOLD) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve({ base64, fileName: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      // Draw to canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG base64
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];

      // Change extension to .jpg
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
      const fileName = `${nameWithoutExt}.jpg`;

      resolve({ base64, fileName });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: return original file as base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve({ base64, fileName: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = url;
  });
}
