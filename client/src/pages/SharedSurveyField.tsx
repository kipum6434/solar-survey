import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/formatPhone";
import { useParams } from "wouter";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { compressImages } from "@/lib/imageCompression";
import { useUploadWithRetry } from "@/hooks/useUploadWithRetry";
import { UploadStatusBar } from "@/components/UploadStatusBar";
import {
  Camera, MapPin, Calendar, Phone, Zap, Home, Gauge,
  X, Sun, Upload, Trash2, CheckCircle2, Clock,
  Save, FileText, ChevronDown, ChevronUp, Info, User, ImagePlus, GripVertical,
  PauseCircle, XCircle, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable photo item component
function SortablePhotoItem({ photo, onDelete, onPreview }: {
  photo: any;
  onDelete: (id: number) => void;
  onPreview: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } = useSortable({ id: photo.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative group aspect-square ${isDragging ? "ring-2 ring-blue-400 rounded-md shadow-lg" : ""}`}>
      <img
        src={photo.url}
        alt={photo.fileName}
        className="w-full h-full object-cover rounded-md cursor-pointer"
        onClick={() => onPreview(photo.url)}
      />
      {/* Drag handle - only this button activates drag */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 bg-black/50 text-white rounded-full p-1.5 opacity-80 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
        className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 sm:transition-opacity md:opacity-0 max-sm:opacity-80"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {/* Sort order badge */}
      <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] rounded px-1">
        {photo.sortOrder + 1}
      </div>
    </div>
  );
}

export default function SharedSurveyField() {
  const params = useParams<{ token: string }>();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.shareLink.getByToken.useQuery({ token: params.token || "" });
  const { data: photoCategories } = trpc.photoCategory.list.useQuery();

  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showCompleteSurveyConfirm, setShowCompleteSurveyConfirm] = useState(false);
  const [showTechnical, setShowTechnical] = useState(true);
  const [showCustomerInfo, setShowCustomerInfo] = useState(true);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const { state: uploadState, uploadFiles: uploadWithRetry, retryFailed, clearState: clearUploadState } = useUploadWithRetry();
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);

  // Technical form state
  const [techForm, setTechForm] = useState<{
    systemSize: string;
    panelCount: string;
    inverterModel: string;
    panelBrand: string;
    needBattery: string;
    needOptimizer: string;
    systemType: string;
    surveyNotes: string;
    quotedPrice: string;
  } | null>(null);
  const [techSaving, setTechSaving] = useState(false);
  const [techDirty, setTechDirty] = useState(false);

  // Customer info form state
  const [custForm, setCustForm] = useState<{
    electricityBill: string;
    roofType: string;
    roofArea: string;
    phaseType: string;
    meterSize: string;
    fullAddress: string;
    subDistrict: string;
    district: string;
    province: string;
    postalCode: string;
    notes: string;
  } | null>(null);
  const [custSaving, setCustSaving] = useState(false);
  const [custDirty, setCustDirty] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const galleryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // DnD sensors - with touch delay for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const completeSurveyMut = trpc.survey.publicCompleteSurvey.useMutation({
    onSuccess: () => { toast.success("สำรวจเสร็จสิ้นแล้ว"); window.location.reload(); },
    onError: (e: any) => { toast.error(e.message || "เกิดข้อผิดพลาด"); },
  });

  // Postpone/Cancel state
  const [showPostponeDialog, setShowPostponeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [postponeReason, setPostponeReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [actionByName, setActionByName] = useState("");

  const postponeSurveyMut = trpc.survey.publicPostponeSurvey.useMutation({
    onSuccess: () => { toast.success("เลื่อนสำรวจสำเร็จ"); setShowPostponeDialog(false); setPostponeReason(""); setActionByName(""); window.location.reload(); },
    onError: (e: any) => toast.error(e.message || "เกิดข้อผิดพลาด"),
  });
  const cancelSurveyMut = trpc.survey.publicCancelSurvey.useMutation({
    onSuccess: () => { toast.success("ยกเลิกสำรวจสำเร็จ"); setShowCancelDialog(false); setCancelReason(""); setActionByName(""); window.location.reload(); },
    onError: (e: any) => toast.error(e.message || "เกิดข้อผิดพลาด"),
  });
  const { data: postponeLogs } = trpc.survey.publicGetPostponeCancelLogs.useQuery({ token: params.token || "", surveyId: 0 }, { enabled: false });

  const uploadPhotoMut = trpc.shareLink.publicUploadSurveyPhoto.useMutation();
  const deletePhotoMut = trpc.shareLink.publicDeleteSurveyPhoto.useMutation();
  const updateTechMut = trpc.shareLink.publicUpdateSurveyTechnical.useMutation();
  const updateCustMut = trpc.shareLink.publicUpdateCustomerInfo.useMutation();
  const reorderPhotosMut = trpc.shareLink.publicReorderSurveyPhotos.useMutation({
    onSuccess: () => { utils.shareLink.getByToken.invalidate({ token: params.token || "" }); },
    onError: (e: any) => { toast.error("จัดเรียงล้มเหลว: " + (e.message || "")); },
  });

  // Build category map from API only (photo_categories table)
  const categoryMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    if (photoCategories) {
      for (const cat of photoCategories) {
        map[cat.key] = cat.label;
      }
    }
    return map;
  }, [photoCategories]);

  const categoryKeys = useMemo(() => {
    if (!photoCategories) return [];
    return photoCategories.map((cat: any) => cat.key);
  }, [photoCategories]);

  // Initialize tech form when data loads
  const s = data && 'survey' in data ? data.survey : null;
  const c = data && 'customer' in data ? data.customer : null;
  const photosData = data && 'photos' in data ? data.photos : [];
  const surveyId = s?.id || 0;
  const token = params.token || "";

  // Template fields - query template by customer source name
  const sourceName = c?.source || "";
  const { data: templateData, isLoading: loadingTemplate } = trpc.surveyTemplate.publicGetBySourceName.useQuery(
    { token, sourceName },
    { enabled: !!sourceName && !!token }
  );
  const { data: savedTemplateData, refetch: refetchTemplateData } = trpc.surveyTemplate.publicGetData.useQuery(
    { token, surveyId },
    { enabled: !!surveyId && !!token }
  );
  const saveTemplateMut = trpc.surveyTemplate.publicSaveData.useMutation({
    onSuccess: () => { toast.success("บันทึกข้อมูลเทมเพลทสำเร็จ"); refetchTemplateData(); },
    onError: (e: any) => toast.error(e.message),
  });
  const hasTemplate = !!templateData && !!templateData.fields && templateData.fields.length > 0;

  // Template form state
  const [templateFormValues, setTemplateFormValues] = useState<Record<number, string>>({});
  const [templateOtherValues, setTemplateOtherValues] = useState<Record<number, string>>({});
  const [templateDirty, setTemplateDirty] = useState(false);
  const [templateInitialized, setTemplateInitialized] = useState(false);

  // Initialize template form from saved data
  useEffect(() => {
    if (savedTemplateData && templateData && !templateInitialized) {
      const vals: Record<number, string> = {};
      const others: Record<number, string> = {};
      for (const d of savedTemplateData as any[]) {
        vals[d.fieldId] = d.value || "";
        if (d.otherValue) others[d.fieldId] = d.otherValue;
      }
      for (const field of (templateData.fields || [])) {
        if (vals[field.id] === undefined && field.defaultValue) {
          vals[field.id] = field.defaultValue;
        }
      }
      setTemplateFormValues(vals);
      setTemplateOtherValues(others);
      setTemplateInitialized(true);
    }
  }, [savedTemplateData, templateData, templateInitialized]);

  useEffect(() => { setTemplateInitialized(false); }, [surveyId]);

  // Initialize tech form once - format numeric values with commas for display
  if (s && !techForm) {
    const fmtNum = (v: string | number | null | undefined) => {
      if (!v) return "";
      const n = Number(v);
      if (isNaN(n)) return String(v);
      return n.toLocaleString("en-US");
    };
    setTechForm({
      systemSize: s.systemSize || "",
      panelCount: s.panelCount ? fmtNum(s.panelCount) : "",
      inverterModel: s.inverterModel || "",
      panelBrand: s.panelBrand || "",
      needBattery: (s as any).needBattery || "",
      needOptimizer: (s as any).needOptimizer || "",
      systemType: s.systemType || "",
      surveyNotes: s.surveyNotes || "",
      quotedPrice: fmtNum(s.quotedPrice),
    });
  }

  // Initialize customer form once
  if (c && !custForm) {
    setCustForm({
      electricityBill: c.electricityBill || "",
      roofType: c.roofType || "",
      roofArea: c.roofArea || "",
      phaseType: c.phaseType || "",
      meterSize: c.meterSize || "",
      fullAddress: c.fullAddress || "",
      subDistrict: c.subDistrict || "",
      district: c.district || "",
      province: c.province || "",
      postalCode: c.postalCode || "",
      notes: c.notes || "",
    });
  }

  // Photo upload handler with retry
  const handlePhotoUpload = useCallback(async (category: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingCategory(category);
    try {
      const fileArray = Array.from(files);
      const compressed = await compressImages(fileArray);

      const { successCount, failedCount } = await uploadWithRetry(compressed, async (item) => {
        await uploadPhotoMut.mutateAsync({
          token,
          surveyId,
          fileName: item.fileName,
          base64Data: item.base64,
          category,
          mimeType: "image/jpeg",
        });
      });

      if (successCount > 0) {
        toast.success(`อัพโหลดสำเร็จ ${successCount} รูป`);
        utils.shareLink.getByToken.invalidate({ token });
      }
      if (failedCount > 0) {
        toast.error(`อัพโหลดล้มเหลว ${failedCount} รูป (กดลองใหม่ได้ที่ด้านล่าง)`);
      }
    } catch (e: any) {
      toast.error(e.message || "อัพโหลดล้มเหลว");
    } finally {
      setUploadingCategory(null);
    }
  }, [token, surveyId, uploadPhotoMut, utils, uploadWithRetry]);

  // Delete photo handler
  const handleDeletePhoto = useCallback(async (photoId: number) => {
    try {
      await deletePhotoMut.mutateAsync({ token, surveyId, id: photoId });
      toast.success("ลบรูปแล้ว");
      utils.shareLink.getByToken.invalidate({ token });
    } catch (e: any) {
      toast.error(e.message || "ลบล้มเหลว");
    }
    setDeletingPhotoId(null);
  }, [token, surveyId, deletePhotoMut, utils]);

  // Drag end handler for photo reorder within a category
  const handleDragEnd = useCallback((catKey: string, catPhotos: any[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = catPhotos.findIndex((p: any) => p.id === active.id);
    const newIndex = catPhotos.findIndex((p: any) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...catPhotos], oldIndex, newIndex);
    const items = reordered.map((p: any, i: number) => ({ id: p.id, sortOrder: i }));
    reorderPhotosMut.mutate({ token, surveyId, items });
  }, [token, surveyId, reorderPhotosMut]);

  // Save technical data
  const handleSaveTech = useCallback(async () => {
    if (!techForm) return;
    setTechSaving(true);
    try {
      // Strip non-numeric chars for numeric fields
      const cleanNum = (v: string) => v.replace(/[^0-9.]/g, "");
      const cleanInt = (v: string) => v.replace(/[^0-9]/g, "");
      const sysSize = cleanNum(techForm.systemSize);
      const pCount = cleanInt(techForm.panelCount);
      const qPrice = cleanNum(techForm.quotedPrice);
      await updateTechMut.mutateAsync({
        token,
        surveyId,
        systemSize: sysSize || undefined,
        panelCount: pCount ? parseInt(pCount, 10) : undefined,
        inverterModel: techForm.inverterModel || undefined,
        panelBrand: techForm.panelBrand || undefined,
        needBattery: techForm.needBattery || undefined,
        needOptimizer: techForm.needOptimizer || undefined,
        systemType: (techForm.systemType as "string" | "micro" | "both" | "hybrid") || undefined,
        surveyNotes: techForm.surveyNotes || undefined,
        quotedPrice: qPrice || undefined,
      });
      toast.success("บันทึกข้อมูลเทคนิคแล้ว");
      setTechDirty(false);
      utils.shareLink.getByToken.invalidate({ token });
    } catch (e: any) {
      toast.error(e.message || "บันทึกล้มเหลว");
    } finally {
      setTechSaving(false);
    }
  }, [techForm, token, surveyId, updateTechMut, utils]);

  // Save customer info
  const handleSaveCust = useCallback(async () => {
    if (!custForm) return;
    setCustSaving(true);
    try {
      await updateCustMut.mutateAsync({
        token,
        surveyId,
        electricityBill: custForm.electricityBill || undefined,
        roofType: custForm.roofType || undefined,
        roofArea: custForm.roofArea || undefined,
        phaseType: (custForm.phaseType as "single" | "three") || undefined,
        meterSize: custForm.meterSize || undefined,
        fullAddress: custForm.fullAddress || undefined,
        subDistrict: custForm.subDistrict || undefined,
        district: custForm.district || undefined,
        province: custForm.province || undefined,
        postalCode: custForm.postalCode || undefined,
        notes: custForm.notes || undefined,
      });
      toast.success("บันทึกข้อมูลลูกค้าแล้ว");
      setCustDirty(false);
      utils.shareLink.getByToken.invalidate({ token });
    } catch (e: any) {
      toast.error(e.message || "บันทึกล้มเหลว");
    } finally {
      setCustSaving(false);
    }
  }, [custForm, token, surveyId, updateCustMut, utils]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Sun className="h-12 w-12 mx-auto mb-3 text-blue-400 animate-spin" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Error / invalid link
  if (error || !data || 'error' in data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <X className="h-12 w-12 mx-auto mb-3 text-destructive/50" />
            <h2 className="text-lg font-semibold mb-2">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h2>
            <p className="text-sm text-muted-foreground">กรุณาติดต่อทีมงานเพื่อขอลิงก์ใหม่</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check linkType
  const linkType = 'linkType' in data ? data.linkType : "installation";
  if (linkType !== "survey") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <Info className="h-12 w-12 mx-auto mb-3 text-blue-400" />
            <h2 className="text-lg font-semibold mb-2">ลิงก์นี้ไม่ใช่ลิงก์สำรวจ</h2>
            <p className="text-sm text-muted-foreground">กรุณาใช้ลิงก์สำรวจที่ถูกต้อง</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!s || !c) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <X className="h-12 w-12 mx-auto mb-3 text-destructive/50" />
            <h2 className="text-lg font-semibold mb-2">ไม่พบข้อมูล</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;
  const isSurveyed = s.status === "surveyed" || s.status === "follow_up" || s.status === "quoted" || s.status === "negotiating" || s.status === "won";
  const isPostponedOrCancelled = s.status === "postponed" || s.status === "cancelled";

  // Group photos by category (only show categories from photo_categories API)
  const photosByCategory: Record<string, typeof photosData> = {};
  for (const photo of (photosData || [])) {
    const cat = (photo as any).category || "อื่นๆ";
    // If category key exists in categoryMap, use it; otherwise put in อื่นๆ
    const resolvedCat = categoryMap[cat] ? cat : "อื่นๆ";
    if (!photosByCategory[resolvedCat]) photosByCategory[resolvedCat] = [];
    photosByCategory[resolvedCat].push(photo);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
              <Camera className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">สำรวจหน้างาน - {c.name}</h1>
              <p className="text-xs text-muted-foreground">Field Survey</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Customer Info (read-only summary) */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Phone className="h-4 w-4" /> ข้อมูลลูกค้า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-xs border-0`}>
                {statusInfo.label}
              </Badge>
              {s.scheduledDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(s.scheduledDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </div>
            {c.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{formatPhone(c.phone)}</div>}
            {c.fullAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-500 mt-0.5" />
                <span className="font-medium">{c.fullAddress}</span>
              </div>
            )}
            {(c.subDistrict || c.district || c.province || c.postalCode) && (
              <div className="flex items-start gap-2 ml-6">
                <span className="text-muted-foreground">{[c.subDistrict, c.district, c.province, c.postalCode].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {c.address && c.address.startsWith('http') && (
              <a href={c.address} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <MapPin className="h-4 w-4" /> ดูโลเคชั่นบน Google Maps
              </a>
            )}
            {c.latitude && c.longitude && (
              <a href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <MapPin className="h-4 w-4" /> ดูบน Google Maps
              </a>
            )}
            {c.electricityBill && <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />ค่าไฟ: {c.electricityBill} บาท/เดือน</div>}
            {c.roofType && <div className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />หลังคา: {c.roofType}</div>}
            {c.phaseType && <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-muted-foreground" />ระบบไฟ: {c.phaseType === "single" ? "1 เฟส" : "3 เฟส"}</div>}
          </CardContent>
        </Card>

        {/* Template Fields OR Legacy Technical/Customer Forms */}
        {hasTemplate ? (
          <TemplateFieldsSection
            templateData={templateData}
            formValues={templateFormValues}
            otherValues={templateOtherValues}
            dirty={templateDirty}
            saving={saveTemplateMut.isPending}
            onUpdateVal={(fieldId, value) => { setTemplateFormValues(prev => ({ ...prev, [fieldId]: value })); setTemplateDirty(true); }}
            onUpdateOther={(fieldId, value) => { setTemplateOtherValues(prev => ({ ...prev, [fieldId]: value })); setTemplateDirty(true); }}
            onSave={() => {
              const entries = (templateData!.fields || []).filter((f: any) => f.fieldType !== "section_header").map((f: any) => ({
                fieldId: f.id, value: templateFormValues[f.id] || null, otherValue: templateOtherValues[f.id] || null,
              }));
              saveTemplateMut.mutate({ token, surveyId, templateId: templateData!.id, entries });
              setTemplateDirty(false);
            }}
            onCancel={() => { setTemplateInitialized(false); setTemplateDirty(false); }}
          />
        ) : (
          <>
            {/* Technical Data Form (legacy) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowTechnical(!showTechnical)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> ข้อมูลทางเทคนิค (กรอกได้)
                  </CardTitle>
                  {showTechnical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {showTechnical && techForm && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ขนาดระบบ (kW)</label>
                      <Input value={techForm.systemSize} onChange={(e) => { setTechForm({ ...techForm, systemSize: e.target.value }); setTechDirty(true); }} placeholder="เช่น 5.0" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">จำนวนแผง</label>
                      <Input type="number" value={techForm.panelCount} onChange={(e) => { setTechForm({ ...techForm, panelCount: e.target.value }); setTechDirty(true); }} placeholder="เช่น 10" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ยี่ห้อแผง</label>
                      <Input value={techForm.panelBrand} onChange={(e) => { setTechForm({ ...techForm, panelBrand: e.target.value }); setTechDirty(true); }} placeholder="เช่น JA Solar" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">รุ่นอินเวอร์เตอร์</label>
                      <Input value={techForm.inverterModel} onChange={(e) => { setTechForm({ ...techForm, inverterModel: e.target.value }); setTechDirty(true); }} placeholder="เช่น Huawei SUN2000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ราคาเสนอ (บาท)</label>
                      <Input value={techForm.quotedPrice} onChange={(e) => { setTechForm({ ...techForm, quotedPrice: e.target.value }); setTechDirty(true); }} placeholder="เช่น 280000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภทระบบ</label>
                      <Select value={techForm.systemType || "none"} onValueChange={(v) => { setTechForm({ ...techForm, systemType: v === "none" ? "" : v }); setTechDirty(true); }}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ยังไม่ระบุ</SelectItem>
                          <SelectItem value="string">String Inverter</SelectItem>
                          <SelectItem value="micro">Micro Inverter</SelectItem>
                          <SelectItem value="both">ทั้งสองแบบ</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">แบตเตอรี่</label>
                      <Input value={techForm.needBattery} onChange={(e) => { setTechForm({ ...techForm, needBattery: e.target.value }); setTechDirty(true); }} placeholder="เช่น 2 ก้อน Tesla Powerwall" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Optimizer</label>
                      <Input value={techForm.needOptimizer} onChange={(e) => { setTechForm({ ...techForm, needOptimizer: e.target.value }); setTechDirty(true); }} placeholder="เช่น 12 ตัว Huawei SUN2000" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">หมายเหตุสำรวจ</label>
                    <Textarea value={techForm.surveyNotes} onChange={(e) => { setTechForm({ ...techForm, surveyNotes: e.target.value }); setTechDirty(true); }} placeholder="บันทึกข้อมูลเพิ่มเติมจากการสำรวจ..." rows={3} />
                  </div>
                  <Button onClick={handleSaveTech} disabled={techSaving || !techDirty} className="w-full gap-2" variant={techDirty ? "default" : "outline"}>
                    <Save className="h-4 w-4" />
                    {techSaving ? "กำลังบันทึก..." : techDirty ? "บันทึกข้อมูลเทคนิค" : "บันทึกแล้ว"}
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Customer Info Form (legacy) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowCustomerInfo(!showCustomerInfo)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> ข้อมูลจากลูกค้า (กรอกได้)
                  </CardTitle>
                  {showCustomerInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {showCustomerInfo && custForm && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ค่าไฟ/เดือน (บาท)</label>
                      <Input value={custForm.electricityBill} onChange={(e) => { setCustForm({ ...custForm, electricityBill: e.target.value }); setCustDirty(true); }} placeholder="เช่น 3000-5000 หรือ 3,500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภทหลังคา</label>
                      <Input value={custForm.roofType} onChange={(e) => { setCustForm({ ...custForm, roofType: e.target.value }); setCustDirty(true); }} placeholder="เช่น เมทัลชีท" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">พื้นที่หลังคา (ตร.ม.)</label>
                      <Input value={custForm.roofArea} onChange={(e) => { setCustForm({ ...custForm, roofArea: e.target.value }); setCustDirty(true); }} placeholder="เช่น 50" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ระบบไฟฟ้า</label>
                      <Select value={custForm.phaseType || "none"} onValueChange={(v) => { setCustForm({ ...custForm, phaseType: v === "none" ? "" : v }); setCustDirty(true); }}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ยังไม่ระบุ</SelectItem>
                          <SelectItem value="single">1 เฟส</SelectItem>
                          <SelectItem value="three">3 เฟส</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">ขนาดมิเตอร์</label>
                      <Input value={custForm.meterSize} onChange={(e) => { setCustForm({ ...custForm, meterSize: e.target.value }); setCustDirty(true); }} placeholder="เช่น 15(45)A" />
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-3">ที่อยู่</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">ที่อยู่ (บ้านเลขที่ หมู่บ้าน ซอย ถนน)</label>
                        <Input value={custForm.fullAddress} onChange={(e) => { setCustForm({ ...custForm, fullAddress: e.target.value }); setCustDirty(true); }} placeholder="เช่น 123/45 หมู่บ้านสุขสันต์ ซ.5 ถ.รัตนาธิเบศร์" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">ตำบล/แขวง</label>
                        <Input value={custForm.subDistrict} onChange={(e) => { setCustForm({ ...custForm, subDistrict: e.target.value }); setCustDirty(true); }} placeholder="ตำบล/แขวง" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">อำเภอ/เขต</label>
                        <Input value={custForm.district} onChange={(e) => { setCustForm({ ...custForm, district: e.target.value }); setCustDirty(true); }} placeholder="อำเภอ/เขต" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">จังหวัด</label>
                        <Input value={custForm.province} onChange={(e) => { setCustForm({ ...custForm, province: e.target.value }); setCustDirty(true); }} placeholder="จังหวัด" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">รหัสไปรษณีย์</label>
                        <Input value={custForm.postalCode} onChange={(e) => { setCustForm({ ...custForm, postalCode: e.target.value }); setCustDirty(true); }} placeholder="10xxx" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">หมายเหตุลูกค้า</label>
                    <Textarea value={custForm.notes} onChange={(e) => { setCustForm({ ...custForm, notes: e.target.value }); setCustDirty(true); }} placeholder="หมายเหตุเพิ่มเติม..." rows={3} />
                  </div>
                  <Button onClick={handleSaveCust} disabled={custSaving || !custDirty} className="w-full gap-2" variant={custDirty ? "default" : "outline"}>
                    <Save className="h-4 w-4" />
                    {custSaving ? "กำลังบันทึก..." : custDirty ? "บันทึกข้อมูลลูกค้า" : "บันทึกแล้ว"}
                  </Button>
                </CardContent>
              )}
            </Card>
          </>
        )}

        {/* Photo Upload by Category */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4" /> อัพโหลดรูปสำรวจ ({(photosData || []).length} รูป)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">กดค้างที่ไอคอน ⠿ แล้วลากเพื่อจัดลำดับรูป</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryKeys.map((catKey) => {
              const catLabel = categoryMap[catKey];
              const catPhotos = photosByCategory[catKey] || [];
              const isUploading = uploadingCategory === catKey;
              const photoIds = catPhotos.map((p: any) => p.id);

              return (
                <div key={catKey} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{catLabel} ({catPhotos.length})</span>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[catKey]?.click()}
                      >
                        {isUploading && uploadState.isUploading && uploadingCategory === catKey ? (
                          <><Upload className="h-3.5 w-3.5 animate-bounce" /> อัพ {uploadState.successCount}/{uploadState.totalCount}</>
                        ) : (
                          <><Camera className="h-3.5 w-3.5" /> ถ่ายรูป</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={isUploading}
                        onClick={() => galleryInputRefs.current[catKey]?.click()}
                      >
                        <ImagePlus className="h-3.5 w-3.5" /> เลือกรูป
                      </Button>
                    </div>
                    <input
                      ref={(el) => { fileInputRefs.current[catKey] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(catKey, e.target.files)}
                    />
                    <input
                      ref={(el) => { galleryInputRefs.current[catKey] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(catKey, e.target.files)}
                    />
                  </div>
                  {catPhotos.length > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(catKey, catPhotos)}>
                      <SortableContext items={photoIds} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {catPhotos.map((photo: any) => (
                            <SortablePhotoItem
                              key={photo.id}
                              photo={photo}
                              onDelete={(id) => setDeletingPhotoId(id)}
                              onPreview={(url) => setLightboxImg(url)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Complete Survey Button */}
        {!isSurveyed && (
          <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">สำรวจเสร็จสิ้น?</p>
                    <p className="text-xs text-muted-foreground">กดปุ่มเมื่อสำรวจหน้างานเรียบร้อยแล้ว</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowCompleteSurveyConfirm(true)}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                  disabled={completeSurveyMut.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {completeSurveyMut.isPending ? "กำลังบันทึก..." : "สำรวจเสร็จสิ้น"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isSurveyed && (
          <Card className="border-0 shadow-sm bg-blue-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-sm text-blue-800">สำรวจเสร็จสิ้นแล้ว</p>
                <p className="text-xs text-muted-foreground">ยังสามารถอัพรูปและแก้ไขข้อมูลเทคนิคได้</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Postpone/Cancel Buttons */}
        {!isPostponedOrCancelled && s.status !== "won" && s.status !== "lost" && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <PauseCircle className="h-5 w-5 text-yellow-500" />
                  <p className="text-sm text-muted-foreground">ต้องการเลื่อนหรือยกเลิกสำรวจ?</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => setShowPostponeDialog(true)}>
                    <PauseCircle className="h-4 w-4" /> เลื่อน
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setShowCancelDialog(true)}>
                    <XCircle className="h-4 w-4" /> ยกเลิก
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isPostponedOrCancelled && (
          <Card className={`border-0 shadow-sm ${s.status === 'postponed' ? 'bg-yellow-50/50 border-l-4 border-l-yellow-400' : 'bg-red-50/50 border-l-4 border-l-red-400'}`}>
            <CardContent className="p-4 flex items-center gap-3">
              {s.status === 'postponed' ? <PauseCircle className="h-5 w-5 text-yellow-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <div>
                <p className={`font-medium text-sm ${s.status === 'postponed' ? 'text-yellow-800' : 'text-red-800'}`}>
                  {s.status === 'postponed' ? 'งานสำรวจถูกเลื่อน' : 'งานสำรวจถูกยกเลิก'}
                </p>
                <p className="text-xs text-muted-foreground">กรุณาติดต่อแอดมินเพื่อดำเนินการต่อ</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last updated */}
        {s.updatedAt && (
          <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            แก้ไขล่าสุด: {new Date(s.updatedAt).toLocaleString("th-TH")}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 z-[101] bg-black/60 text-white rounded-full p-2" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </button>
          <div className="w-full h-full flex items-center justify-center p-2 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImg}
              alt="Preview"
              className="max-w-full max-h-full object-contain select-none"
              style={{ touchAction: "pinch-zoom" }}
              onClick={() => setLightboxImg(null)}
            />
          </div>
        </div>
      )}

      {/* Delete Photo Confirm */}
      <AlertDialog open={!!deletingPhotoId} onOpenChange={() => setDeletingPhotoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันลบรูป?</AlertDialogTitle>
            <AlertDialogDescription>รูปจะถูกลบถาวรและไม่สามารถกู้คืนได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingPhotoId && handleDeletePhoto(deletingPhotoId)}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Survey Confirm */}
      <AlertDialog open={showCompleteSurveyConfirm} onOpenChange={setShowCompleteSurveyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันสำรวจเสร็จสิ้น?</AlertDialogTitle>
            <AlertDialogDescription>
              สถานะจะเปลี่ยนเป็น "สำรวจเสร็จ" คุณยังสามารถอัพรูปและแก้ไขข้อมูลเพิ่มเติมได้ภายหลัง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => completeSurveyMut.mutate({ token, surveyId })}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Postpone Survey Dialog */}
      <Dialog open={showPostponeDialog} onOpenChange={(open) => { if (!open) { setShowPostponeDialog(false); setPostponeReason(""); setActionByName(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PauseCircle className="h-5 w-5 text-yellow-600" /> เลื่อนสำรวจ</DialogTitle>
            <DialogDescription>สถานะจะเปลี่ยนเป็น "เลื่อนสำรวจ" รอนัดวันใหม่</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">ชื่อผู้ดำเนินการ <span className="text-red-500">*</span></Label>
              <Input placeholder="ชื่อของคุณ..." value={actionByName} onChange={(e) => setActionByName(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">สาเหตุ <span className="text-red-500">*</span></Label>
              <Textarea placeholder="ระบุสาเหตุที่ต้องเลื่อน..." value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPostponeDialog(false); setPostponeReason(""); setActionByName(""); }}>ยกเลิก</Button>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700 text-white gap-1.5"
              disabled={!postponeReason.trim() || !actionByName.trim() || postponeSurveyMut.isPending}
              onClick={() => postponeSurveyMut.mutate({ token, surveyId, reason: postponeReason.trim(), actionBy: actionByName.trim(), actionByRole: "surveyor" })}
            >
              <PauseCircle className="h-4 w-4" /> ยืนยันเลื่อน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Survey Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => { if (!open) { setShowCancelDialog(false); setCancelReason(""); setActionByName(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" /> ยกเลิกสำรวจ</DialogTitle>
            <DialogDescription>สถานะจะเปลี่ยนเป็น "ยกเลิก" สามารถเปิดใหม่ได้ภายหลัง</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">ชื่อผู้ดำเนินการ <span className="text-red-500">*</span></Label>
              <Input placeholder="ชื่อของคุณ..." value={actionByName} onChange={(e) => setActionByName(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">สาเหตุ <span className="text-red-500">*</span></Label>
              <Textarea placeholder="ระบุสาเหตุที่ต้องยกเลิก..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancelReason(""); setActionByName(""); }}>ยกเลิก</Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={!cancelReason.trim() || !actionByName.trim() || cancelSurveyMut.isPending}
              onClick={() => cancelSurveyMut.mutate({ token, surveyId, reason: cancelReason.trim(), actionBy: actionByName.trim(), actionByRole: "surveyor" })}
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
            utils.shareLink.getByToken.invalidate({ token });
          }
        }}
        onDismiss={clearUploadState}
      />
    </div>
  );
}


/* ==================== TEMPLATE FIELDS SECTION ==================== */
function TemplateFieldsSection({ templateData, formValues, otherValues, dirty, saving, onUpdateVal, onUpdateOther, onSave, onCancel }: {
  templateData: any;
  formValues: Record<number, string>;
  otherValues: Record<number, string>;
  dirty: boolean;
  saving: boolean;
  onUpdateVal: (fieldId: number, value: string) => void;
  onUpdateOther: (fieldId: number, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const fields = templateData.fields || [];

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

  const [saved, setSaved] = useState(false);

  // Show "saved" indicator for 3 seconds after successful save
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> {templateData.name}
          </CardTitle>
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
                    onChange={(v) => onUpdateVal(field.id, v)}
                    onOtherChange={(v) => onUpdateOther(field.id, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          {dirty && (
            <Button variant="outline" className="flex-1 gap-2" onClick={onCancel}>
              <X className="h-4 w-4" /> ยกเลิกการแก้ไข
            </Button>
          )}
          <Button
            className={`flex-1 gap-2 ${saved ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={() => { onSave(); setSaved(true); }}
            disabled={saving || !dirty}
          >
            {saving ? (
              <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> กำลังบันทึก...</>
            ) : saved ? (
              <><CheckCircle2 className="h-4 w-4" /> บันทึกสำเร็จ!</>
            ) : (
              <><Save className="h-4 w-4" /> บันทึกข้อมูล</>
            )}
          </Button>
        </div>
        {saved && (
          <p className="text-center text-xs text-green-600 mt-2 font-medium">ข้อมูลถูกบันทึกเรียบร้อยแล้ว</p>
        )}
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
