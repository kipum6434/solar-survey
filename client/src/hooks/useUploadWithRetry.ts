import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Upload status for each file being uploaded.
 */
export type UploadFileStatus = {
  fileName: string;
  status: "pending" | "compressing" | "uploading" | "retrying" | "success" | "failed";
  attempt: number;
  maxAttempts: number;
  error?: string;
};

export type UploadQueueState = {
  /** All files in the current upload batch */
  files: UploadFileStatus[];
  /** Whether any upload is in progress */
  isUploading: boolean;
  /** Summary: how many succeeded */
  successCount: number;
  /** Summary: how many failed after all retries */
  failedCount: number;
  /** Summary: total files in batch */
  totalCount: number;
  /** Whether there are failed files that can be retried manually */
  hasFailedFiles: boolean;
};

type UploadFn = (item: { base64: string; fileName: string; originalFile?: File }) => Promise<void>;

const INITIAL_STATE: UploadQueueState = {
  files: [],
  isUploading: false,
  successCount: 0,
  failedCount: 0,
  totalCount: 0,
  hasFailedFiles: false,
};

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // 1s, 3s, 5s

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hook that provides upload-with-retry functionality.
 * 
 * Usage:
 * ```ts
 * const { state, uploadFiles, retryFailed, clearState } = useUploadWithRetry();
 * 
 * // In your upload handler:
 * await uploadFiles(compressedFiles, async (item) => {
 *   await mutation.mutateAsync({ ... });
 * });
 * ```
 */
export function useUploadWithRetry() {
  const [state, setState] = useState<UploadQueueState>(INITIAL_STATE);
  const isUploadingRef = useRef(false);
  const failedItemsRef = useRef<Array<{ base64: string; fileName: string; originalFile?: File; uploadFn: UploadFn }>>([]);

  // Beforeunload warning when uploading
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isUploadingRef.current) {
        e.preventDefault();
        e.returnValue = "มีรูปกำลังอัพโหลดอยู่ คุณแน่ใจว่าจะปิดหน้านี้?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const updateFileStatus = useCallback((fileName: string, updates: Partial<UploadFileStatus>) => {
    setState((prev) => {
      const files = prev.files.map((f) =>
        f.fileName === fileName ? { ...f, ...updates } : f
      );
      const successCount = files.filter((f) => f.status === "success").length;
      const failedCount = files.filter((f) => f.status === "failed").length;
      return {
        ...prev,
        files,
        successCount,
        failedCount,
        hasFailedFiles: failedCount > 0,
        isUploading: files.some((f) => ["pending", "compressing", "uploading", "retrying"].includes(f.status)),
      };
    });
  }, []);

  /**
   * Upload a single file with retry logic.
   */
  const uploadSingleWithRetry = useCallback(
    async (
      item: { base64: string; fileName: string; originalFile?: File },
      uploadFn: UploadFn
    ): Promise<boolean> => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          updateFileStatus(item.fileName, {
            status: attempt === 1 ? "uploading" : "retrying",
            attempt,
          });
          await uploadFn(item);
          updateFileStatus(item.fileName, { status: "success", attempt });
          return true;
        } catch (err: any) {
          const isLastAttempt = attempt === MAX_RETRIES;
          if (isLastAttempt) {
            updateFileStatus(item.fileName, {
              status: "failed",
              attempt,
              error: err?.message || "อัพโหลดล้มเหลว",
            });
            // Save for manual retry
            failedItemsRef.current.push({ ...item, uploadFn });
            return false;
          }
          // Wait before retrying
          updateFileStatus(item.fileName, {
            status: "retrying",
            attempt,
            error: `ลองใหม่ครั้งที่ ${attempt + 1}...`,
          });
          await delay(RETRY_DELAYS[attempt - 1] || 3000);
        }
      }
      return false;
    },
    [updateFileStatus]
  );

  /**
   * Upload multiple files with retry. Processes in chunks of 3.
   */
  const uploadFiles = useCallback(
    async (
      items: Array<{ base64: string; fileName: string; originalFile?: File }>,
      uploadFn: UploadFn
    ): Promise<{ successCount: number; failedCount: number }> => {
      isUploadingRef.current = true;
      failedItemsRef.current = [];

      // Initialize file statuses
      const fileStatuses: UploadFileStatus[] = items.map((item) => ({
        fileName: item.fileName,
        status: "pending" as const,
        attempt: 0,
        maxAttempts: MAX_RETRIES,
      }));

      setState({
        files: fileStatuses,
        isUploading: true,
        successCount: 0,
        failedCount: 0,
        totalCount: items.length,
        hasFailedFiles: false,
      });

      let successCount = 0;
      let failedCount = 0;

      // Process in chunks of 3
      const CHUNK = 3;
      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        const results = await Promise.all(
          chunk.map((item) => uploadSingleWithRetry(item, uploadFn))
        );
        results.forEach((ok) => {
          if (ok) successCount++;
          else failedCount++;
        });
      }

      isUploadingRef.current = false;
      setState((prev) => ({
        ...prev,
        isUploading: false,
        successCount,
        failedCount,
        hasFailedFiles: failedCount > 0,
      }));

      return { successCount, failedCount };
    },
    [uploadSingleWithRetry]
  );

  /**
   * Retry all failed files.
   */
  const retryFailed = useCallback(async (): Promise<{ successCount: number; failedCount: number }> => {
    const failedItems = [...failedItemsRef.current];
    if (failedItems.length === 0) return { successCount: 0, failedCount: 0 };

    isUploadingRef.current = true;
    failedItemsRef.current = [];

    // Reset failed file statuses
    setState((prev) => ({
      ...prev,
      isUploading: true,
      files: prev.files.map((f) =>
        f.status === "failed" ? { ...f, status: "pending" as const, attempt: 0, error: undefined } : f
      ),
      hasFailedFiles: false,
    }));

    let successCount = 0;
    let failedCount = 0;

    const CHUNK = 3;
    for (let i = 0; i < failedItems.length; i += CHUNK) {
      const chunk = failedItems.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map((item) => uploadSingleWithRetry(item, item.uploadFn))
      );
      results.forEach((ok) => {
        if (ok) successCount++;
        else failedCount++;
      });
    }

    isUploadingRef.current = false;
    setState((prev) => ({
      ...prev,
      isUploading: false,
      hasFailedFiles: failedCount > 0,
    }));

    return { successCount, failedCount };
  }, [uploadSingleWithRetry]);

  /**
   * Clear the upload state (dismiss the status bar).
   */
  const clearState = useCallback(() => {
    failedItemsRef.current = [];
    setState(INITIAL_STATE);
  }, []);

  return { state, uploadFiles, retryFailed, clearState };
}
