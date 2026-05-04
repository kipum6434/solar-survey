import { CheckCircle2, XCircle, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadQueueState } from "@/hooks/useUploadWithRetry";

type Props = {
  state: UploadQueueState;
  onRetry: () => void;
  onDismiss: () => void;
};

export function UploadStatusBar({ state, onRetry, onDismiss }: Props) {
  if (state.totalCount === 0) return null;

  const { files, isUploading, successCount, failedCount, totalCount, hasFailedFiles } = state;
  const progressPercent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  // Count current statuses
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const retryingCount = files.filter((f) => f.status === "retrying").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;

  // Determine overall status message
  let statusMessage = "";
  let statusIcon = null;

  if (isUploading) {
    if (retryingCount > 0) {
      statusMessage = `กำลังลองอัพโหลดใหม่... (${retryingCount} ไฟล์)`;
      statusIcon = <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />;
    } else if (uploadingCount > 0) {
      statusMessage = `กำลังอัพโหลด ${successCount}/${totalCount}...`;
      statusIcon = <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    } else if (pendingCount > 0) {
      statusMessage = `รอคิว ${pendingCount} ไฟล์...`;
      statusIcon = <Loader2 className="w-4 h-4 animate-spin text-gray-500" />;
    } else {
      statusMessage = "กำลังประมวลผล...";
      statusIcon = <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
  } else if (failedCount > 0 && successCount > 0) {
    statusMessage = `อัพโหลดสำเร็จ ${successCount} รูป, ล้มเหลว ${failedCount} รูป`;
    statusIcon = <XCircle className="w-4 h-4 text-red-500" />;
  } else if (failedCount > 0) {
    statusMessage = `อัพโหลดล้มเหลว ${failedCount} รูป`;
    statusIcon = <XCircle className="w-4 h-4 text-red-500" />;
  } else {
    statusMessage = `อัพโหลดสำเร็จทั้งหมด ${successCount} รูป`;
    statusIcon = <CheckCircle2 className="w-4 h-4 text-green-500" />;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg p-3 safe-area-bottom">
      <div className="max-w-2xl mx-auto">
        {/* Status row */}
        <div className="flex items-center gap-2 mb-2">
          {statusIcon}
          <span className="text-sm font-medium flex-1">{statusMessage}</span>
          {/* Dismiss button - only when not uploading */}
          {!isUploading && (
            <button onClick={onDismiss} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isUploading && (
          <Progress value={progressPercent} className="h-2 mb-2" />
        )}

        {/* Retry button for failed files */}
        {hasFailedFiles && !isUploading && (
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              ลองอัพโหลดใหม่ ({failedCount} รูป)
            </Button>
            <span className="text-xs text-gray-500">
              กดเพื่อลองอัพโหลดรูปที่ล้มเหลวอีกครั้ง
            </span>
          </div>
        )}

        {/* Individual file status - show only failed files for detail */}
        {hasFailedFiles && !isUploading && failedCount <= 5 && (
          <div className="mt-2 space-y-1">
            {files
              .filter((f) => f.status === "failed")
              .map((f) => (
                <div key={f.fileName} className="flex items-center gap-2 text-xs text-red-600">
                  <XCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">{f.fileName}</span>
                  <span className="text-gray-400">({f.error})</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
