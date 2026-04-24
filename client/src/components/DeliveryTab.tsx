import { useState, useRef, useCallback, useMemo } from "react";
import { compressImage } from "@/lib/imageCompression";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, Trash2, Camera, CheckCircle2, XCircle, Clock, Send,
  Image, Eye, X, Package, Plus, AlertTriangle, Download, FolderDown,
} from "lucide-react";

interface DeliveryTabProps {
  surveyId: number;
  installationStatus: string | null;
}

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "รอส่งมอบ", color: "text-amber-700", bg: "bg-amber-50", icon: Clock },
  submitted: { label: "ส่งมอบแล้ว (รออนุมัติ)", color: "text-blue-700", bg: "bg-blue-50", icon: Send },
  approved: { label: "อนุมัติแล้ว", color: "text-green-700", bg: "bg-green-50", icon: CheckCircle2 },
  rejected: { label: "ถูกปฏิเสธ", color: "text-red-700", bg: "bg-red-50", icon: XCircle },
};

export default function DeliveryTab({ surveyId, installationStatus }: DeliveryTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Queries
  const { data: deliveryInfo, refetch: refetchDelivery } = trpc.delivery.info.useQuery({ surveyId });
  const { data: installPhotos, isLoading: photosLoading, refetch: refetchPhotos } = trpc.installationPhoto.list.useQuery({ surveyId });
  const { data: photoCategories } = trpc.installationPhotoCategory.list.useQuery();

  // Mutations
  const uploadPhoto = trpc.installationPhoto.upload.useMutation({
    onSuccess: () => { toast.success("อัปโหลดรูปติดตั้งสำเร็จ"); refetchPhotos(); },
    onError: (e) => toast.error(e.message),
  });
  const deletePhotoMut = trpc.installationPhoto.delete.useMutation({
    onSuccess: () => { toast.success("ลบรูปสำเร็จ"); refetchPhotos(); },
    onError: (e) => toast.error(e.message),
  });
  const submitDelivery = trpc.delivery.submit.useMutation({
    onSuccess: () => { toast.success("ส่งมอบงานสำเร็จ"); refetchDelivery(); },
    onError: (e) => toast.error(e.message),
  });
  const approveDelivery = trpc.delivery.approve.useMutation({
    onSuccess: () => { toast.success("อนุมัติส่งมอบงานสำเร็จ"); refetchDelivery(); },
    onError: (e) => toast.error(e.message),
  });
  const rejectDelivery = trpc.delivery.reject.useMutation({
    onSuccess: () => { toast.success("ปฏิเสธส่งมอบงานสำเร็จ"); refetchDelivery(); setShowRejectDialog(false); setRejectReason(""); },
    onError: (e) => toast.error(e.message),
  });

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<number | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>("");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const deliveryStatus = deliveryInfo?.deliveryStatus || "pending";
  const statusInfo = DELIVERY_STATUS_MAP[deliveryStatus] || DELIVERY_STATUS_MAP.pending;
  const StatusIcon = statusInfo.icon;

  // Can edit photos only when status is pending or rejected
  const canEdit = deliveryStatus === "pending" || deliveryStatus === "rejected";

  // Group photos by category
  const photosByCategory = useMemo(() => {
    if (!installPhotos) return {};
    const grouped: Record<string, any[]> = {};
    for (const photo of installPhotos) {
      const cat = photo.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(photo);
    }
    return grouped;
  }, [installPhotos]);

  // Build category label map
  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (photoCategories) {
      for (const cat of photoCategories) {
        map[cat.key] = cat.label;
      }
    }
    return map;
  }, [photoCategories]);

  // All categories (from DB + any that photos have)
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    if (photoCategories) {
      for (const cat of photoCategories) cats.add(cat.key);
    }
    if (installPhotos) {
      for (const photo of installPhotos) {
        if (photo.category) cats.add(photo.category);
      }
    }
    return Array.from(cats);
  }, [photoCategories, installPhotos]);

  // Filter photos
  const filteredPhotos = useMemo(() => {
    if (!installPhotos) return [];
    if (selectedCategory === "all") return installPhotos;
    return installPhotos.filter((p: any) => p.category === selectedCategory);
  }, [installPhotos, selectedCategory]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} ขนาดเกิน 10MB`); continue; }
      try {
        const { base64, fileName } = await compressImage(file);
        uploadPhoto.mutate({
          surveyId,
          fileName: `${Date.now()}-${fileName}`,
          category: uploadCategory || "other",
          fileData: base64,
        });
      } catch {
        // Fallback: upload original
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          uploadPhoto.mutate({
            surveyId,
            fileName: `${Date.now()}-${file.name}`,
            category: uploadCategory || "other",
            fileData: base64,
          });
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = "";
  }, [surveyId, uploadCategory, uploadPhoto]);

  const startUpload = (categoryKey: string) => {
    setUploadCategory(categoryKey);
    setTimeout(() => photoInputRef.current?.click(), 50);
  };

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const handleDownloadAll = useCallback(async () => {
    if (!installPhotos || installPhotos.length === 0) return;
    setIsDownloadingAll(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < installPhotos.length; i++) {
        const photo = installPhotos[i] as any;
        try {
          const resp = await fetch(photo.url);
          const blob = await resp.blob();
          const catLabel = categoryLabelMap[photo.category] || photo.category || "other";
          const ext = photo.url.split(".").pop()?.split("?")[0] || "jpg";
          zip.file(`${catLabel}/${i + 1}.${ext}`, blob);
        } catch { /* skip failed */ }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `installation-photos-${surveyId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลดรูปทั้งหมดสำเร็จ");
    } catch {
      toast.error("ดาวน์โหลดล้มเหลว");
    } finally {
      setIsDownloadingAll(false);
    }
  }, [installPhotos, categoryLabelMap, surveyId]);

  return (
    <div className="space-y-4">
      {/* Delivery Status Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" /> ส่งมอบงานติดตั้ง
              </CardTitle>
              <Badge className={`${statusInfo.bg} ${statusInfo.color} border-0 text-xs gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Download all photos */}
              {installPhotos && installPhotos.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleDownloadAll}
                  disabled={isDownloadingAll}
                >
                  <FolderDown className="h-3.5 w-3.5" />
                  {isDownloadingAll ? "กำลังดาวน์โหลด..." : `ดาวน์โหลดทั้งหมด (${installPhotos.length})`}
                </Button>
              )}
              {/* Submit button - visible when pending/rejected and has photos */}
              {canEdit && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={!installPhotos || installPhotos.length === 0 || submitDelivery.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitDelivery.isPending ? "กำลังส่ง..." : "ส่งมอบงาน"}
                </Button>
              )}
              {/* Admin approve/reject - visible when submitted */}
              {isAdmin && deliveryStatus === "submitted" && (
                <>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={approveDelivery.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    อนุมัติ
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={rejectDelivery.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    ปฏิเสธ
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Delivery info details */}
          {deliveryInfo && (deliveryInfo.deliverySubmittedAt || deliveryInfo.deliveryApprovedAt || deliveryInfo.deliveryRejectionReason) && (
            <div className="space-y-2 text-sm mb-4">
              {deliveryInfo.deliverySubmittedAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Send className="h-3.5 w-3.5" />
                  <span>ส่งมอบเมื่อ: {formatDate(deliveryInfo.deliverySubmittedAt)}</span>
                </div>
              )}
              {deliveryInfo.deliveryApprovedAt && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>อนุมัติเมื่อ: {formatDate(deliveryInfo.deliveryApprovedAt)}</span>
                </div>
              )}
              {deliveryInfo.deliveryRejectionReason && (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">เหตุผลที่ปฏิเสธ:</p>
                    <p className="mt-0.5">{deliveryInfo.deliveryRejectionReason}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setSelectedCategory("all")}
            >
              ทั้งหมด ({installPhotos?.length || 0})
            </Button>
            {allCategories.map((catKey) => {
              const count = photosByCategory[catKey]?.length || 0;
              return (
                <Button
                  key={catKey}
                  variant={selectedCategory === catKey ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedCategory(catKey)}
                >
                  {categoryLabelMap[catKey] || catKey} ({count})
                </Button>
              );
            })}
          </div>

          {/* Photo grid by category */}
          {photosLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-square rounded-lg" />)}
            </div>
          ) : selectedCategory === "all" ? (
            // Show grouped by category
            allCategories.length > 0 ? (
              <div className="space-y-6">
                {allCategories.map((catKey) => {
                  const catPhotos = photosByCategory[catKey] || [];
                  return (
                    <div key={catKey}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                          {categoryLabelMap[catKey] || catKey}
                          <Badge variant="secondary" className="text-[10px]">{catPhotos.length}</Badge>
                        </h4>
                        {canEdit && (
                          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => startUpload(catKey)}>
                            <Plus className="h-3 w-3" /> เพิ่มรูป
                          </Button>
                        )}
                      </div>
                      {catPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {catPhotos.map((photo: any) => (
                            <PhotoCard
                              key={photo.id}
                              photo={photo}
                              canDelete={canEdit}
                              onView={() => setLightboxImg(photo.url)}
                              onDelete={() => setConfirmDeletePhoto(photo.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                          <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs">ยังไม่มีรูปในหมวดนี้</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">ยังไม่มีรูปติดตั้ง</p>
                <p className="text-xs mt-1">เลือกหมวดหมู่แล้วอัปโหลดรูปถ่ายการติดตั้ง</p>
              </div>
            )
          ) : (
            // Show filtered category
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">
                  {categoryLabelMap[selectedCategory] || selectedCategory}
                </h4>
                {canEdit && (
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => startUpload(selectedCategory)}>
                    <Plus className="h-3 w-3" /> เพิ่มรูป
                  </Button>
                )}
              </div>
              {filteredPhotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredPhotos.map((photo: any) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      canDelete={canEdit}
                      onView={() => setLightboxImg(photo.url)}
                      onDelete={() => setConfirmDeletePhoto(photo.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                  <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">ยังไม่มีรูปในหมวดนี้</p>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="mt-3 text-xs gap-1" onClick={() => startUpload(selectedCategory)}>
                      <Upload className="h-3 w-3" /> อัปโหลดรูป
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handlePhotoUpload}
      />

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </Button>
          <img src={lightboxImg} alt="preview" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Confirm Delete Photo */}
      <AlertDialog open={confirmDeletePhoto !== null} onOpenChange={() => setConfirmDeletePhoto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรูปติดตั้ง</AlertDialogTitle>
            <AlertDialogDescription>คุณต้องการลบรูปนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeletePhoto) {
                  deletePhotoMut.mutate({ id: confirmDeletePhoto });
                  setConfirmDeletePhoto(null);
                }
              }}
            >
              ลบรูป
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Submit Delivery */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันส่งมอบงาน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการส่งมอบงานติดตั้งนี้หรือไม่?
              <br />
              <span className="text-xs mt-1 block">มีรูปถ่ายติดตั้ง {installPhotos?.length || 0} รูป — หลังส่งมอบแล้วจะต้องรอแอดมินอนุมัติ</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                submitDelivery.mutate({ surveyId });
                setShowSubmitConfirm(false);
              }}
            >
              ส่งมอบงาน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Approve */}
      <AlertDialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>อนุมัติส่งมอบงาน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการอนุมัติการส่งมอบงานติดตั้งนี้หรือไม่?
              <br />
              <span className="text-xs mt-1 block">สถานะงานจะเปลี่ยนเป็น "ส่งมอบแล้ว"</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                approveDelivery.mutate({ surveyId });
                setShowApproveConfirm(false);
              }}
            >
              อนุมัติ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ปฏิเสธส่งมอบงาน</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="ระบุเหตุผลที่ปฏิเสธ (ไม่บังคับ)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>ยกเลิก</Button>
            <Button
              variant="destructive"
              onClick={() => rejectDelivery.mutate({ surveyId, reason: rejectReason || undefined })}
              disabled={rejectDelivery.isPending}
            >
              {rejectDelivery.isPending ? "กำลังดำเนินการ..." : "ปฏิเสธ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== Photo Card Component ==================== */
function PhotoCard({ photo, canDelete, onView, onDelete }: {
  photo: any;
  canDelete: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden bg-muted/50 border">
      <img
        src={photo.url}
        alt={photo.fileName || "installation photo"}
        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
        onClick={onView}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white shadow-sm"
          onClick={(e) => { e.stopPropagation(); onView(); }}
        >
          <Eye className="h-3.5 w-3.5 text-gray-700" />
        </button>
        {canDelete && (
          <button
            className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-red-50 shadow-sm"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </button>
        )}
      </div>
      {photo.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
          {photo.caption}
        </div>
      )}
    </div>
  );
}
