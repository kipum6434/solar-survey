import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";

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
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const { data: statuses } = trpc.customStatus.list.useQuery({ type });

  const updateCustomerStatus = trpc.customStatus.updateCustomerStatus.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนสถานะสำเร็จ");
      onStatusChanged?.();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSurveyStatus = trpc.customStatus.updateSurveyStatus.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนสถานะสำเร็จ");
      onStatusChanged?.();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = updateCustomerStatus.isPending || updateSurveyStatus.isPending;

  const handleSelect = (statusId: number | null) => {
    if (statusId === currentStatusId) {
      setOpen(false);
      return;
    }
    if (type === "customer") {
      updateCustomerStatus.mutate({ customerId: entityId, statusId });
    } else {
      updateSurveyStatus.mutate({ surveyId: entityId, statusId });
    }
  };

  // Determine current display
  const displayLabel = currentCustomStatus?.label || fallbackLabel || "ไม่มีสถานะ";
  const displayColor = currentCustomStatus?.color || fallbackColor || "#78716c";
  const displayBgColor = currentCustomStatus?.bgColor || fallbackBgColor || "#f5f5f4";

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        className="w-48 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
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
              onClick={() => handleSelect(s.id)}
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
              {currentStatusId === s.id && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}

          {(!statuses || statuses.length === 0) && (
            <p className="text-[10px] text-muted-foreground text-center py-2">
              ยังไม่มีสถานะ ไปเพิ่มที่ "จัดการสถานะ"
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
