import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Check, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface StatusDropdownProps {
  type: "customer" | "survey";
  entityId: number;
  currentStatusId: number | null;
  currentCustomStatus: { id: number; label: string; color: string; bgColor: string } | null;
  /** Fallback label when no custom status is set (e.g. derived from survey status) */
  fallbackLabel?: string;
  fallbackColor?: string;
  fallbackBgColor?: string;
  onStatusChanged?: () => void;
  /** If true, when a status with label containing 'ปิดการขาย' or 'นัดติดตั้ง' is selected, navigate to installations page */
  navigateOnInstallation?: boolean;
}

export function StatusDropdown({
  type,
  entityId,
  currentStatusId,
  currentCustomStatus,
  fallbackLabel,
  fallbackColor,
  fallbackBgColor,
  onStatusChanged,
  navigateOnInstallation,
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: statuses } = trpc.customStatus.list.useQuery({ type });

  // Date picker state for installation scheduling
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [installDate, setInstallDate] = useState("");
  const pendingStatusIdRef = useRef<number | null>(null);

  // Store the selected status label in a ref so we can access it in onSuccess
  const selectedStatusLabelRef = useRef<string | null>(null);

  // Helper to check if a status label indicates installation/closed deal
  const isInstallationStatus = (label: string) => {
    const keywords = ["ปิดการขาย", "นัดติดตั้ง", "ติดตั้ง"];
    return keywords.some(kw => label.includes(kw));
  };

  const updateCustomerStatus = trpc.customStatus.updateCustomerStatus.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนสถานะสำเร็จ");
      onStatusChanged?.();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateInstallationDate = trpc.customStatus.updateInstallationDate.useMutation({
    onSuccess: () => {
      toast.success("บันทึกวันที่นัดติดตั้งสำเร็จ");
      onStatusChanged?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSurveyStatus = trpc.customStatus.updateSurveyStatus.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนสถานะสำเร็จ");
      onStatusChanged?.();
      setOpen(false);
      setShowDatePicker(false);
      // Check if selected status triggers navigation to installations page
      if (navigateOnInstallation && selectedStatusLabelRef.current) {
        if (isInstallationStatus(selectedStatusLabelRef.current)) {
          toast.info("กำลังไปหน้างานติดตั้ง...", { duration: 2000 });
          setTimeout(() => setLocation("/installations"), 500);
        }
      }
      selectedStatusLabelRef.current = null;
    },
    onError: (e) => {
      toast.error(e.message);
      selectedStatusLabelRef.current = null;
      setShowDatePicker(false);
    },
  });

  const isPending = updateCustomerStatus.isPending || updateSurveyStatus.isPending || updateInstallationDate.isPending;

  const handleSelect = (statusId: number | null, statusLabel?: string) => {
    if (statusId === currentStatusId) {
      setOpen(false);
      return;
    }

    // If survey type and the selected status is an installation status, show date picker first
    if (type === "survey" && statusLabel && isInstallationStatus(statusLabel)) {
      pendingStatusIdRef.current = statusId;
      selectedStatusLabelRef.current = statusLabel;
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setInstallDate(tomorrow.toISOString().split("T")[0]);
      setShowDatePicker(true);
      return;
    }

    // Store the label before mutation
    selectedStatusLabelRef.current = statusLabel || null;
    if (type === "customer") {
      updateCustomerStatus.mutate({ customerId: entityId, statusId });
    } else {
      updateSurveyStatus.mutate({ surveyId: entityId, statusId });
    }
  };

  const handleConfirmWithDate = () => {
    const statusId = pendingStatusIdRef.current;
    // Update status
    updateSurveyStatus.mutate({ surveyId: entityId, statusId });
    // Update installation date if provided
    if (installDate) {
      const dateTs = new Date(installDate + "T00:00:00").getTime();
      updateInstallationDate.mutate({ surveyId: entityId, installationDate: dateTs });
    }
  };

  const handleSkipDate = () => {
    const statusId = pendingStatusIdRef.current;
    updateSurveyStatus.mutate({ surveyId: entityId, statusId });
    setShowDatePicker(false);
  };

  // Determine current display
  const displayLabel = currentCustomStatus?.label || fallbackLabel || "ไม่มีสถานะ";
  const displayColor = currentCustomStatus?.color || fallbackColor || "#78716c";
  const displayBgColor = currentCustomStatus?.bgColor || fallbackBgColor || "#f5f5f4";

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShowDatePicker(false); } }}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
          style={{
            color: displayColor,
            backgroundColor: displayBgColor,
            borderColor: displayColor + "30",
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          disabled={isPending}
        >
          {isPending ? "กำลังบันทึก..." : displayLabel}
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {showDatePicker ? (
          /* Date picker step */
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>เลือกวันนัดติดตั้ง</span>
            </div>
            <input
              type="date"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={handleConfirmWithDate}
                disabled={isPending}
              >
                {isPending ? "กำลังบันทึก..." : "ยืนยัน"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={handleSkipDate}
                disabled={isPending}
              >
                ข้าม
              </Button>
            </div>
          </div>
        ) : (
          /* Status list */
          <div className="space-y-0.5">
            {/* Option to clear status */}
            <button
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors text-left ${
                !currentStatusId ? "bg-muted/30" : ""
              }`}
              onClick={() => handleSelect(null)}
            >
              <span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 shrink-0" />
              <span className="flex-1 text-muted-foreground">ไม่มีสถานะ</span>
              {!currentStatusId && <Check className="h-3 w-3 text-primary" />}
            </button>

            {statuses && statuses.length > 0 && (
              <div className="h-px bg-border my-1" />
            )}

            {statuses?.map((s: any) => (
              <button
                key={s.id}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors text-left ${
                  currentStatusId === s.id ? "bg-muted/30" : ""
                }`}
                onClick={() => handleSelect(s.id, s.label)}
              >
                <span
                  className="w-3 h-3 rounded-full border shrink-0"
                  style={{ backgroundColor: s.bgColor, borderColor: s.color + "40" }}
                >
                  <span
                    className="block w-1.5 h-1.5 rounded-full mx-auto mt-[3px]"
                    style={{ backgroundColor: s.color }}
                  />
                </span>
                <span className="flex-1" style={{ color: s.color }}>{s.label}</span>
                {isInstallationStatus(s.label) && (
                  <Calendar className="h-3 w-3 text-muted-foreground opacity-50" />
                )}
                {currentStatusId === s.id && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}

            {(!statuses || statuses.length === 0) && (
              <p className="text-[10px] text-muted-foreground text-center py-2">
                ยังไม่มีสถานะ ไปเพิ่มที่ "จัดการสถานะ"
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
