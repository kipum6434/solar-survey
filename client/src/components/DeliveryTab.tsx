import { useState, useRef, useMemo, useCallback } from "react";
import { compressImages } from "@/lib/imageCompression";
import { useUploadWithRetry } from "@/hooks/useUploadWithRetry";
import { UploadStatusBar } from "@/components/UploadStatusBar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  MessageSquare, SendHorizontal, CircleAlert, CircleCheck, Info, FileDown,
} from "lucide-react";
import type { ImageProxyFn, CompanyInfo } from "@/lib/pdfExport";
const getPdfExport = () => import("@/lib/pdfExport");
import DeliveryFormSection from "@/components/DeliveryFormSection";

interface DeliveryTabProps {
  surveyId: number;
  installationStatus: string | null;
  surveyData?: any;
  customerData?: any;
}

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "รอส่งมอบ", color: "text-amber-700", bg: "bg-amber-50", icon: Clock },
  submitted: { label: "ส่งมอบแล้ว (รออนุมัติ)", color: "text-blue-700", bg: "bg-blue-50", icon: Send },
  approved: { label: "อนุมัติแล้ว", color: "text-green-700", bg: "bg-green-50", icon: CheckCircle2 },
  rejected: { label: "ถูกปฏิเสธ", color: "text-red-700", bg: "bg-red-50", icon: XCircle },
};

