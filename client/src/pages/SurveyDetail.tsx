import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP, INSTALLATION_STATUS_MAP, DOC_TYPE_MAP, FOLLOW_UP_METHOD_MAP, PHOTO_CATEGORY_MAP } from "@/lib/constants";
import { formatPhone } from "@/lib/formatPhone";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { compressImages } from "@/lib/imageCompression";
import { useUploadWithRetry } from "@/hooks/useUploadWithRetry";
import { UploadStatusBar } from "@/components/UploadStatusBar";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, FileText, PhoneCall, Share2, MapPin, Calendar, User, Pencil,
  Upload, Trash2, Download, Link2, Copy, X, Image, Eye, CheckCircle2, Clock,
  Zap, Sun, Home, Gauge, Receipt, Settings2, Users, Wrench, FolderDown, Package,
  PauseCircle, XCircle, RotateCcw, History, Plus, MessageSquare, ArrowRight,
} from "lucide-react";
import { MultiUserSelect } from "@/components/MultiUserSelect";
import { SourceCombobox } from "@/components/SourceCombobox";
import { StatusDropdown } from "@/components/StatusDropdown";
import DeliveryTab from "@/components/DeliveryTab";
import type { ImageProxyFn, CompanyInfo } from "@/lib/pdfExport";
const getPdfExport = () => import("@/lib/pdfExport");
import { FileDown, FileSignature } from "lucide-react";

