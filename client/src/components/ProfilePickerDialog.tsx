import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Check, Download, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedProfileData {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  headerColor: string | null;
}

interface ProfilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (profile: SelectedProfileData) => void;
  title?: string;
  /** Use publicList endpoint (for public pages without auth) */
  usePublicList?: boolean;
}

export default function ProfilePickerDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "เลือกโปรไฟล์บริษัทสำหรับ PDF",
  usePublicList = false,
}: ProfilePickerDialogProps) {
  const { data: protectedProfiles, isLoading: protectedLoading } = trpc.companyProfile.list.useQuery(undefined, {
    enabled: open && !usePublicList,
  });
  const { data: publicProfiles, isLoading: publicLoading } = trpc.companyProfile.publicList.useQuery(undefined, {
    enabled: open && usePublicList,
  });
  const profiles = usePublicList ? publicProfiles : protectedProfiles;
  const isLoading = usePublicList ? publicLoading : protectedLoading;

  // Find default profile
  const defaultProfileId = useMemo(() => {
    if (!profiles || profiles.length === 0) return null;
    const defaultP = profiles.find((p) => p.isDefault);
    return defaultP?.id ?? profiles[0]?.id ?? null;
  }, [profiles]);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // When dialog opens, select the default profile
  const activeSelectedId = selectedId ?? defaultProfileId;

  const handleConfirm = () => {
    if (!profiles || !activeSelectedId) return;
    const profile = profiles.find((p) => p.id === activeSelectedId);
    if (!profile) return;
    onConfirm({
      id: profile.id,
      name: profile.name,
      address: profile.address,
      phone: profile.phone,
      logoUrl: profile.logoUrl,
      headerColor: profile.headerColor,
    });
    // Reset selection for next time
    setSelectedId(null);
  };

  const handleCancel = () => {
    setSelectedId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            เลือกโปรไฟล์บริษัทที่ต้องการใช้ในหัวเอกสาร PDF
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !profiles || profiles.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">ยังไม่มีโปรไฟล์บริษัท</p>
            <p className="text-xs mt-1">กรุณาสร้างโปรไฟล์ที่เมนู ตั้งค่า &gt; โปรไฟล์บริษัท (PDF)</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6 max-h-[50vh]">
            <div className="space-y-2 py-2">
              {profiles.map((profile) => {
                const isSelected = activeSelectedId === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedId(profile.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                      "hover:bg-accent/50",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border"
                    )}
                  >
                    {/* Logo / Color swatch */}
                    <div className="shrink-0">
                      {profile.logoUrl ? (
                        <img
                          src={profile.logoUrl}
                          alt={profile.name}
                          className="h-10 w-10 rounded object-contain bg-white border"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded flex items-center justify-center border"
                          style={{ backgroundColor: profile.headerColor || "#1e3a5f" }}
                        >
                          <ImageIcon className="h-5 w-5 text-white/70" />
                        </div>
                      )}
                    </div>

                    {/* Profile info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {profile.name}
                        </span>
                        {profile.isDefault && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            ค่าเริ่มต้น
                          </Badge>
                        )}
                      </div>
                      {(profile.phone || profile.address) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {[profile.phone, profile.address].filter(Boolean).join(" • ")}
                        </p>
                      )}
                    </div>

                    {/* Color swatch */}
                    <div
                      className="shrink-0 h-5 w-5 rounded-full border"
                      style={{ backgroundColor: profile.headerColor || "#1e3a5f" }}
                      title={`สีหัวเอกสาร: ${profile.headerColor || "#1e3a5f"}`}
                    />

                    {/* Check icon */}
                    {isSelected && (
                      <Check className="shrink-0 h-5 w-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!activeSelectedId || !profiles || profiles.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            ส่งออก PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