export default function DeliveryTab({ surveyId, installationStatus, surveyData, customerData }: DeliveryTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const proxyImageMut = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  const { data: companySettings } = trpc.companySettings.get.useQuery(undefined, { retry: false });
  const { data: installDocSetting } = trpc.documentSettings.getByKey.useQuery({ key: "install_doc_number" }, { retry: false });
  const companyInfoForPdf: CompanyInfo | null = companySettings ? {
    companyName: companySettings.companyName,
    phone: companySettings.phone,
    address: companySettings.address,
    logoUrl: companySettings.logoUrl,
    photoBorderColor: companySettings.photoBorderColor,
  } : null;

  // Queries
  const { data: deliveryInfo, refetch: refetchDelivery } = trpc.delivery.info.useQuery({ surveyId });
  const { data: installPhotos, isLoading: photosLoading, refetch: refetchPhotos } = trpc.installationPhoto.list.useQuery({ surveyId });
  const { data: photoCategories } = trpc.installationPhotoCategory.list.useQuery();
  const { data: validation, refetch: refetchValidation } = trpc.installationPhotoCategory.validateForDelivery.useQuery({ surveyId });

  // Mutations
  const uploadPhoto = trpc.installationPhoto.upload.useMutation({
    onSuccess: () => { toast.success("อัปโหลดรูปติดตั้งสำเร็จ"); refetchPhotos(); refetchValidation(); },
    onError: (e) => toast.error(e.message),
  });
  const deletePhotoMut = trpc.installationPhoto.delete.useMutation({
    onSuccess: () => { toast.success("ลบรูปสำเร็จ"); refetchPhotos(); refetchValidation(); },
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
  const completeInstallation = trpc.delivery.completeInstallation.useMutation({
    onSuccess: () => { toast.success("ติดตั้งเสร็จสิ้นแล้ว!"); refetchDelivery(); },
    onError: (e) => toast.error(e.message),
  });
  const [showCompleteInstallConfirm, setShowCompleteInstallConfirm] = useState(false);

  // State
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<number | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>("");
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string>("");
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  // Category order for PDF sorting (follows sortOrder from DB)
  const categoryOrder = useMemo(() => {
    if (!photoCategories) return [];
    return photoCategories.map((cat: any) => cat.key);
  }, [photoCategories]);

  // Build category metadata map
  const categoryMetaMap = useMemo(() => {
    const map: Record<string, { isRequired: boolean; isConditional: boolean; conditionNote: string | null }> = {};
    if (photoCategories) {
      for (const cat of photoCategories) {
        map[cat.key] = { isRequired: cat.isRequired, isConditional: cat.isConditional, conditionNote: cat.conditionNote };
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

  // Progress calculation
  const progressPercent = useMemo(() => {
    if (!validation) return 0;
    if (validation.requiredCount === 0) return 100;
    return Math.round((validation.completedRequired / validation.requiredCount) * 100);
  }, [validation]);

  const { state: uploadState, uploadFiles: uploadWithRetry, retryFailed, clearState: clearUploadState } = useUploadWithRetry();

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const validFiles = Array.from(files).filter(f => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} ขนาดเกิน 10MB`); return false; }
      return true;
    });
    if (validFiles.length === 0) return;
    try {
      const compressed = await compressImages(validFiles);

      const { successCount, failedCount } = await uploadWithRetry(compressed, async (item) => {
        await uploadPhoto.mutateAsync({
          surveyId,
          fileName: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${item.fileName}`,
          category: uploadCategory || "other",
          fileData: item.base64,
        });
      });

      if (successCount > 0) {
        toast.success(`อัพโหลดสำเร็จ ${successCount} รูป`);
      }
      if (failedCount > 0) {
        toast.error(`อัพโหลดล้มเหลว ${failedCount} รูป (กดลองใหม่ได้ที่ด้านล่าง)`);
      }
    } catch (err: any) {
      toast.error(err?.message || "อัพโหลดล้มเหลว");
    }
    e.target.value = "";
  }, [surveyId, uploadCategory, uploadPhoto, uploadWithRetry]);

  const startUpload = (categoryKey: string) => {
    setUploadCategory(categoryKey);
    setShowUploadOptions(true);
  };

  const startGalleryUpload = () => {
    setShowUploadOptions(false);
    setTimeout(() => photoInputRef.current?.click(), 50);
  };

  const startCameraUpload = () => {
    setShowUploadOptions(false);
    setTimeout(() => cameraInputRef.current?.click(), 50);
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

  const handleSubmitClick = () => {
    if (validation && !validation.isComplete && !isAdmin) {
      toast.error("กรุณาอัปโหลดรูปให้ครบทุกหมวดหมู่ที่จำเป็นก่อนส่งมอบงาน");
      return;
    }
    setShowSubmitConfirm(true);
  };

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
              {/* Upload button - always visible when canEdit */}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => startUpload(allCategories.length > 0 ? allCategories[0] : "other")}
                >
                  <Upload className="h-3.5 w-3.5" />
                  อัปโหลดรูป
                </Button>
              )}
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
              {/* Export PDF */}
              {installPhotos && installPhotos.length > 0 && surveyData && customerData && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={isExportingPDF}
                  onClick={async () => {
                    setIsExportingPDF(true);
                    try {
                      const { exportInstallationPDF } = await getPdfExport();
                      await exportInstallationPDF(
                        {
                          id: surveyData.id,
                          status: surveyData.status,
                          systemSize: surveyData.systemSize,
                          panelCount: surveyData.panelCount,
                          panelBrand: surveyData.panelBrand,
                          inverterModel: surveyData.inverterModel,
                          systemType: surveyData.systemType,
                          installationDate: surveyData.installationDate,
                          installationStatus: surveyData.installationStatus,
                          completedAt: surveyData.completedAt,
                        },
                        {
                          name: customerData.name,
                          phone: customerData.phone,
                          fullAddress: customerData.fullAddress,
                          subDistrict: customerData.subDistrict,
                          district: customerData.district,
                          province: customerData.province,
                          postalCode: customerData.postalCode,
                        },
                        installPhotos.map((p: any) => ({ url: p.url, category: p.category, caption: p.caption })),
                        categoryLabelMap,
                        deliveryInfo ? {
                          deliveryStatus: deliveryInfo.deliveryStatus || undefined,
                          deliverySubmittedAt: deliveryInfo.deliverySubmittedAt || undefined,
                          deliveryApprovedAt: deliveryInfo.deliveryApprovedAt || undefined,
                          deliveryRejectionReason: deliveryInfo.deliveryRejectionReason || undefined,
                        } : null,
                        (step) => setPdfProgress(step),
                        imageProxyFn,
                        companyInfoForPdf,
                        categoryOrder,
                        installDocSetting?.documentNumber,
                      );
                      toast.success("Export PDF สำเร็จ");
                    } catch (err: any) {
                      toast.error(err?.message || "Export PDF ล้มเหลว");
                    } finally {
                      setIsExportingPDF(false);
                      setPdfProgress("");
                    }
                  }}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {isExportingPDF ? pdfProgress || "กำลัง Export..." : "Export PDF"}
                </Button>
              )}
              {/* Submit button */}
              {canEdit && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                  onClick={handleSubmitClick}
                  disabled={!installPhotos || installPhotos.length === 0 || submitDelivery.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitDelivery.isPending ? "กำลังส่ง..." : "ส่งมอบงาน"}
                </Button>
              )}
              {/* ติดตั้งเสร็จสิ้น button — แสดงเมื่อ installationStatus เป็น in_progress หรือ waiting */}
              {(installationStatus === "in_progress" || installationStatus === "waiting") && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setShowCompleteInstallConfirm(true)}
                  disabled={completeInstallation.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ติดตั้งเสร็จสิ้น
                </Button>
              )}
              {installationStatus === "completed" && (
                <Badge className="bg-emerald-50 text-emerald-700 border-0 text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> ติดตั้งเสร็จแล้ว
                </Badge>
              )}
              {/* Admin approve/reject */}
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
          {/* Pending approval alert banner */}
          {deliveryStatus === "submitted" && (
            <div className="flex items-start gap-3 p-4 mb-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-800">
              <Info className="h-5 w-5 mt-0.5 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold text-sm">งานนี้ส่งมอบแล้ว รอการอนุมัติจากแอดมิน</p>
                <p className="text-xs mt-1 text-blue-600">กรุณาตรวจสอบรูปภาพและข้อมูลให้ครบถ้วน แล้วกดอนุมัติหรือปฏิเสธ</p>
              </div>
            </div>
          )}

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

          {/* Progress bar for required categories */}
          {validation && validation.requiredCount > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  {validation.isComplete ? (
                    <CircleCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <CircleAlert className="h-4 w-4 text-amber-500" />
                  )}
                  รูปที่จำเป็น: {validation.completedRequired}/{validation.requiredCount} หมวด
                </span>
                <span className="text-xs text-muted-foreground">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {validation.missingRequired.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] text-red-600 font-medium">ยังขาด:</p>
                  <div className="flex flex-wrap gap-1">
                    {validation.missingRequired.map((c: any) => (
                      <Badge key={c.key} variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50 gap-1 cursor-pointer hover:bg-red-100"
                        onClick={() => canEdit && startUpload(c.key)}>
                        <XCircle className="h-2.5 w-2.5" /> {c.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {validation.missingConditional.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] text-amber-600 font-medium">ถ้ามี (ไม่บังคับ):</p>
                  <div className="flex flex-wrap gap-1">
                    {validation.missingConditional.map((c: any) => (
                      <Badge key={c.key} variant="outline" className="text-[10px] border-amber-200 text-amber-600 bg-amber-50 gap-1 cursor-pointer hover:bg-amber-100"
                        onClick={() => canEdit && startUpload(c.key)}>
                        <Info className="h-2.5 w-2.5" /> {c.label}
                        {c.conditionNote && <span className="text-[9px] opacity-70">({c.conditionNote})</span>}
                      </Badge>
                    ))}
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
              const meta = categoryMetaMap[catKey];
              return (
                <Button
                  key={catKey}
                  variant={selectedCategory === catKey ? "default" : "outline"}
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => setSelectedCategory(catKey)}
                >
                  {meta?.isRequired && count === 0 && <XCircle className="h-3 w-3 text-red-500" />}
                  {meta?.isRequired && count > 0 && <CircleCheck className="h-3 w-3 text-green-500" />}
                  {meta?.isConditional && <Info className="h-3 w-3 text-amber-500" />}
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
            allCategories.length > 0 ? (
              <div className="space-y-6">
                {allCategories.map((catKey) => {
                  const catPhotos = photosByCategory[catKey] || [];
                  const meta = categoryMetaMap[catKey];
                  return (
                    <div key={catKey}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                          {categoryLabelMap[catKey] || catKey}
                          <Badge variant="secondary" className="text-[10px]">{catPhotos.length}</Badge>
                          {meta?.isRequired && (
                            <Badge className={`text-[9px] border-0 ${catPhotos.length > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {catPhotos.length > 0 ? "✓ จำเป็น" : "✗ จำเป็น"}
                            </Badge>
                          )}
                          {meta?.isConditional && (
                            <Badge className="text-[9px] border-0 bg-amber-100 text-amber-700">
                              {meta.conditionNote || "ถ้ามี"}
                            </Badge>
                          )}
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
                        <div className={`text-center py-6 rounded-lg ${meta?.isRequired ? "bg-red-50/50 border border-red-200/50" : "bg-muted/30"}`}>
                          <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-xs text-muted-foreground">
                            ยังไม่มีรูปในหมวดนี้
                            {meta?.isRequired && <span className="text-red-500 font-medium"> (จำเป็นต้องอัปโหลด)</span>}
                            {meta?.isConditional && <span className="text-amber-500"> ({meta.conditionNote || "ถ้ามี"})</span>}
                          </p>
                          {canEdit && (
                            <Button variant="outline" size="sm" className="mt-2 text-xs gap-1" onClick={() => startUpload(catKey)}>
                              <Upload className="h-3 w-3" /> อัปโหลดรูป
                            </Button>
                          )}
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
                <p className="text-xs mt-1">กดปุ่ม "อัปโหลดรูป" เพื่อเพิ่มรูปถ่ายการติดตั้ง</p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5 text-xs"
                    onClick={() => startUpload("other")}
                  >
                    <Upload className="h-3.5 w-3.5" /> อัปโหลดรูปติดตั้ง
                  </Button>
                )}
              </div>
            )
          ) : (
            // Show filtered category
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  {categoryLabelMap[selectedCategory] || selectedCategory}
                  {categoryMetaMap[selectedCategory]?.isRequired && (
                    <Badge className="text-[9px] border-0 bg-red-100 text-red-700">จำเป็น</Badge>
                  )}
                  {categoryMetaMap[selectedCategory]?.isConditional && (
                    <Badge className="text-[9px] border-0 bg-amber-100 text-amber-700">
                      {categoryMetaMap[selectedCategory]?.conditionNote || "ถ้ามี"}
                    </Badge>
                  )}
                </h4>
                {canEdit && (
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => startUpload(selectedCategory)}>
                    <Plus className="h-3 w-3" /> เพิ่มรูป
                  </Button>
                )}
              </div>
              {(installPhotos?.filter((p: any) => p.category === selectedCategory) || []).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {(installPhotos?.filter((p: any) => p.category === selectedCategory) || []).map((photo: any) => (
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

      {/* Delivery Comments Section */}
      <DeliveryCommentSection surveyId={surveyId} isAdmin={isAdmin} currentUserId={user?.id} />

      {/* Hidden file input (gallery/file picker) */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handlePhotoUpload}
      />
      {/* Hidden camera input (direct capture for mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handlePhotoUpload}
      />

      {/* Upload options dialog (camera vs gallery) */}
      <Dialog open={showUploadOptions} onOpenChange={setShowUploadOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-sm">เลือกวิธีอัปโหลดรูป</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button variant="outline" className="w-full gap-2 h-12" onClick={startCameraUpload}>
              <Camera className="h-5 w-5" /> ถ่ายรูปจากกล้อง
            </Button>
            <Button variant="outline" className="w-full gap-2 h-12" onClick={startGalleryUpload}>
              <Image className="h-5 w-5" /> เลือกรูปจากแกลเลอรี
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              {validation && !validation.isComplete && (
                <span className="text-xs mt-2 block text-amber-600">
                  ⚠️ ยังขาดรูปหมวดหมู่ที่จำเป็น {validation.missingRequired.length} หมวด
                  {isAdmin && " (แอดมินสามารถข้ามการตรวจสอบได้)"}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                submitDelivery.mutate({
                  surveyId,
                  skipValidation: isAdmin && validation && !validation.isComplete ? true : undefined,
                });
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
      {/* Confirm Complete Installation */}
      <AlertDialog open={showCompleteInstallConfirm} onOpenChange={setShowCompleteInstallConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันติดตั้งเสร็จสิ้น</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการยืนยันว่าการติดตั้งเสร็จสิ้นแล้วหรือไม่?
              <br />
              <span className="text-xs mt-1 block">สถานะจะเปลี่ยนเป็น "ติดตั้งเสร็จ" — สามารถดำเนินการส่งมอบงานต่อได้</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                completeInstallation.mutate({ surveyId });
                setShowCompleteInstallConfirm(false);
              }}
            >
              ยืนยันติดตั้งเสร็จ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Upload Status Bar */}
      <UploadStatusBar
        state={uploadState}
        onRetry={async () => {
          const { successCount } = await retryFailed();
          if (successCount > 0) {
            toast.success(`อัพโหลดสำเร็จ ${successCount} รูป`);
          }
        }}
        onDismiss={clearUploadState}
      />

      {/* ใบส่งมอบงาน (Checklist + ลายเซ็น + PDF) */}
      <DeliveryFormSection
        surveyId={surveyId}
        installationStatus={installationStatus}
        surveyData={surveyData}
        customerData={customerData}
      />

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


/* ==================== Delivery Comment Section ==================== */
function DeliveryCommentSection({ surveyId, isAdmin, currentUserId }: {
  surveyId: number;
  isAdmin: boolean;
  currentUserId?: number;
}) {
  const [newComment, setNewComment] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: comments = [], isLoading, refetch } = trpc.deliveryComment.list.useQuery(
    { surveyId },
    { enabled: !!surveyId }
  );

  const addComment = trpc.deliveryComment.add.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มความคิดเห็นสำเร็จ");
      setNewComment("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteComment = trpc.deliveryComment.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบความคิดเห็นสำเร็จ");
      setConfirmDeleteId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;
    addComment.mutate({ surveyId, message: trimmed });
  };

  const formatDate = (d: string | Date) => {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          ความคิดเห็น / บันทึกข้อความ
          {comments.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">{comments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add comment form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            placeholder="เพิ่มความคิดเห็นหรือบันทึกข้อความ..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className="resize-none text-sm flex-1"
            maxLength={2000}
          />
          <Button
            type="submit"
            size="sm"
            className="self-end gap-1.5 shrink-0"
            disabled={!newComment.trim() || addComment.isPending}
          >
            <SendHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{addComment.isPending ? "กำลังส่ง..." : "ส่ง"}</span>
          </Button>
        </form>

        {/* Comments list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">ยังไม่มีความคิดเห็น</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment: any) => {
              const canDelete = isAdmin || comment.userId === currentUserId;
              return (
                <div key={comment.id} className="group bg-muted/40 rounded-lg p-3 relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {comment.userName || "ผู้ใช้"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words text-foreground/90">
                        {comment.message}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full flex items-center justify-center hover:bg-red-50 shrink-0"
                        onClick={() => setConfirmDeleteId(comment.id)}
                        title="ลบความคิดเห็น"
                      >
                        <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Confirm Delete Comment Dialog */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบความคิดเห็น</AlertDialogTitle>
            <AlertDialogDescription>คุณต้องการลบความคิดเห็นนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteId) {
                  deleteComment.mutate({ id: confirmDeleteId });
                }
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