export default function SurveyDetail() {
  const params = useParams<{ id: string }>();
  const surveyId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("photos");
  const [showEditStatus, setShowEditStatus] = useState(false);
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<number | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<number | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null);
  const [captionText, setCaptionText] = useState("");

  const proxyImageMut = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  const { data: companySettings } = trpc.companySettings.get.useQuery(undefined, { retry: false });
  const { data: surveyDocSetting } = trpc.documentSettings.getByKey.useQuery({ key: "survey_doc_number" }, { retry: false });
  const companyInfoForPdf: CompanyInfo | null = companySettings ? {
    companyName: companySettings.companyName,
    phone: companySettings.phone,
    address: companySettings.address,
    logoUrl: companySettings.logoUrl,
    photoBorderColor: companySettings.photoBorderColor,
  } : null;

  const { data, isLoading, refetch } = trpc.survey.getById.useQuery({ id: surveyId });
  const { data: photos, refetch: refetchPhotos } = trpc.photo.list.useQuery({ surveyId });
  const { data: documents, refetch: refetchDocs } = trpc.document.list.useQuery({ surveyId });
  const { data: followUps, refetch: refetchFollowUps } = trpc.followUp.list.useQuery({ surveyId });
  const { data: shareLinks, refetch: refetchLinks } = trpc.shareLink.list.useQuery({ surveyId });
  const { data: surveyShareLinks, refetch: refetchSurveyLinks } = trpc.shareLink.listByType.useQuery({ surveyId, linkType: "survey" });
  const { data: installShareLinks, refetch: refetchInstallLinks } = trpc.shareLink.listByType.useQuery({ surveyId, linkType: "installation" });
  const { data: teamAllMembers } = trpc.teamMember.listAll.useQuery();
  const teamAdminSenders = (teamAllMembers || []).filter((m: any) => m.isActive);
  const teamSurveyors = (teamAllMembers || []).filter((m: any) => m.isActive && (m.role === "surveyor" || (m.roles && JSON.parse(m.roles || '[]').includes("surveyor"))));
  const teamClosers = (teamAllMembers || []).filter((m: any) => m.isActive && (m.role === "closer" || (m.roles && JSON.parse(m.roles || '[]').includes("closer"))));
  const { data: photoCategories, refetch: refetchCategories } = trpc.photoCategory.list.useQuery();
  const createCategory = trpc.photoCategory.create.useMutation({ onSuccess: () => { refetchCategories(); toast.success("เพิ่มประเภทรูปภาพสำเร็จ"); } });
  const deleteCategory = trpc.photoCategory.delete.useMutation({ onSuccess: () => { refetchCategories(); toast.success("ลบประเภทรูปภาพสำเร็จ"); } });
  const { data: docCategories, refetch: refetchDocCategories } = trpc.documentCategory.list.useQuery();
  const createDocCategory = trpc.documentCategory.create.useMutation({ onSuccess: () => { refetchDocCategories(); toast.success("เพิ่มประเภทเอกสารสำเร็จ"); } });
  const deleteDocCategory = trpc.documentCategory.delete.useMutation({ onSuccess: () => { refetchDocCategories(); toast.success("ลบประเภทเอกสารสำเร็จ"); } });
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [showNewDocCategory, setShowNewDocCategory] = useState(false);
  const [newDocCategoryLabel, setNewDocCategoryLabel] = useState("");
  const [confirmDeleteDocCategory, setConfirmDeleteDocCategory] = useState<{ id: number; label: string } | null>(null);
  const [docCategoryDropdownOpen, setDocCategoryDropdownOpen] = useState(false);
  const [docCategory, setDocCategory] = useState("other");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<{ id: number; label: string } | null>(null);

  // Build category map: merge static fallback + DB categories
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = { ...PHOTO_CATEGORY_MAP };
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

  // Group photos by category
  const photosByCategory = useMemo(() => {
    if (!photos) return {};
    const grouped: Record<string, any[]> = {};
    for (const photo of photos as any[]) {
      const cat = photo.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(photo);
    }
    return grouped;
  }, [photos]);

  // All categories (from DB + any that photos have)
  const allPhotoCategories = useMemo(() => {
    const cats: string[] = [];
    const seen = new Set<string>();
    // First: categories from DB in sortOrder
    if (photoCategories) {
      for (const cat of photoCategories) {
        if (!seen.has(cat.key)) { cats.push(cat.key); seen.add(cat.key); }
      }
    }
    // Then: any categories from existing photos not in DB
    if (photos) {
      for (const photo of photos as any[]) {
        if (photo.category && !seen.has(photo.category)) {
          cats.push(photo.category); seen.add(photo.category);
        }
      }
    }
    return cats;
  }, [photoCategories, photos]);

  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>("other");
  const [uploadCaption, setUploadCaption] = useState("");

  const startUpload = (categoryKey: string) => {
    setUploadCategory(categoryKey);
    setUploadCaption("");
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

  // Inline edit state for tech card
  const [editingTech, setEditingTech] = useState(false);
  const [techForm, setTechForm] = useState<any>({});
  // Inline edit state for customer card
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState<any>({});

  const updateSurvey = trpc.survey.update.useMutation({
    onSuccess: () => { toast.success("อัพเดทสำเร็จ"); setShowEditStatus(false); setEditingTech(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCustomer = trpc.customer.update.useMutation({
    onSuccess: () => { toast.success("บันทึกข้อมูลลูกค้าสำเร็จ"); setEditingCustomer(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadPhoto = trpc.photo.upload.useMutation({
    onSuccess: () => { toast.success("อัพโหลดรูปสำเร็จ"); refetchPhotos(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePhoto = trpc.photo.delete.useMutation({
    onSuccess: () => { toast.success("ลบรูปสำเร็จ"); refetchPhotos(); },
  });

  const updateCaption = trpc.photo.updateCaption.useMutation({
    onSuccess: () => { refetchPhotos(); setEditingCaptionId(null); },
  });

  const uploadDoc = trpc.document.upload.useMutation({
    onSuccess: () => { toast.success("อัพโหลดเอกสารสำเร็จ"); refetchDocs(); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDoc = trpc.document.delete.useMutation({
    onSuccess: () => { toast.success("ลบเอกสารสำเร็จ"); refetchDocs(); },
  });

  const createFollowUp = trpc.followUp.create.useMutation({
    onSuccess: () => { toast.success("สร้าง Follow-up สำเร็จ"); setShowAddFollowUp(false); refetchFollowUps(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateFollowUp = trpc.followUp.update.useMutation({
    onSuccess: () => { toast.success("อัพเดท Follow-up สำเร็จ"); refetchFollowUps(); },
  });

  const createShareLink = trpc.shareLink.create.useMutation({
    onSuccess: () => { toast.success("สร้างลิงก์แชร์สำเร็จ"); refetchLinks(); refetchSurveyLinks(); refetchInstallLinks(); },
  });

  const revokeShareLink = trpc.shareLink.revoke.useMutation({
    onSuccess: () => { toast.success("ยกเลิกลิงก์สำเร็จ"); refetchLinks(); refetchSurveyLinks(); refetchInstallLinks(); },
  });

  const completeSurvey = trpc.survey.completeSurvey.useMutation({
    onSuccess: () => { toast.success("สำรวจเสร็จสิ้นแล้ว"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const closeToInstallation = trpc.survey.closeToInstallation.useMutation({
    onSuccess: () => { toast.success("ปิดหน้างาน — เปลี่ยนเป็นรอการติดตั้ง"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const [showCompleteSurveyConfirm, setShowCompleteSurveyConfirm] = useState(false);
  const [showCloseToInstallConfirm, setShowCloseToInstallConfirm] = useState(false);
  const [installDate, setInstallDate] = useState<Date | undefined>(undefined);

  // Postpone/Cancel state
  const [showPostponeDialog, setShowPostponeDialog] = useState<"survey" | "install" | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<"survey" | "install" | null>(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [newPostponeDate, setNewPostponeDate] = useState<Date | undefined>(undefined);

  // Postpone/Cancel mutations
  const postponeSurvey = trpc.survey.postponeSurvey.useMutation({
    onSuccess: () => { toast.success("เลื่อนสำรวจสำเร็จ"); setShowPostponeDialog(null); setPostponeReason(""); refetch(); refetchLogs(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelSurveyMut = trpc.survey.cancelSurvey.useMutation({
    onSuccess: () => { toast.success("ยกเลิกสำรวจสำเร็จ"); setShowCancelDialog(null); setCancelReason(""); refetch(); refetchLogs(); },
    onError: (e: any) => toast.error(e.message),
  });
  const postponeInstallation = trpc.survey.postponeInstallation.useMutation({
    onSuccess: () => { toast.success("เลื่อนติดตั้งสำเร็จ"); setShowPostponeDialog(null); setPostponeReason(""); setNewPostponeDate(undefined); refetch(); refetchLogs(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelInstallation = trpc.survey.cancelInstallation.useMutation({
    onSuccess: () => { toast.success("ยกเลิกติดตั้งสำเร็จ"); setShowCancelDialog(null); setCancelReason(""); refetch(); refetchLogs(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reopenSurvey = trpc.survey.reopenSurvey.useMutation({
    onSuccess: () => { toast.success("เปิดงานสำรวจใหม่สำเร็จ"); refetch(); refetchLogs(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reopenInstallation = trpc.survey.reopenInstallation.useMutation({
    onSuccess: () => { toast.success("เปิดงานติดตั้งใหม่สำเร็จ"); refetch(); refetchLogs(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Postpone/Cancel logs
  const { data: postponeLogs, refetch: refetchLogs } = trpc.survey.getPostponeCancelLogs.useQuery({ surveyId });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [photoCategory, setPhotoCategory] = useState("other");
  const { state: uploadState, uploadFiles: uploadWithRetry, retryFailed, clearState: clearUploadState } = useUploadWithRetry();

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !data) return;
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
          customerId: data.customer.id,
          fileName: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${item.fileName}`,
          category: uploadCategory as any,
          caption: uploadCaption.trim() || undefined,
          base64Data: item.base64,
          mimeType: item.originalFile?.type?.startsWith("image/") ? "image/jpeg" : (item.originalFile?.type || "image/jpeg"),
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
  }, [data, uploadCategory, surveyId, uploadPhoto, uploadWithRetry]);

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("ขนาดไฟล์เกิน 16MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const ext = file.name.split(".").pop()?.toLowerCase();
      uploadDoc.mutate({
        surveyId,
        customerId: data.customer.id,
        fileName: `${Date.now()}-${file.name}`,
        fileType: docCategory,
        base64Data: base64,
        mimeType: file.type,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [data, surveyId, uploadDoc]);

  if (isLoading) {
    return <DashboardLayout><div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div></DashboardLayout>;
  }

  if (!data) {
    return <DashboardLayout><div className="text-center py-16"><p className="text-muted-foreground">ไม่พบข้อมูลงานสำรวจ</p><Button variant="outline" onClick={() => setLocation("/surveys")} className="mt-4">กลับ</Button></div></DashboardLayout>;
  }

  const { survey: s, customer: c } = data;
  const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/surveys")} className="shrink-0 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
              <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-xs font-medium border-0`}>
                {statusInfo.label}
              </Badge>
              <span className="text-sm text-muted-foreground">#{s.id}</span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
              {s.scheduledDate && (
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(s.scheduledDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}{s.scheduledTime ? ` ${s.scheduledTime} น.` : ""}</span>
              )}
              {c.phone && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{formatPhone(c.phone)}</span>}
              {c.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.province || c.address}</span>}
              {s.installationDate && (
                <span className="flex items-center gap-1 text-green-700">
                  <Wrench className="h-3.5 w-3.5" />
                  นัดติดตั้ง: {new Date(s.installationDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <CreateOrOpenDeliveryButton surveyId={surveyId} />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                try {
                  toast.info("กำลังสร้าง PDF...");
                  const { exportSurveyPDF } = await getPdfExport();
                  await exportSurveyPDF(
                    {
                      id: s.id, status: s.status, scheduledDate: s.scheduledDate,
                      systemSize: s.systemSize, panelCount: s.panelCount,
                      panelBrand: s.panelBrand, inverterModel: s.inverterModel,
                      quotedPrice: s.quotedPrice, systemType: s.systemType,
                      needBattery: s.needBattery, needOptimizer: s.needOptimizer,
                      surveyNotes: s.surveyNotes,
                    },
                    {
                      name: c.name, phone: c.phone, email: c.email,
                      fullAddress: c.fullAddress, subDistrict: c.subDistrict,
                      district: c.district, province: c.province,
                      postalCode: c.postalCode, electricityBill: c.electricityBill,
                      roofType: c.roofType, roofArea: c.roofArea,
                      phaseType: c.phaseType, meterSize: c.meterSize, notes: c.notes,
                    },
                    (photos || []).map((p: any) => ({ url: p.url, category: p.category, caption: p.caption })),
                    categoryMap,
                    undefined,
                    imageProxyFn,
                    companyInfoForPdf,
                    categoryOrder,
                    surveyDocSetting?.documentNumber,
                  );
                  toast.success("Export PDF สำเร็จ");
                } catch (err: any) {
                  toast.error(err?.message || "Export PDF ล้มเหลว");
                }
              }}
            >
              <FileDown className="h-3.5 w-3.5" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEditStatus(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> แก้ไข
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setActiveTab("share"); setShowShareDialog(true); }} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> แชร์
            </Button>
          </div>
        </div>

        {/* แก้ไขล่าสุด + ปุ่มสำรวจเสร็จ/ปิดหน้างาน */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 inline mr-1" />
                แก้ไขล่าสุด: {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "ไม่มีข้อมูล"}
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* ปุ่มสำรวจเสร็จสิ้น — แสดงเฉพาะเมื่อยังไม่ได้สำรวจ (pending/scheduled/in_progress) */}
                {(s.status === "pending" || s.status === "scheduled" || s.status === "in_progress") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => setShowCompleteSurveyConfirm(true)}
                    disabled={completeSurvey.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" /> สำรวจเสร็จสิ้น
                  </Button>
                )}
                {/* ปุ่มนัดติดตั้ง — แสดงเมื่อสถานะเป็น รอติดตาม/สำรวจเสร็จ/เสนอราคา/เจรจา */}
                {(s.status === "follow_up" || s.status === "surveyed" || s.status === "quoted" || s.status === "negotiating") && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowCloseToInstallConfirm(true)}
                    disabled={closeToInstallation.isPending}
                  >
                    <Calendar className="h-4 w-4" /> นัดติดตั้ง
                  </Button>
                )}
                {s.status === "follow_up" && (
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 border-0">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> สำรวจเสร็จแล้ว
                  </Badge>
                )}
                {s.status === "surveyed" && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-0">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> สำรวจเสร็จแล้ว
                  </Badge>
                )}
                {s.status === "won" && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0">
                    <Wrench className="h-3.5 w-3.5 mr-1" /> รอการติดตั้ง
                  </Badge>
                )}
                {/* ปุ่มเลื่อน/ยกเลิกสำรวจ */}
                {(s.status !== "cancelled" && s.status !== "postponed" && s.status !== "won" && s.status !== "lost") && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => setShowPostponeDialog("survey")}>
                      <PauseCircle className="h-4 w-4" /> เลื่อนสำรวจ
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setShowCancelDialog("survey")}>
                      <XCircle className="h-4 w-4" /> ยกเลิกสำรวจ
                    </Button>
                  </>
                )}
                {/* ปุ่มเลื่อน/ยกเลิกติดตั้ง */}
                {(s.installationStatus === "waiting" || s.installationStatus === "in_progress") && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => setShowPostponeDialog("install")}>
                      <PauseCircle className="h-4 w-4" /> เลื่อนติดตั้ง
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setShowCancelDialog("install")}>
                      <XCircle className="h-4 w-4" /> ยกเลิกติดตั้ง
                    </Button>
                  </>
                )}
                {/* ปุ่มเปิดงานใหม่ */}
                {(s.status === "cancelled" || s.status === "postponed") && (
                  <Button size="sm" variant="outline" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50" onClick={() => reopenSurvey.mutate({ id: surveyId })} disabled={reopenSurvey.isPending}>
                    <RotateCcw className="h-4 w-4" /> เปิดงานสำรวจใหม่
                  </Button>
                )}
                {(s.installationStatus === "cancelled" || s.installationStatus === "postponed") && (
                  <Button size="sm" variant="outline" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50" onClick={() => reopenInstallation.mutate({ id: surveyId })} disabled={reopenInstallation.isPending}>
                    <RotateCcw className="h-4 w-4" /> เปิดงานติดตั้งใหม่
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location link */}
        {(c.latitude && c.longitude || (c.address && c.address.startsWith('http'))) && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <a
                href={c.address && c.address.startsWith('http') ? c.address : `https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 active:bg-primary/30 transition-colors touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <MapPin className="h-4 w-4" /> เปิด Google Maps
              </a>
            </CardContent>
          </Card>
        )}

        {/* Technical Info Card - Always Editable (click to edit each field) */}
        <TechInfoCard survey={s} surveyId={surveyId} updateSurvey={updateSurvey} onRefetch={refetch} />

        {/* Template Fields Card - from linked template */}
        {c.source && <TemplateFieldsCard sourceName={c.source} surveyId={surveyId} />}

        {/* Customer Info Card - Always Editable */}
        <CustomerInfoCard customer={c} updateCustomer={updateCustomer} />

        {/* Workflow / Team Card - Editable */}
        <TeamCard data={data} surveyId={surveyId} teamAdminSenders={teamAdminSenders || []} teamSurveyors={teamSurveyors || []} teamClosers={teamClosers || []} refetch={refetch} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="photos" className="gap-1.5"><Camera className="h-3.5 w-3.5" /> รูปภาพ ({photos?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> เอกสาร ({documents?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="followup" className="gap-1.5"><PhoneCall className="h-3.5 w-3.5" /> Follow-up ({followUps?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="share" className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> แชร์ ({shareLinks?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="delivery" className="gap-1.5"><Package className="h-3.5 w-3.5" /> ส่งมอบงาน</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> ประวัติ ({postponeLogs?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Photos Tab - Grouped by Category */}
          <TabsContent value="photos" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold">รูปภาพหน้างาน</CardTitle>
                  <div className="flex items-center gap-2">
                    {photos && photos.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={isDownloadingAll}
                        onClick={async () => {
                          if (!photos || photos.length === 0) return;
                          setIsDownloadingAll(true);
                          setDownloadProgress({ current: 0, total: photos.length });
                          try {
                            // Use server-side ZIP generation to avoid browser fetch issues
                            const customerName = encodeURIComponent(c.name);
                            const downloadUrl = `/api/photos/download-zip/${surveyId}?customerName=${customerName}`;
                            
                            // Use XMLHttpRequest for progress tracking
                            const blob = await new Promise<Blob>((resolve, reject) => {
                              const xhr = new XMLHttpRequest();
                              xhr.open('GET', downloadUrl, true);
                              xhr.responseType = 'blob';
                              xhr.onprogress = (event) => {
                                if (event.lengthComputable) {
                                  const percent = Math.round((event.loaded / event.total) * 100);
                                  setDownloadProgress({ current: percent, total: 100 });
                                }
                              };
                              xhr.onload = () => {
                                if (xhr.status === 200) {
                                  const successCount = xhr.getResponseHeader('X-Photos-Success');
                                  const totalCount = xhr.getResponseHeader('X-Photos-Total');
                                  if (successCount && totalCount) {
                                    toast.success(`ดาวน์โหลด ${successCount}/${totalCount} รูปสำเร็จ`);
                                  } else {
                                    toast.success('ดาวน์โหลดสำเร็จ');
                                  }
                                  resolve(xhr.response);
                                } else {
                                  reject(new Error(`HTTP ${xhr.status}`));
                                }
                              };
                              xhr.onerror = () => reject(new Error('Network error'));
                              xhr.send();
                            });
                            
                            setDownloadProgress({ current: 100, total: 100 });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            const sanitize = (s: string) => s.replace(/[\/:\*\?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
                            a.download = `photos-${sanitize(c.name)}-${new Date().toISOString().slice(0, 10)}.zip`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            toast.error('เกิดข้อผิดพลาดในการดาวน์โหลด');
                          } finally {
                            setIsDownloadingAll(false);
                            setDownloadProgress({ current: 0, total: 0 });
                          }
                        }}
                      >
                        <FolderDown className="h-3.5 w-3.5" />
                        {isDownloadingAll
                          ? `กำลังโหลด ${downloadProgress.current}%`
                          : `ดาวน์โหลดทั้งหมด (${photos.length})`}
                      </Button>
                    )}
                    {isDownloadingAll && (
                      <div className="w-full mt-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span>กำลังดาวน์โหลดรูปภาพ ({photos?.length || 0} รูป)...</span>
                          <span className="ml-auto font-medium">{downloadProgress.current}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${downloadProgress.current}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoUpload} />
                    <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={handlePhotoUpload} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {allPhotoCategories.length > 0 ? (
                  <div className="space-y-6">
                    {allPhotoCategories.map((catKey) => {
                      const catPhotos = photosByCategory[catKey] || [];
                      return (
                        <div key={catKey}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Camera className="h-4 w-4 text-muted-foreground" />
                              {categoryMap[catKey] || catKey}
                              <Badge variant="secondary" className="text-[10px]">{catPhotos.length}</Badge>
                            </h4>
                            <div className="flex items-center gap-1.5">
                              <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={() => startUpload(catKey)} disabled={uploadState.isUploading}>
                                <Camera className="h-3 w-3" /> ถ่ายรูป
                              </Button>
                              <Button size="sm" className="text-xs gap-1 h-7" onClick={() => startUpload(catKey)} disabled={uploadState.isUploading}>
                                <Upload className="h-3 w-3" /> เลือกรูป
                              </Button>
                            </div>
                          </div>
                          {catPhotos.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {catPhotos.map((photo: any) => (
                                <div key={photo.id} className="flex flex-col">
                                  <div className="group relative rounded-lg overflow-hidden bg-muted aspect-square">
                                    <img src={photo.url} alt={photo.caption || photo.fileName} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxImg(photo.url)} loading="lazy" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end">
                                      <div className="w-full p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={() => setLightboxImg(photo.url)}>
                                            <Eye className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/90 hover:bg-blue-100" onClick={(e) => { e.stopPropagation(); setEditingCaptionId(photo.id); setCaptionText(photo.caption || ""); }}>
                                            <MessageSquare className="h-3 w-3 text-blue-600" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/90 hover:bg-red-100" onClick={(e) => { e.stopPropagation(); setConfirmDeletePhoto(photo.id); }}>
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {/* Caption display/edit */}
                                  {editingCaptionId === photo.id ? (
                                    <div className="mt-1 flex gap-1">
                                      <Input
                                        value={captionText}
                                        onChange={(e) => setCaptionText(e.target.value)}
                                        placeholder="หมายเหตุ..."
                                        className="h-7 text-xs"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") { updateCaption.mutate({ id: photo.id, caption: captionText }); }
                                          if (e.key === "Escape") { setEditingCaptionId(null); }
                                        }}
                                      />
                                      <Button size="icon" className="h-7 w-7 shrink-0" onClick={() => updateCaption.mutate({ id: photo.id, caption: captionText })} disabled={updateCaption.isPending}>
                                        <CheckCircle2 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingCaptionId(null)}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : photo.caption ? (
                                    <p className="mt-1 text-xs text-muted-foreground truncate cursor-pointer hover:text-foreground" onClick={() => { setEditingCaptionId(photo.id); setCaptionText(photo.caption || ""); }} title={photo.caption}>
                                      <MessageSquare className="h-3 w-3 inline mr-1" />{photo.caption}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 rounded-lg bg-muted/30 border border-dashed">
                              <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              <p className="text-xs text-muted-foreground">ยังไม่มีรูปในหมวดนี้</p>
                              <Button variant="outline" size="sm" className="mt-2 text-xs gap-1" onClick={() => startUpload(catKey)} disabled={uploadState.isUploading}>
                                <Upload className="h-3 w-3" /> อัปโหลดรูป
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มีรูปภาพ</p>
                    <p className="text-xs mt-1">กดปุ่มถ่ายรูปหรือเลือกรูปในแต่ละหมวดเพื่อเพิ่มรูปภาพหน้างาน</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold">เอกสาร</CardTitle>
                  <div className="flex items-center gap-2">
                    {/* Document Category Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setDocCategoryDropdownOpen(!docCategoryDropdownOpen)}
                        className="flex items-center gap-2 h-8 px-3 rounded-md border bg-background text-sm min-w-[140px] justify-between"
                      >
                        <span className="truncate">{(docCategories || []).find((cat: any) => cat.key === docCategory)?.label || DOC_TYPE_MAP[docCategory] || docCategory}</span>
                        <span className="text-muted-foreground text-xs">▼</span>
                      </button>
                      {docCategoryDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border bg-popover shadow-lg py-1 max-h-60 overflow-y-auto">
                          {(docCategories || []).map((cat: any) => (
                            <div
                              key={cat.id}
                              className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent ${docCategory === cat.key ? 'bg-accent font-medium' : ''}`}
                              onClick={() => { setDocCategory(cat.key); setDocCategoryDropdownOpen(false); }}
                            >
                              <span>{cat.label}</span>
                              {cat.key !== 'other' && (
                                <button
                                  className="ml-2 p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteDocCategory({ id: cat.id, label: cat.label }); setDocCategoryDropdownOpen(false); }}
                                  title="ลบประเภทนี้"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                          <div className="border-t my-1" />
                          <div
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-accent text-primary font-medium"
                            onClick={() => { setShowNewDocCategory(true); setDocCategoryDropdownOpen(false); }}
                          >
                            + เพิ่มประเภทใหม่
                          </div>
                        </div>
                      )}
                    </div>
                    <Button size="sm" onClick={() => docInputRef.current?.click()} className="gap-1.5" disabled={uploadDoc.isPending}>
                      <Upload className="h-3.5 w-3.5" /> {uploadDoc.isPending ? "กำลังอัพ..." : "อัพโหลด"}
                    </Button>
                    <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" hidden onChange={handleDocUpload} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {documents && documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.fileName.replace(/^\d+-/, "")}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px]">{(docCategories || []).find((cat: any) => cat.key === doc.fileType)?.label || DOC_TYPE_MAP[doc.fileType] || doc.fileType}</Badge>
                            {doc.fileSize && <span className="text-[10px] text-muted-foreground">{doc.fileSize > 1048576 ? `${(doc.fileSize / 1048576).toFixed(1)} MB` : `${(doc.fileSize / 1024).toFixed(0)} KB`}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(doc.url, "_blank")}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => setConfirmDeleteDoc(doc.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มีเอกสาร</p>
                    <p className="text-xs mt-1">อัพโหลดใบเสนอราคา หรือผล Simulation</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Follow-up Tab */}
          <TabsContent value="followup" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Follow-up</CardTitle>
                  <Button size="sm" onClick={() => setShowAddFollowUp(true)} className="gap-1.5">
                    <PhoneCall className="h-3.5 w-3.5" /> เพิ่ม Follow-up
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {followUps && followUps.length > 0 ? (
                  <div className="space-y-3">
                    {followUps.map((fu: any) => {
                      const isOverdue = fu.status === "pending" && fu.dueDate < Date.now();
                      return (
                        <div key={fu.id} className={`p-4 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50/50" : fu.status === "completed" ? "border-green-200 bg-green-50/50" : "border-border bg-muted/30"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={isOverdue ? "destructive" : fu.status === "completed" ? "default" : "secondary"} className="text-[10px]">
                                  {isOverdue ? "เลยกำหนด" : fu.status === "completed" ? "เสร็จสิ้น" : fu.status === "cancelled" ? "ยกเลิก" : "รอดำเนินการ"}
                                </Badge>
                                {fu.method && <Badge variant="outline" className="text-[10px]">{FOLLOW_UP_METHOD_MAP[fu.method] || fu.method}</Badge>}
                              </div>
                              <p className="text-sm mt-2">{fu.notes || "ไม่มีรายละเอียด"}</p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                กำหนด: {new Date(fu.dueDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                              {fu.result && <p className="text-xs text-muted-foreground mt-1">ผลลัพธ์: {fu.result}</p>}
                            </div>
                            {fu.status === "pending" && (
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                                  const result = prompt("ผลลัพธ์การ Follow-up:");
                                  if (result !== null) {
                                    updateFollowUp.mutate({ id: fu.id, status: "completed", result });
                                  }
                                }}>
                                  <CheckCircle2 className="h-3 w-3" /> เสร็จ
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <PhoneCall className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มี Follow-up</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Share Tab */}
          <TabsContent value="share" className="mt-4 space-y-4">
            {/* Survey Link Section */}
            <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-500" /> ลิงก์สำรวจ
                    <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">สำหรับเจ้าหน้าที่สำรวจ</Badge>
                  </CardTitle>
                  <Button size="sm" onClick={() => createShareLink.mutate({ surveyId, linkType: "survey", expiresInDays: 3 })} className="gap-1.5 bg-blue-600 hover:bg-blue-700" disabled={createShareLink.isPending}>
                    <Link2 className="h-3.5 w-3.5" /> สร้างลิงก์สำรวจ
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">เจ้าหน้าที่สำรวจสามารถอัพรูปหน้างาน + กรอกข้อมูลเทคนิค + กดสำรวจเสร็จสิ้นได้</p>
              </CardHeader>
              <CardContent>
                <ShareLinkList links={surveyShareLinks || []} linkType="survey" onRevoke={(id) => revokeShareLink.mutate({ id })} />
              </CardContent>
            </Card>

            {/* Installation Link Section */}
            <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-amber-500" /> ลิงก์ติดตั้ง
                    <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">สำหรับช่างติดตั้ง</Badge>
                  </CardTitle>
                  <Button size="sm" onClick={() => createShareLink.mutate({ surveyId, linkType: "installation", expiresInDays: 14 })} className="gap-1.5 bg-amber-600 hover:bg-amber-700" disabled={createShareLink.isPending}>
                    <Link2 className="h-3.5 w-3.5" /> สร้างลิงก์ติดตั้ง
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">ช่างติดตั้งสามารถอัพรูปติดตั้ง + กดส่งมอบงานได้</p>
              </CardHeader>
              <CardContent>
                <ShareLinkList links={installShareLinks || []} linkType="installation" onRevoke={(id) => revokeShareLink.mutate({ id })} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delivery Tab */}
          <TabsContent value="delivery" className="mt-4">
            <DeliveryTab surveyId={surveyId} installationStatus={s.installationStatus} surveyData={s} customerData={c} />
          </TabsContent>

          {/* History Tab - ประวัติเลื่อน/ยกเลิก */}
          <TabsContent value="history" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">ประวัติการเลื่อน/ยกเลิก</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {(!postponeLogs || postponeLogs.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีประวัติการเลื่อน/ยกเลิก</p>
                ) : (
                  <div className="space-y-3">
                    {postponeLogs.map((log: any) => {
                      const isPostpone = log.action.includes("postpone");
                      const isSurvey = log.action.includes("survey");
                      const actionLabel = isPostpone
                        ? (isSurvey ? "เลื่อนสำรวจ" : "เลื่อนติดตั้ง")
                        : (isSurvey ? "ยกเลิกสำรวจ" : "ยกเลิกติดตั้ง");
                      const roleLabel = log.actionByRole === "admin" ? "แอดมิน" : log.actionByRole === "surveyor" ? "เซลล์" : "ช่าง";
                      return (
                        <div key={log.id} className={`flex gap-3 p-3 rounded-lg border ${isPostpone ? 'border-yellow-200 bg-yellow-50/50' : 'border-red-200 bg-red-50/50'}`}>
                          <div className={`shrink-0 mt-0.5 ${isPostpone ? 'text-yellow-600' : 'text-red-600'}`}>
                            {isPostpone ? <PauseCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${isPostpone ? 'text-yellow-700' : 'text-red-700'}`}>{actionLabel}</span>
                              <Badge variant="secondary" className="text-xs">{roleLabel}: {log.actionBy}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1"><span className="font-medium text-foreground">สาเหตุ:</span> {log.reason}</p>
                            {(log.previousDate || log.newDate) && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                                {log.previousDate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(log.previousDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                )}
                                {log.previousDate && log.newDate && (
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {log.newDate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(log.newDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                )}
                                {log.previousDate && !log.newDate && (
                                  <>
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground italic">รอนัดใหม่</span>
                                  </>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1.5">{new Date(log.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Survey Notes */}
        {s.surveyNotes && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">หมายเหตุงานสำรวจ</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.surveyNotes}</p></CardContent>
          </Card>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </Button>
          <img src={lightboxImg} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Edit Status Dialog */}
      <EditSurveyDialog open={showEditStatus} onOpenChange={setShowEditStatus} survey={s} adminSenders={teamAdminSenders || []} surveyors={teamSurveyors || []} closers={teamClosers || []} assignments={(data as any)?.assignments || []} onSubmit={(d: any) => updateSurvey.mutate({ id: surveyId, ...d })} loading={updateSurvey.isPending} customStatus={(data as any)?.customStatus || null} onRefetch={refetch} />

      {/* Confirm Delete Photo Dialog */}
      <Dialog open={confirmDeletePhoto !== null} onOpenChange={() => setConfirmDeletePhoto(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรูปภาพ</DialogTitle>
            <DialogDescription>รูปภาพนี้จะถูกลบออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeletePhoto(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => { if (confirmDeletePhoto) { deletePhoto.mutate({ id: confirmDeletePhoto }); setConfirmDeletePhoto(null); } }} disabled={deletePhoto.isPending}>ลบรูปภาพ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Document Dialog */}
      <Dialog open={confirmDeleteDoc !== null} onOpenChange={() => setConfirmDeleteDoc(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบเอกสาร</DialogTitle>
            <DialogDescription>เอกสารนี้จะถูกลบออกจากระบบอย่างถาวร ไม่สามารถกู้คืนได้</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteDoc(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => { if (confirmDeleteDoc) { deleteDoc.mutate({ id: confirmDeleteDoc }); setConfirmDeleteDoc(null); } }} disabled={deleteDoc.isPending}>ลบเอกสาร</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Options Dialog (camera vs gallery) */}
      <Dialog open={showUploadOptions} onOpenChange={setShowUploadOptions}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center text-sm">เลือกวิธีอัปโหลดรูป</DialogTitle>
            <DialogDescription className="text-center text-xs">
              หมวด: {categoryMap[uploadCategory] || uploadCategory}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">หมายเหตุ (ไม่บังคับ)</label>
              <Input
                placeholder="เช่น มุมหลังคาด้านทิศตะวันออก"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button variant="outline" className="w-full gap-2 h-12" onClick={startCameraUpload}>
              <Camera className="h-5 w-5" /> ถ่ายรูปจากกล้อง
            </Button>
            <Button variant="outline" className="w-full gap-2 h-12" onClick={startGalleryUpload}>
              <Image className="h-5 w-5" /> เลือกรูปจากแกลเลอรี
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>เพิ่มประเภทรูปภาพใหม่</DialogTitle>
            <DialogDescription>ระบุชื่อประเภทรูปภาพที่ต้องการเพิ่ม</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ชื่อประเภท (ภาษาไทย)</Label>
              <Input
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                placeholder="เช่น รูปหลังคารายละเอียด"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewCategory(false); setNewCategoryLabel(""); }}>ยกเลิก</Button>
            <Button
              onClick={() => {
                if (!newCategoryLabel.trim()) { toast.error("กรุณาระบุชื่อประเภท"); return; }
                const key = newCategoryLabel.trim().toLowerCase().replace(/[^a-z0-9฀-๿]+/g, "_").replace(/^_|_$/g, "") || `custom_${Date.now()}`;
                createCategory.mutate({ key, label: newCategoryLabel.trim(), sortOrder: 50 }, {
                  onSuccess: () => { setPhotoCategory(key); setShowNewCategory(false); setNewCategoryLabel(""); }
                });
              }}
              disabled={createCategory.isPending}
            >
              {createCategory.isPending ? "กำลังเพิ่ม..." : "เพิ่มประเภท"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Category Dialog */}
      <AlertDialog open={confirmDeleteCategory !== null} onOpenChange={() => setConfirmDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบประเภทรูปภาพ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบประเภท "{confirmDeleteCategory?.label}" หรือไม่? รูปภาพที่อัพโหลดไปแล้วจะยังคงอยู่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteCategory) {
                  deleteCategory.mutate({ id: confirmDeleteCategory.id });
                  if (photoCategory === confirmDeleteCategory.label) setPhotoCategory("other");
                  setConfirmDeleteCategory(null);
                }
              }}
            >
              ลบประเภท
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Document Category Dialog */}
      <Dialog open={showNewDocCategory} onOpenChange={setShowNewDocCategory}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>เพิ่มประเภทเอกสารใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="ชื่อประเภท เช่น ใบรับรอง"
              value={newDocCategoryLabel}
              onChange={(e) => setNewDocCategoryLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDocCategoryLabel.trim()) {
                  const key = newDocCategoryLabel.trim().toLowerCase().replace(/[^a-z0-9฀-๿]/g, '_').replace(/_+/g, '_');
                  createDocCategory.mutate({ key: `custom_doc_${Date.now()}`, label: newDocCategoryLabel.trim(), sortOrder: (docCategories?.length || 0) + 1 });
                  setNewDocCategoryLabel("");
                  setShowNewDocCategory(false);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewDocCategory(false)}>ยกเลิก</Button>
              <Button size="sm" disabled={!newDocCategoryLabel.trim()} onClick={() => {
                createDocCategory.mutate({ key: `custom_doc_${Date.now()}`, label: newDocCategoryLabel.trim(), sortOrder: (docCategories?.length || 0) + 1 });
                setNewDocCategoryLabel("");
                setShowNewDocCategory(false);
              }}>เพิ่ม</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Document Category */}
      <AlertDialog open={!!confirmDeleteDocCategory} onOpenChange={(open) => !open && setConfirmDeleteDocCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบประเภทเอกสาร</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบประเภท "{confirmDeleteDocCategory?.label}" หรือไม่? เอกสารที่อัพโหลดไปแล้วจะยังคงอยู่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteDocCategory) {
                  deleteDocCategory.mutate({ id: confirmDeleteDocCategory.id });
                  if (docCategory === confirmDeleteDocCategory.label) setDocCategory("other");
                  setConfirmDeleteDocCategory(null);
                }
              }}
            >
              ลบประเภท
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Follow-up Dialog */}
      <AddFollowUpDialog open={showAddFollowUp} onOpenChange={setShowAddFollowUp} surveyId={surveyId} customerId={c.id} surveyors={teamSurveyors || []} onSubmit={(d: any) => createFollowUp.mutate(d)} loading={createFollowUp.isPending} />

      {/* Confirm สำรวจเสร็จสิ้น Dialog */}
      <AlertDialog open={showCompleteSurveyConfirm} onOpenChange={setShowCompleteSurveyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันสำรวจเสร็จสิ้น</AlertDialogTitle>
            <AlertDialogDescription>
              สถานะจะเปลี่ยนเป็น "สำรวจเสร็จ" รูปและข้อมูลยังสามารถแก้ไขได้ตลอด
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => { completeSurvey.mutate({ id: surveyId }); setShowCompleteSurveyConfirm(false); }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> สำรวจเสร็จสิ้น
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* นัดติดตั้ง Dialog พร้อมเลือกวันที่ */}
      <Dialog open={showCloseToInstallConfirm} onOpenChange={(open) => { setShowCloseToInstallConfirm(open); if (!open) setInstallDate(undefined); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" /> นัดวันติดตั้ง</DialogTitle>
            <DialogDescription>
              เลือกวันที่นัดติดตั้ง สถานะจะเปลี่ยนเป็น "ปิดการขาย" และสร้างงานติดตั้งอัตโนมัติ
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">วันที่นัดติดตั้ง <span className="text-red-500">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="h-4 w-4 mr-2" />
                  {installDate ? installDate.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : <span className="text-muted-foreground">เลือกวันที่...</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI
                  mode="single"
                  selected={installDate}
                  onSelect={setInstallDate}
                  disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCloseToInstallConfirm(false); setInstallDate(undefined); }}>ยกเลิก</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              disabled={!installDate || closeToInstallation.isPending}
              onClick={() => {
                if (!installDate) return;
                closeToInstallation.mutate({ id: surveyId, installationDate: installDate.getTime() });
                setShowCloseToInstallConfirm(false);
                setInstallDate(undefined);
              }}
            >
              <Calendar className="h-4 w-4" /> ยืนยันนัดติดตั้ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Postpone Dialog */}
      <Dialog open={showPostponeDialog !== null} onOpenChange={(open) => { if (!open) { setShowPostponeDialog(null); setPostponeReason(""); setNewPostponeDate(undefined); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PauseCircle className="h-5 w-5 text-yellow-600" /> {showPostponeDialog === "survey" ? "เลื่อนสำรวจ" : "เลื่อนติดตั้ง"}</DialogTitle>
            <DialogDescription>
              {showPostponeDialog === "survey" ? "สถานะจะเปลี่ยนเป็น \"เลื่อนสำรวจ\" รอนัดวันใหม่" : "สถานะติดตั้งจะเปลี่ยนเป็น \"เลื่อนติดตั้ง\" สามารถเลือกวันใหม่ได้"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">สาเหตุ <span className="text-red-500">*</span></Label>
              <Textarea placeholder="ระบุสาเหตุที่ต้องเลื่อน..." value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} rows={3} />
            </div>
            {showPostponeDialog === "install" && (
              <div>
                <Label className="text-sm font-medium mb-2 block">วันติดตั้งใหม่ <span className="text-muted-foreground text-xs">(ถ้าทราบแล้ว)</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="h-4 w-4 mr-2" />
                      {newPostponeDate ? newPostponeDate.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : <span className="text-muted-foreground">เลือกวันที่ใหม่...</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={newPostponeDate}
                      onSelect={setNewPostponeDate}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPostponeDialog(null); setPostponeReason(""); setNewPostponeDate(undefined); }}>ยกเลิก</Button>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700 text-white gap-1.5"
              disabled={!postponeReason.trim() || postponeSurvey.isPending || postponeInstallation.isPending}
              onClick={() => {
                if (showPostponeDialog === "survey") {
                  postponeSurvey.mutate({ id: surveyId, reason: postponeReason.trim() });
                } else {
                  postponeInstallation.mutate({ id: surveyId, reason: postponeReason.trim(), newDate: newPostponeDate ? newPostponeDate.getTime() : undefined });
                }
              }}
            >
              <PauseCircle className="h-4 w-4" /> ยืนยันเลื่อน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog !== null} onOpenChange={(open) => { if (!open) { setShowCancelDialog(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" /> {showCancelDialog === "survey" ? "ยกเลิกสำรวจ" : "ยกเลิกติดตั้ง"}</DialogTitle>
            <DialogDescription>
              {showCancelDialog === "survey" ? "สถานะจะเปลี่ยนเป็น \"ยกเลิก\" สามารถเปิดใหม่ได้ภายหลัง" : "สถานะติดตั้งจะเปลี่ยนเป็น \"ยกเลิก\" สามารถเปิดใหม่ได้ภายหลัง"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">สาเหตุ <span className="text-red-500">*</span></Label>
            <Textarea placeholder="ระบุสาเหตุที่ต้องยกเลิก..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(null); setCancelReason(""); }}>ยกเลิก</Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={!cancelReason.trim() || cancelSurveyMut.isPending || cancelInstallation.isPending}
              onClick={() => {
                if (showCancelDialog === "survey") {
                  cancelSurveyMut.mutate({ id: surveyId, reason: cancelReason.trim() });
                } else {
                  cancelInstallation.mutate({ id: surveyId, reason: cancelReason.trim() });
                }
              }}
            >
              <XCircle className="h-4 w-4" /> ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </DashboardLayout>
  );
}

function CreateOrOpenDeliveryButton({ surveyId }: { surveyId: number }) {
  const [, setLocation] = useLocation();
  const { data: existingForm, isLoading } = trpc.deliveryForm.get.useQuery({ surveyId });
  const { data: checklistTemplates } = trpc.checklistTemplate.list.useQuery();
  const createForm = trpc.deliveryForm.create.useMutation({
    onSuccess: (result: any) => {
      toast.success("สร้างใบส่งมอบงานสำเร็จ");
      setLocation(`/delivery-forms/${result.id}/handover`);
    },
    onError: (err: any) => toast.error(err.message || "สร้างใบส่งมอบไม่สำเร็จ"),
  });

  const handleClick = () => {
    if (existingForm) {
      // Already has a delivery form - go to handover editor
      setLocation(`/delivery-forms/${existingForm.id}/handover`);
    } else {
      // Create new delivery form with checklist templates, then redirect
      const checklistItems = (checklistTemplates || []).flatMap((t: any) => {
        try {
          const items = JSON.parse(t.items || "[]");
          return items.map((item: any) => ({ templateId: t.id, label: item.label || item, checked: false }));
        } catch { return []; }
      });
      createForm.mutate({ surveyId, checklistItems });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
      onClick={handleClick}
      disabled={isLoading || createForm.isPending}
    >
      <FileSignature className="h-3.5 w-3.5" />
      {createForm.isPending ? "กำลังสร้าง..." : existingForm ? "จัดการส่งมอบ" : "สร้างใบส่งมอบงาน"}
    </Button>
  );
}

function EditSurveyDialog({ open, onOpenChange, survey, adminSenders, surveyors, closers, onSubmit, loading, assignments, customStatus, onRefetch }: any) {
  const [form, setForm] = useState<any>({});
  const s = survey;

  // Pre-fill form data whenever dialog opens or survey data changes
  useEffect(() => {
    if (open && s) {
      const currentAssignments = assignments || [];
      const adminSender = currentAssignments.find((a: any) => a.assignment?.role === "admin_sender");
      const surveyorsList = currentAssignments.filter((a: any) => a.assignment?.role === "surveyor");
      const closer = currentAssignments.find((a: any) => a.assignment?.role === "closer");
      setForm({
        status: s.status,
        scheduledDate: s.scheduledDate ? new Date(s.scheduledDate).toISOString().split("T")[0] : "",
        scheduledTime: s.scheduledTime || "",
        adminSenderId: adminSender?.user?.id ? String(adminSender.user.id) : "",
        surveyorIds: surveyorsList.map((a: any) => a.user?.id).filter(Boolean),
        closerId: closer?.user?.id ? String(closer.user.id) : "",
        surveyNotes: s.surveyNotes || "",
        systemSize: s.systemSize || "",
        panelCount: s.panelCount ? String(s.panelCount) : "",
        inverterModel: s.inverterModel || "",
        panelBrand: s.panelBrand || "",
        quotedPrice: s.quotedPrice || "",
        needBattery: s.needBattery || "",
        needOptimizer: s.needOptimizer || "",
        systemType: s.systemType || "",
      });
    }
  }, [open, s, assignments]);

  if (!s) return null;

  const surveyorOptions = (surveyors || []).map((m: any) => ({ id: m.id, name: m.name, role: "surveyor" }));

  const SURVEY_STATUS_FALLBACK: Record<string, { color: string; bg: string }> = {
    pending: { color: "#78716c", bg: "#f5f5f4" },
    scheduled: { color: "#1d4ed8", bg: "#eff6ff" },
    in_progress: { color: "#d97706", bg: "#fffbeb" },
    surveyed: { color: "#059669", bg: "#ecfdf5" },
    quoted: { color: "#7c3aed", bg: "#f5f3ff" },
    negotiating: { color: "#ea580c", bg: "#fff7ed" },
    won: { color: "#15803d", bg: "#dcfce7" },
    lost: { color: "#dc2626", bg: "#fef2f2" },
    cancelled: { color: "#6b7280", bg: "#f3f4f6" },
  };

  const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขงานสำรวจ</DialogTitle>
          <DialogDescription>อัพเดทข้อมูลและสถานะงานสำรวจ</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Custom Status (synced with table dropdown) */}
          <div>
            <Label>สถานะ</Label>
            <div className="mt-1.5">
              <StatusDropdown
                type="survey"
                entityId={s.id}
                currentStatusId={s.statusId || null}
                currentCustomStatus={customStatus || null}
                fallbackLabel={statusInfo.label}
                fallbackColor={SURVEY_STATUS_FALLBACK[s.status]?.color}
                fallbackBgColor={SURVEY_STATUS_FALLBACK[s.status]?.bg}
                onStatusChanged={() => { onRefetch?.(); }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">สถานะนี้จะ sync กับหน้าตารางงานสำรวจ</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>วันที่สำรวจ</Label><Input type="date" value={form.scheduledDate || ""} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></div>
            <div><Label>เวลา</Label><Input type="time" value={form.scheduledTime || ""} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} /></div>
          </div>

          {/* Workflow: 3 Roles */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Users className="h-4 w-4" /> ทีมงาน</p>
            <div>
              <Label>แอดมินผู้ส่งงาน</Label>
              <p className="text-xs text-muted-foreground mb-1">คนที่ตอบลูกค้าแล้วส่งรายชื่อมาให้สำรวจ</p>
              <Select value={form.adminSenderId || ""} onValueChange={(v) => setForm({ ...form, adminSenderId: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกแอดมิน..." /></SelectTrigger>
                <SelectContent>
                  {(adminSenders || []).map((m: any) => (<SelectItem key={m.id} value={String(m.id)}>{m.name} {m.role === "admin_sender" ? "(แอดมิน)" : m.role === "surveyor" ? "(ช่างสำรวจ)" : m.role === "closer" ? "(ผู้ปิดการขาย)" : `(${m.role})`}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ทีมสำรวจ</Label>
              <p className="text-xs text-muted-foreground mb-1">เซลล์ที่ไปสำรวจ (เลือกได้หลายคน)</p>
              <MultiUserSelect
                users={surveyorOptions}
                selectedIds={form.surveyorIds || []}
                onChange={(ids) => setForm({ ...form, surveyorIds: ids })}
                placeholder="เลือกทีมสำรวจ..."
              />
            </div>
            <div>
              <Label>ผู้ปิดการขาย</Label>
              <p className="text-xs text-muted-foreground mb-1">คนที่ปิดงานสุดท้าย (อาจไม่ใช่เซลล์)</p>
              <Select value={form.closerId || ""} onValueChange={(v) => setForm({ ...form, closerId: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกผู้ปิดการขาย..." /></SelectTrigger>
                <SelectContent>
                  {(closers || []).map((m: any) => (<SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Technical Info */}
          <div className="grid grid-cols-2 gap-4">
            <div><Label>ขนาดระบบ (kW)</Label><Input value={form.systemSize || ""} onChange={(e) => setForm({ ...form, systemSize: e.target.value })} /></div>
            <div><Label>จำนวนแผง</Label><Input type="number" value={form.panelCount || ""} onChange={(e) => setForm({ ...form, panelCount: e.target.value })} /></div>
            <div><Label>ยี่ห้อแผง</Label><Input value={form.panelBrand || ""} onChange={(e) => setForm({ ...form, panelBrand: e.target.value })} /></div>
            <div><Label>รุ่นอินเวอร์เตอร์</Label><Input value={form.inverterModel || ""} onChange={(e) => setForm({ ...form, inverterModel: e.target.value })} /></div>
            <div><Label>ราคาเสนอ (บาท)</Label><Input value={form.quotedPrice || ""} onChange={(e) => setForm({ ...form, quotedPrice: e.target.value })} /></div>
            <div>
              <Label>แบตเตอรี่</Label>
              <Input value={form.needBattery || ""} onChange={(e) => setForm({ ...form, needBattery: e.target.value })} placeholder="เช่น 2 ก้อน Tesla Powerwall" />
            </div>
            <div>
              <Label>Optimizer</Label>
              <Input value={form.needOptimizer || ""} onChange={(e) => setForm({ ...form, needOptimizer: e.target.value })} placeholder="เช่น 12 ตัว Huawei SUN2000" />
            </div>
            <div>
              <Label>ประเภทระบบ</Label>
              <Select value={form.systemType || ""} onValueChange={(v) => setForm({ ...form, systemType: v })}>
                <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String Inverter</SelectItem>
                  <SelectItem value="micro">Micro Inverter</SelectItem>
                  <SelectItem value="both">ทั้งสอง</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>หมายเหตุ</Label><Textarea value={form.surveyNotes || ""} onChange={(e) => setForm({ ...form, surveyNotes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={() => {
              const payload: any = {};
              if (form.scheduledDate) payload.scheduledDate = new Date(form.scheduledDate).getTime();
              else if (form.scheduledDate === "") payload.scheduledDate = undefined;
              if (form.scheduledTime !== undefined) payload.scheduledTime = form.scheduledTime;
              payload.surveyNotes = form.surveyNotes || "";
              payload.systemSize = form.systemSize || "";
              if (form.panelCount) payload.panelCount = parseInt(form.panelCount);
              payload.inverterModel = form.inverterModel || "";
              payload.panelBrand = form.panelBrand || "";
              payload.quotedPrice = form.quotedPrice || "";
              if (form.needBattery) payload.needBattery = form.needBattery;
              if (form.needOptimizer) payload.needOptimizer = form.needOptimizer;
              if (form.systemType) payload.systemType = form.systemType;
              // Always send team assignments (null to clear, number to set)
              payload.adminSenderId = form.adminSenderId ? parseInt(form.adminSenderId) : null;
              payload.surveyorIds = form.surveyorIds && form.surveyorIds.length > 0 ? form.surveyorIds : [];
              payload.closerId = form.closerId ? parseInt(form.closerId) : null;
              onSubmit(payload);
            }} disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddFollowUpDialog({ open, onOpenChange, surveyId, customerId, surveyors, onSubmit, loading }: any) {
  const [form, setForm] = useState({ dueDate: "", method: "phone", notes: "", assignedTo: "" });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dueDate) { toast.error("กรุณาเลือกวันที่"); return; }
    onSubmit({
      surveyId,
      customerId,
      dueDate: new Date(form.dueDate).getTime(),
      method: form.method as any,
      notes: form.notes || undefined,
      assignedTo: form.assignedTo ? parseInt(form.assignedTo) : undefined,
    });
    setForm({ dueDate: "", method: "phone", notes: "", assignedTo: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่ม Follow-up</DialogTitle>
          <DialogDescription>กำหนดการติดตามลูกค้า</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>วันที่ *</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div>
              <Label>วิธีการ</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FOLLOW_UP_METHOD_MAP).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>มอบหมายให้</Label>
              <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                <SelectContent>
                  {(surveyors || []).map((m: any) => (<SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>หมายเหตุ</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="รายละเอียด" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={loading}>{loading ? "กำลังสร้าง..." : "สร้าง Follow-up"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== TECH INFO CARD - Dynamic Custom Fields ==================== */
function TechInfoCard({ survey: s, surveyId, updateSurvey, onRefetch }: { survey: any; surveyId: number; updateSurvey: any; onRefetch?: () => void }) {
  const { data: fieldDefs } = trpc.technicalField.list.useQuery({ activeOnly: true });
  const { data: customValues } = trpc.technicalField.getValues.useQuery({ surveyId });
  const setValuesMutation = trpc.technicalField.setValues.useMutation();

  const [form, setForm] = useState<any>(null);
  const [customForm, setCustomForm] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false);

  // Built-in field keys that map to survey columns
  const BUILT_IN_KEYS = ["systemSize", "panelCount", "inverterModel", "panelBrand", "quotedPrice", "needBattery", "needOptimizer", "systemType"];

  // Initialize form from survey data
  const initForm = () => ({
    systemSize: s.systemSize || "",
    panelCount: s.panelCount ? String(s.panelCount) : "",
    inverterModel: s.inverterModel || "",
    panelBrand: s.panelBrand || "",
    quotedPrice: s.quotedPrice || "",
    needBattery: s.needBattery || "",
    needOptimizer: s.needOptimizer || "",
    systemType: s.systemType || "",
    surveyNotes: s.surveyNotes || "",
  });

  // Auto-init form when survey data loads
  if (!form && s) {
    setForm(initForm());
  }

  // Init custom values when they load
  useEffect(() => {
    if (customValues && fieldDefs) {
      const cv: Record<number, string> = {};
      for (const v of customValues) {
        cv[v.fieldDefinitionId] = v.value || "";
      }
      setCustomForm(cv);
    }
  }, [customValues, fieldDefs]);

  const surveyKey = `${s.systemSize}|${s.panelCount}|${s.inverterModel}|${s.panelBrand}|${s.quotedPrice}|${s.needBattery}|${s.needOptimizer}|${s.systemType}|${s.surveyNotes}`;

  const updateField = (key: string, val: string) => {
    setForm((prev: any) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const updateCustomField = (fieldId: number, val: string) => {
    setCustomForm(prev => ({ ...prev, [fieldId]: val }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!form) return;
    // Save built-in fields
    const payload: any = { id: surveyId };
    payload.systemSize = form.systemSize || undefined;
    payload.panelCount = form.panelCount ? parseInt(form.panelCount) : undefined;
    payload.inverterModel = form.inverterModel || undefined;
    payload.panelBrand = form.panelBrand || undefined;
    payload.quotedPrice = form.quotedPrice || undefined;
    payload.needBattery = form.needBattery || undefined;
    payload.needOptimizer = form.needOptimizer || undefined;
    payload.systemType = form.systemType || undefined;
    payload.surveyNotes = form.surveyNotes || undefined;
    updateSurvey.mutate(payload, {
      onSuccess: () => { setDirty(false); }
    });

    // Save custom field values
    const customFieldDefs = (fieldDefs || []).filter(f => !f.isBuiltIn);
    if (customFieldDefs.length > 0) {
      const values = customFieldDefs.map(f => ({
        fieldDefinitionId: f.id,
        value: customForm[f.id] || null,
      }));
      setValuesMutation.mutate({ surveyId, values });
    }
  };

  const handleCancel = () => {
    setForm(initForm());
    // Reset custom values
    if (customValues) {
      const cv: Record<number, string> = {};
      for (const v of customValues) {
        cv[v.fieldDefinitionId] = v.value || "";
      }
      setCustomForm(cv);
    }
    setDirty(false);
  };

  if (!form) return null;

  // Separate built-in and custom fields
  const builtInFields = (fieldDefs || []).filter(f => f.isBuiltIn);
  const customFields = (fieldDefs || []).filter(f => !f.isBuiltIn);

  const getBuiltInIcon = (key: string) => {
    if (key === "systemSize") return <Zap className="h-3.5 w-3.5 text-amber-500" />;
    if (key === "panelCount") return <Sun className="h-3.5 w-3.5 text-amber-500" />;
    return undefined;
  };

  const getBuiltInSuffix = (key: string) => {
    if (key === "systemSize") return "kW";
    if (key === "panelCount") return "แผง";
    if (key === "quotedPrice") return "บาท";
    return undefined;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> ข้อมูลทางเทคนิค</CardTitle>
          {dirty && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>ยกเลิก</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={updateSurvey.isPending || setValuesMutation.isPending}>
                {(updateSurvey.isPending || setValuesMutation.isPending) ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
          {/* Built-in fields rendered dynamically */}
          {builtInFields.map(field => {
            if (field.fieldKey === "systemType") {
              const options = field.options ? JSON.parse(field.options) : ["string", "micro", "both", "hybrid"];
              const SYSTEM_TYPE_LABELS: Record<string, string> = { string: "String Inverter", micro: "Micro Inverter", both: "ทั้ง 2 แบบ", hybrid: "Hybrid" };
              return (
                <div key={field.id} className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Select value={form.systemType || "placeholder"} onValueChange={(v) => updateField("systemType", v === "placeholder" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>
                      {options.map((o: string) => <SelectItem key={o} value={o}>{SYSTEM_TYPE_LABELS[o] || o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            const key = field.fieldKey || "";
            return (
              <EditableField
                key={field.id}
                label={field.label}
                value={form[key] || ""}
                onChange={(v) => updateField(key, v)}
                placeholder={field.placeholder || ""}
                type={field.fieldType === "number" ? "number" : undefined}
                icon={getBuiltInIcon(key)}
                suffix={getBuiltInSuffix(key)}
              />
            );
          })}

          {/* Custom fields */}
          {customFields.map(field => {
            if (field.fieldType === "select") {
              const options = field.options ? JSON.parse(field.options) : [];
              return (
                <div key={field.id} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Select value={customForm[field.id] || "placeholder"} onValueChange={(v) => updateCustomField(field.id, v === "placeholder" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={field.placeholder || "เลือก"} /></SelectTrigger>
                    <SelectContent>
                      {options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.fieldType === "textarea") {
              return (
                <div key={field.id} className="col-span-2">
                  <EditableField
                    label={field.label}
                    value={customForm[field.id] || ""}
                    onChange={(v) => updateCustomField(field.id, v)}
                    placeholder={field.placeholder || ""}
                    multiline
                  />
                </div>
              );
            }
            return (
              <EditableField
                key={field.id}
                label={field.label}
                value={customForm[field.id] || ""}
                onChange={(v) => updateCustomField(field.id, v)}
                placeholder={field.placeholder || ""}
                type={field.fieldType === "number" ? "number" : undefined}
              />
            );
          })}
        </div>
        <div className="mt-3">
          <EditableField label="หมายเหตุ" value={form.surveyNotes} onChange={(v) => updateField("surveyNotes", v)} placeholder="หมายเหตุเพิ่มเติม..." multiline />
        </div>
      </CardContent>
    </Card>
  );
}

/* ==================== EDITABLE FIELD ==================== */
function EditableField({ label, value, onChange, placeholder, type, icon, suffix, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode; suffix?: string; multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="text-sm"
        />
      ) : (
        <div className="relative">
          {icon && <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</span>}
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            type={type}
            className={`h-8 text-sm ${icon ? "pl-7" : ""}`}
          />
          {suffix && value && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
        </div>
      )}
    </div>
  );
}

/* ==================== TEMPLATE FIELDS CARD ==================== */
function TemplateFieldsCard({ sourceName, surveyId }: { sourceName: string; surveyId: number }) {
  const { data: template, isLoading: loadingTemplate } = trpc.surveyTemplate.getBySourceName.useQuery(
    { sourceName },
    { enabled: !!sourceName }
  );
  const { data: savedData, refetch: refetchData } = trpc.surveyTemplate.getData.useQuery(
    { surveyId },
    { enabled: !!surveyId }
  );
  const saveData = trpc.surveyTemplate.saveData.useMutation({
    onSuccess: () => { toast.success("บันทึกข้อมูลเทมเพลทสำเร็จ"); refetchData(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [otherValues, setOtherValues] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form from saved data
  useEffect(() => {
    if (savedData && template && !initialized) {
      const vals: Record<number, string> = {};
      const others: Record<number, string> = {};
      for (const d of savedData as any[]) {
        vals[d.fieldId] = d.value || "";
        if (d.otherValue) others[d.fieldId] = d.otherValue;
      }
      // Set defaults for fields without saved data
      for (const field of (template.fields || [])) {
        if (vals[field.id] === undefined && field.defaultValue) {
          vals[field.id] = field.defaultValue;
        }
      }
      setFormValues(vals);
      setOtherValues(others);
      setInitialized(true);
    }
  }, [savedData, template, initialized]);

  // Reset initialized when surveyId changes
  useEffect(() => { setInitialized(false); }, [surveyId]);

  if (loadingTemplate) return null;
  if (!template || !template.fields || template.fields.length === 0) return null;

  const fields = template.fields;

  const updateVal = (fieldId: number, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
    setDirty(true);
  };

  const updateOther = (fieldId: number, value: string) => {
    setOtherValues(prev => ({ ...prev, [fieldId]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    const entries = fields
      .filter((f: any) => f.fieldType !== "section_header")
      .map((f: any) => ({
        fieldId: f.id,
        value: formValues[f.id] || null,
        otherValue: otherValues[f.id] || null,
      }));
    saveData.mutate({ surveyId, templateId: template.id, entries });
    setDirty(false);
  };

  const handleCancel = () => {
    setInitialized(false);
    setDirty(false);
  };

  // Group fields by section_header
  const groupedFields: { section: string | null; fields: any[] }[] = [];
  let currentSection: string | null = null;
  let currentGroup: any[] = [];
  fields.forEach((field: any) => {
    if (field.fieldType === "section_header") {
      if (currentGroup.length > 0 || currentSection !== null) {
        groupedFields.push({ section: currentSection, fields: currentGroup });
      }
      currentSection = field.fieldLabel;
      currentGroup = [];
    } else {
      currentGroup.push(field);
    }
  });
  if (currentGroup.length > 0 || currentSection !== null) {
    groupedFields.push({ section: currentSection, fields: currentGroup });
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> {template.name}
          </CardTitle>
          {dirty && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>ยกเลิก</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saveData.isPending}>
                {saveData.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {groupedFields.map((group, gi) => (
            <div key={gi} className="space-y-3">
              {group.section && (
                <div className="border-b pb-1.5">
                  <h4 className="font-semibold text-sm text-foreground">{group.section}</h4>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                {group.fields.map((field: any) => (
                  <TemplateFieldInput
                    key={field.id}
                    field={field}
                    value={formValues[field.id] || ""}
                    otherValue={otherValues[field.id] || ""}
                    onChange={(v) => updateVal(field.id, v)}
                    onOtherChange={(v) => updateOther(field.id, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ==================== TEMPLATE FIELD INPUT ==================== */
function TemplateFieldInput({ field, value, otherValue, onChange, onOtherChange }: {
  field: any; value: string; otherValue: string; onChange: (v: string) => void; onOtherChange: (v: string) => void;
}) {
  const options = field.fieldOptions ? field.fieldOptions.split(",").map((o: string) => o.trim()).filter(Boolean) : [];

  if (field.fieldType === "text") {
    return (
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{field.fieldLabel}{field.required && <span className="text-red-500">*</span>}</label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || `กรอก${field.fieldLabel}`} className="h-8 text-sm" />
      </div>
    );
  }

  if (field.fieldType === "number" || field.fieldType === "distance") {
    return (
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{field.fieldLabel}{field.required && <span className="text-red-500">*</span>}</label>
        <div className="flex items-center gap-1">
          <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || "0"} className="h-8 text-sm flex-1" />
          {field.fieldType === "distance" && <span className="text-xs text-muted-foreground">ม.</span>}
        </div>
      </div>
    );
  }

  if (field.fieldType === "textarea") {
    return (
      <div className="space-y-1 col-span-2">
        <label className="text-xs text-muted-foreground">{field.fieldLabel}{field.required && <span className="text-red-500">*</span>}</label>
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || `กรอก${field.fieldLabel}`} rows={2} className="text-sm" />
      </div>
    );
  }

  if (field.fieldType === "select") {
    return (
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{field.fieldLabel}{field.required && <span className="text-red-500">*</span>}</label>
        <Select value={value || "__placeholder__"} onValueChange={(v) => onChange(v === "__placeholder__" ? "" : v)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={field.placeholder || "เลือก..."} /></SelectTrigger>
          <SelectContent>
            {options.map((opt: string, i: number) => (
              <SelectItem key={i} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.hasOtherOption && value === "อื่นๆ" && (
          <Input value={otherValue} onChange={(e) => onOtherChange(e.target.value)} placeholder="ระบุ..." className="h-7 text-sm mt-1" />
        )}
      </div>
    );
  }

  if (field.fieldType === "checkbox") {
    return (
      <div className="space-y-1 flex items-center gap-2 col-span-2">
        <Checkbox checked={value === "true"} onCheckedChange={(checked) => onChange(checked ? "true" : "false")} />
        <label className="text-sm">{field.fieldLabel}{field.required && <span className="text-red-500 text-xs">*</span>}</label>
      </div>
    );
  }

  if (field.fieldType === "checkbox_group") {
    const selected: string[] = value ? value.split(",").filter(Boolean) : [];
    const toggle = (opt: string) => {
      const newSel = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
      onChange(newSel.join(","));
    };
    return (
      <div className="space-y-1 col-span-2">
        <label className="text-xs text-muted-foreground">{field.fieldLabel}{field.required && <span className="text-red-500">*</span>}</label>
        <div className="flex flex-wrap gap-3">
          {options.map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5">
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
              <span className="text-sm">{opt}</span>
            </div>
          ))}
          {field.hasOtherOption && (
            <div className="flex items-center gap-1.5">
              <Checkbox checked={selected.includes("__other__")} onCheckedChange={() => toggle("__other__")} />
              <span className="text-sm">อื่นๆ:</span>
              <Input value={otherValue} onChange={(e) => onOtherChange(e.target.value)} placeholder="ระบุ..." className="h-7 text-sm w-32" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (field.fieldType === "radio" || field.fieldType === "yes_no") {
    const radioOptions = field.fieldType === "yes_no" ? ["มี", "ไม่มี"] : options;
    return (
      <div className="space-y-1 col-span-2">
        <label className="text-xs text-muted-foreground">{field.fieldLabel}{field.required && <span className="text-red-500">*</span>}</label>
        <div className="flex flex-wrap gap-4">
          {radioOptions.map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5 cursor-pointer" onClick={() => onChange(opt)}>
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${value === opt ? "border-primary" : "border-muted-foreground/40"}`}>
                {value === opt && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm">{opt}</span>
            </div>
          ))}
          {field.hasOtherOption && (
            <div className="flex items-center gap-1.5">
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center cursor-pointer ${value === "__other__" ? "border-primary" : "border-muted-foreground/40"}`} onClick={() => onChange("__other__")}>
                {value === "__other__" && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm">อื่นๆ:</span>
              <Input value={otherValue} onChange={(e) => onOtherChange(e.target.value)} placeholder="ระบุ..." className="h-7 text-sm w-32" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (field.fieldType === "date") {
    return (
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{field.fieldLabel}{field.required && <span className="text-red-500">*</span>}</label>
        <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
      </div>
    );
  }

  return null;
}

/* ==================== CUSTOMER INFO CARD - Always Editable ==================== */
function CustomerInfoCard({ customer: c, updateCustomer }: { customer: any; updateCustomer: any }) {
  const [form, setForm] = useState<any>(null);
  const [dirty, setDirty] = useState(false);

  const initForm = () => ({
    electricityBill: c.electricityBill || "",
    roofType: c.roofType || "",
    roofArea: c.roofArea || "",
    phaseType: c.phaseType || "",
    meterSize: c.meterSize || "",
    source: c.source || "",
    notes: c.notes || "",
    fullAddress: c.fullAddress || "",
    subDistrict: c.subDistrict || "",
    district: c.district || "",
    province: c.province || "",
    postalCode: c.postalCode || "",
  });

  if (!form && c) setForm(initForm());

  const updateField = (key: string, val: string) => {
    setForm((prev: any) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!form) return;
    const payload: any = { id: c.id };
    payload.electricityBill = form.electricityBill || undefined;
    payload.roofType = form.roofType || undefined;
    payload.roofArea = form.roofArea || undefined;
    if (form.phaseType) payload.phaseType = form.phaseType;
    payload.meterSize = form.meterSize || undefined;
    payload.source = form.source || undefined;
    payload.notes = form.notes || undefined;
    payload.fullAddress = form.fullAddress || undefined;
    payload.subDistrict = form.subDistrict || undefined;
    payload.district = form.district || undefined;
    payload.province = form.province || undefined;
    payload.postalCode = form.postalCode || undefined;
    updateCustomer.mutate(payload, {
      onSuccess: () => { setDirty(false); }
    });
  };

  const handleCancel = () => {
    setForm(initForm());
    setDirty(false);
  };

  if (!form) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-primary" /> ข้อมูลจากลูกค้า</CardTitle>
          {dirty && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>ยกเลิก</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
          <EditableField label="ค่าไฟ/เดือน (บาท)" value={form.electricityBill} onChange={(v) => updateField("electricityBill", v)} placeholder="เช่น 3500" icon={<Receipt className="h-3.5 w-3.5 text-green-500" />} suffix="บาท" />
          <EditableField label="ประเภทหลังคา" value={form.roofType} onChange={(v) => updateField("roofType", v)} placeholder="เช่น เมทัลชีท" icon={<Home className="h-3.5 w-3.5 text-orange-500" />} />
          <EditableField label="พื้นที่หลังคา (ตร.ม.)" value={form.roofArea} onChange={(v) => updateField("roofArea", v)} placeholder="เช่น 50" suffix="ตร.ม." />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ระบบไฟฟ้า</label>
            <Select value={form.phaseType || "placeholder"} onValueChange={(v) => updateField("phaseType", v === "placeholder" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">1 เฟส</SelectItem>
                <SelectItem value="three">3 เฟส</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <EditableField label="ขนาดมิเตอร์" value={form.meterSize} onChange={(v) => updateField("meterSize", v)} placeholder="เช่น 15(45)A" icon={<Gauge className="h-3.5 w-3.5 text-blue-500" />} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ช่องทาง</label>
            <SourceCombobox value={form.source} onChange={(v) => { updateField("source", v); }} />
          </div>
          <EditableField label="ที่อยู่ (บ้านเลขที่ หมู่บ้าน ซอย ถนน)" value={form.fullAddress || ""} onChange={(v) => updateField("fullAddress", v)} placeholder="เช่น 123/45 หมู่บ้านสุขสันต์ ซ.5 ถ.รัตนาธิเบศร์" icon={<MapPin className="h-3.5 w-3.5 text-blue-500" />} />
          <EditableField label="ตำบล/แขวง" value={form.subDistrict || ""} onChange={(v) => updateField("subDistrict", v)} placeholder="ตำบล/แขวง" />
          <EditableField label="อำเภอ/เขต" value={form.district || ""} onChange={(v) => updateField("district", v)} placeholder="อำเภอ/เขต" />
          <EditableField label="จังหวัด" value={form.province || ""} onChange={(v) => updateField("province", v)} placeholder="จังหวัด" />
          <EditableField label="รหัสไปรษณีย์" value={form.postalCode || ""} onChange={(v) => updateField("postalCode", v)} placeholder="10xxx" />
        </div>
        <div className="mt-3">
          <EditableField label="หมายเหตุลูกค้า" value={form.notes} onChange={(v) => updateField("notes", v)} placeholder="หมายเหตุเพิ่มเติม..." multiline />
        </div>
      </CardContent>
    </Card>
  );
}

/* ==================== TEAM CARD - Editable ==================== */
function TeamCard({ data, surveyId, teamAdminSenders, teamSurveyors, teamClosers, refetch }: { data: any; surveyId: number; teamAdminSenders: any[]; teamSurveyors: any[]; teamClosers: any[]; refetch: () => void }) {
  const assignments = data?.assignments || [];
  const adminSender = assignments.find((a: any) => a.assignment.role === "admin_sender");
  const surveyors = assignments.filter((a: any) => a.assignment.role === "surveyor");
  const closers = assignments.filter((a: any) => a.assignment.role === "closer");

  const [editingTeam, setEditingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({
    adminSenderId: "",
    surveyorIds: [] as string[],
    closerIds: [] as string[],
  });

  const updateSurvey = trpc.survey.update.useMutation({
    onSuccess: () => { toast.success("อัพเดททีมงานสำเร็จ"); setEditingTeam(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = () => {
    setTeamForm({
      adminSenderId: adminSender?.user?.id ? String(adminSender.user.id) : "",
      surveyorIds: surveyors.map((a: any) => String(a.user?.id || "")),
      closerIds: closers.map((a: any) => String(a.user?.id || "")).filter(Boolean),
    });
    setEditingTeam(true);
  };

  const handleSave = () => {
    const payload: any = { id: surveyId };
    // Send null to explicitly remove, number to set, omit to keep
    payload.adminSenderId = teamForm.adminSenderId ? parseInt(teamForm.adminSenderId) : null;
    payload.surveyorIds = teamForm.surveyorIds.filter(Boolean).map(Number);
    payload.closerIds = teamForm.closerIds.filter(Boolean).map(Number);
    updateSurvey.mutate(payload);
  };

  const adminSenderOpts = teamAdminSenders.map((m: any) => ({ id: m.id, name: m.name }));
  const surveyorOpts = teamSurveyors.map((m: any) => ({ id: m.id, name: m.name }));
  const closerOpts = teamClosers.map((m: any) => ({ id: m.id, name: m.name }));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> ทีมงาน</CardTitle>
          {!editingTeam ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingTeam(false)}>ยกเลิก</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={updateSurvey.isPending}>
                {updateSurvey.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editingTeam ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">แอดมินผู้ส่งงาน</Label>
              <div className="flex gap-1">
                <Select value={teamForm.adminSenderId || "placeholder"} onValueChange={(v) => setTeamForm({ ...teamForm, adminSenderId: v === "placeholder" ? "" : v })}>
                  <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {adminSenderOpts.length > 0 ? adminSenderOpts.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">ยังไม่มีสมาชิก - เพิ่มที่หน้าจัดการทีมงาน</div>
                    )}
                  </SelectContent>
                </Select>
                {teamForm.adminSenderId && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setTeamForm({ ...teamForm, adminSenderId: "" })} title="ลบ">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">ทีมสำรวจ (เลือกได้หลายคน)</Label>
              <MultiUserSelect
                users={surveyorOpts}
                selectedIds={teamForm.surveyorIds.filter(Boolean).map(Number)}
                onChange={(ids) => setTeamForm({ ...teamForm, surveyorIds: ids.map(String) })}
              />
            </div>
            <div>
              <Label className="text-xs">ผู้ปิดการขาย (เลือกได้หลายคน)</Label>
              <MultiUserSelect
                users={closerOpts}
                selectedIds={teamForm.closerIds.filter(Boolean).map(Number)}
                onChange={(ids) => setTeamForm({ ...teamForm, closerIds: ids.map(String) })}
                placeholder="เลือกผู้ปิดการขาย..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <p className="text-xs text-muted-foreground mb-1">แอดมินผู้ส่งงาน</p>
                <p className="font-medium">{adminSender?.user?.name || "-"}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <p className="text-xs text-muted-foreground mb-1">ทีมสำรวจ</p>
                {surveyors.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {surveyors.map((a: any) => (
                      <Badge key={a.assignment.id} variant="secondary" className="text-xs">{a.user?.name || "-"}</Badge>
                    ))}
                  </div>
                ) : <p className="font-medium">-</p>}
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                <p className="text-xs text-muted-foreground mb-1">ผู้ปิดการขาย</p>
                {closers.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {closers.map((a: any) => (
                      <Badge key={a.assignment.id} variant="secondary" className="text-xs">{a.user?.name || "-"}</Badge>
                    ))}
                  </div>
                ) : <p className="font-medium">-</p>}
              </div>
            </div>
            {/* Installer Team - always visible & editable */}
            <div className="border-t pt-3">
              <InstallerTeamSelect surveyId={surveyId} currentTeamId={data?.survey?.installerTeamId ?? null} onChanged={refetch} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ==================== INSTALLER TEAM SELECT ==================== */
function InstallerTeamSelect({ surveyId, currentTeamId, onChanged }: { surveyId: number; currentTeamId: number | null; onChanged?: () => void }) {
  const { data: teams = [] } = trpc.installerTeam.listActive.useQuery();
  const updateSurvey = trpc.survey.update.useMutation({
    onSuccess: () => { toast.success("อัพเดททีมช่างสำเร็จ"); onChanged?.(); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleChange = (val: string) => {
    const teamId = val === "none" ? null : Number(val);
    updateSurvey.mutate({ id: surveyId, installerTeamId: teamId });
  };

  return (
    <div className="space-y-1 col-span-2 md:col-span-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Wrench className="h-3 w-3" /> ทีมช่างติดตั้ง
      </label>
      <Select value={currentTeamId ? String(currentTeamId) : "none"} onValueChange={handleChange} disabled={updateSurvey.isPending}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือกทีมช่าง" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">ยังไม่ได้กำหนด</SelectItem>
          {teams.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}


function ShareLinkList({ links, linkType, onRevoke }: { links: any[]; linkType: string; onRevoke: (id: number) => void }) {
  if (!links || links.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Share2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">ยังไม่มีลิงก์{linkType === "survey" ? "สำรวจ" : "ติดตั้ง"}</p>
        <p className="text-xs mt-1">กดปุ่มด้านบนเพื่อสร้างลิงก์ใหม่</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {links.map((link: any) => {
        const shareUrl = linkType === "survey"
          ? `${window.location.origin}/survey-field/${link.token}`
          : `${window.location.origin}/share/${link.token}`;
        const isExpired = link.expiresAt && link.expiresAt < Date.now();
        return (
          <div key={link.id} className={`p-4 rounded-lg border ${!link.isActive || isExpired ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={link.isActive && !isExpired ? "default" : "secondary"} className="text-[10px]">
                {!link.isActive ? "ยกเลิกแล้ว" : isExpired ? "หมดอายุ" : "ใช้งานได้"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">ดู {link.viewCount} ครั้ง</span>
              {link.expiresAt ? (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  หมดอายุ {new Date(link.expiresAt).toLocaleDateString("th-TH")}
                </span>
              ) : link.isActive ? (
                <span className="text-[10px] text-green-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ไม่มีหมดอายุ
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="text-xs h-8 bg-muted/50" />
              <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("คัดลอกลิงก์แล้ว"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {link.isActive && !isExpired && (
                <Button variant="outline" size="sm" className="h-8 shrink-0 text-destructive hover:bg-red-50" onClick={() => onRevoke(link.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
