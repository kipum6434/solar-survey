import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP, PHOTO_CATEGORY_MAP } from "@/lib/constants";
import { formatPhone } from "@/lib/formatPhone";
import { useParams } from "wouter";
import { useState, useRef, useCallback, useMemo } from "react";
import { compressImages } from "@/lib/imageCompression";
import {
  Camera, MapPin, Calendar, Phone, Mail, Zap, Home, Gauge,
  X, Image, Sun, Wrench, FolderDown, Download, Upload, Trash2,
  Package, CheckCircle2, Clock, AlertTriangle, HardHat, Send, Plus,
  CircleAlert, CircleCheck, Info, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { exportSurveyPDF, exportInstallationPDF, type ImageProxyFn, type CompanyInfo } from "@/lib/pdfExport";
import { FileDown } from "lucide-react";

export default function SharedSurvey() {
  const params = useParams<{ token: string }>();
  const { data, isLoading, error } = trpc.shareLink.getByToken.useQuery({ token: params.token || "" });
  const { data: photoCategories } = trpc.photoCategory.list.useQuery();
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [showCompleteSurveyConfirm, setShowCompleteSurveyConfirm] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string>("");

  const proxyImageMut = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  // Company settings for PDF header
  const { data: companySettings } = trpc.companySettings.get.useQuery(undefined, { retry: false });
  const companyInfoForPdf: CompanyInfo | null = companySettings ? {
    companyName: companySettings.companyName,
    phone: companySettings.phone,
    address: companySettings.address,
    logoUrl: companySettings.logoUrl,
  } : null;

  const completeSurveyMut = trpc.survey.publicCompleteSurvey.useMutation({
    onSuccess: () => { toast.success("สำรวจเสร็จสิ้นแล้ว"); window.location.reload(); },
    onError: (e: any) => { toast.error(e.message || "เกิดข้อผิดพลาด"); },
  });

  // Build dynamic category map from DB, fallback to static
  const categoryMap: Record<string, string> = { ...PHOTO_CATEGORY_MAP };
  if (photoCategories) {
    for (const cat of photoCategories) {
      categoryMap[cat.key] = cat.label;
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Sun className="h-12 w-12 mx-auto mb-3 text-amber-400 animate-spin" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error || !data || 'error' in data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
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

  const s = 'survey' in data ? data.survey : null;
  const c = 'customer' in data ? data.customer : null;
  const photosData = 'photos' in data ? data.photos : [];
  const surveyId = s?.id || 0;
  const token = params.token || "";
  if (!s || !c) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Sun className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">ข้อมูลสำรวจ - {c.name}</h1>
                <p className="text-xs text-muted-foreground">Solar Survey Report</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={isExportingPDF}
              onClick={async () => {
                setIsExportingPDF(true);
                try {
                  await exportSurveyPDF(
                    {
                      id: s.id,
                      status: s.status,
                      scheduledDate: s.scheduledDate,
                      systemSize: s.systemSize,
                      panelCount: s.panelCount,
                      panelBrand: s.panelBrand,
                      inverterModel: s.inverterModel,
                      quotedPrice: s.quotedPrice,
                      systemType: s.systemType,
                      needBattery: s.needBattery,
                      needOptimizer: s.needOptimizer,
                      surveyNotes: s.surveyNotes,
                    },
                    {
                      name: c.name,
                      phone: c.phone,
                      email: c.email,
                      fullAddress: c.fullAddress,
                      subDistrict: c.subDistrict,
                      district: c.district,
                      province: c.province,
                      postalCode: c.postalCode,
                      electricityBill: c.electricityBill,
                      roofType: c.roofType,
                      roofArea: c.roofArea,
                      phaseType: c.phaseType,
                      meterSize: c.meterSize,
                      notes: c.notes,
                    },
                    photosData.map((p: any) => ({ url: p.url, category: p.category, caption: p.caption })),
                    categoryMap,
                    (step) => setPdfProgress(step),
                    imageProxyFn,
                    companyInfoForPdf,
                  );
                  toast.success("Export PDF สำเร็จ");
                } catch (err: any) {
                  toast.error(err?.message || "Export PDF ล้มเหลว");
                } finally {
                  setIsExportingPDF(false);
                  setPdfProgress("");
                }            }}
            >
              <FileDown className="h-3.5 w-3.5" />
              {isExportingPDF ? pdfProgress || "กำลัง Export..." : "Export PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status & Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">ข้อมูลลูกค้า</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-xs border-0`}>{statusInfo.label}</Badge>
                {s.scheduledDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(s.scheduledDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              {s.installationDate && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs border-0">
                    <Wrench className="h-3 w-3 mr-1" />
                    นัดติดตั้ง: {new Date(s.installationDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                  </Badge>
                </div>
              )}
              {c.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{formatPhone(c.phone)}</div>}
              {c.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{c.email}</div>}
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
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">ข้อมูลทางเทคนิค</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {c.electricityBill && <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />ค่าไฟ: {c.electricityBill} บาท/เดือน</div>}
              {c.roofType && <div className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />หลังคา: {c.roofType}</div>}
              {c.phaseType && <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-muted-foreground" />ระบบไฟ: {c.phaseType === "single" ? "1 เฟส" : "3 เฟส"}</div>}
              {s.systemSize && <div className="flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" />ขนาดระบบ: {s.systemSize} kW</div>}
              {s.panelCount && <div className="flex items-center gap-2">จำนวนแผง: {s.panelCount} แผง</div>}
              {s.inverterModel && <div className="flex items-center gap-2">อินเวอร์เตอร์: {s.inverterModel}</div>}
            </CardContent>
          </Card>
        </div>

        {/* Photos */}
        {photosData && photosData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Camera className="h-4 w-4" /> รูปภาพหน้างาน ({photosData.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isDownloadingAll}
                  onClick={async () => {
                    setIsDownloadingAll(true);
                    try {
                      const JSZip = (await import('jszip')).default;
                      const zip = new JSZip();
                      const folder = zip.folder(`photos-${c.name}`) || zip;
                      for (let i = 0; i < photosData.length; i++) {
                        const photo = photosData[i] as any;
                        try {
                          const resp = await fetch(photo.url);
                          const blob = await resp.blob();
                          const ext = photo.fileName?.split('.').pop() || 'jpg';
                          const catLabel = categoryMap[photo.category] || photo.category || 'other';
                          folder.file(`${catLabel}_${i + 1}.${ext}`, blob);
                        } catch { /* skip failed */ }
                      }
                      const content = await zip.generateAsync({ type: 'blob' });
                      const url = URL.createObjectURL(content);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `photos-${c.name}-${new Date().toISOString().slice(0, 10)}.zip`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch { /* ignore */ }
                    setIsDownloadingAll(false);
                  }}
                >
                  <FolderDown className="h-3.5 w-3.5" />
                  {isDownloadingAll ? 'กำลังดาวน์โหลด...' : `ดาวน์โหลดทั้งหมด`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {photosData.map((photo: any) => (
                  <div key={photo.id} className="relative rounded-lg overflow-hidden bg-muted aspect-square cursor-pointer group" onClick={() => setLightboxImg(photo.url)}>
                    <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <Badge variant="secondary" className="text-[9px] bg-white/80 text-foreground">
                        {categoryMap[photo.category] || photo.category}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents section hidden from public share link - only visible to logged-in users in SurveyDetail */}

        {/* ปุ่มสำรวจเสร็จสิ้น — แสดงเมื่อสถานะยังไม่ใช่ surveyed/won */}
        {s.status !== "surveyed" && s.status !== "won" && s.status !== "lost" && s.status !== "cancelled" && (
          <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">สำรวจเสร็จแล้วหรือยัง?</p>
                    <p className="text-xs text-emerald-600">กดปุ่มเพื่อยืนยันว่าสำรวจเสร็จสิ้นแล้ว</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setShowCompleteSurveyConfirm(true)}
                  disabled={completeSurveyMut.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {completeSurveyMut.isPending ? "กำลังดำเนินการ..." : "สำรวจเสร็จสิ้น"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {s.status === "surveyed" && (
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-700">สำรวจเสร็จสิ้นแล้ว</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Survey Notes */}
        {s.surveyNotes && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">หมายเหตุ</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.surveyNotes}</p></CardContent>
          </Card>
        )}

        {/* Installation Delivery Section */}
        <PublicDeliverySection surveyId={surveyId} token={token} surveyData={s} customerData={c} />

        <div className="text-center py-6 text-xs text-muted-foreground">
          Solar Survey Management System
        </div>
      </div>

      {/* Confirm สำรวจเสร็จสิ้น Dialog */}
      <AlertDialog open={showCompleteSurveyConfirm} onOpenChange={setShowCompleteSurveyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันสำรวจเสร็จสิ้น</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการยืนยันว่าการสำรวจเสร็จสิ้นแล้วหรือไม่?
              <br />
              <span className="text-xs mt-1 block">สถานะจะเปลี่ยนเป็น "สำรวจเสร็จ"</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                completeSurveyMut.mutate({ token: params.token || "", surveyId });
                setShowCompleteSurveyConfirm(false);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> สำรวจเสร็จสิ้น
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightboxImg} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/* ==================== PUBLIC DELIVERY SECTION ==================== */
const DELIVERY_STATUS_INFO: Record<string, { label: string; color: string; bg: string; icon: any; description: string }> = {
  pending: { label: "รอส่งมอบ", color: "text-gray-700", bg: "bg-gray-50", icon: Clock, description: "อัปโหลดรูปติดตั้งแล้วกดส่งมอบงาน" },
  submitted: { label: "รออนุมัติ", color: "text-amber-700", bg: "bg-amber-50", icon: Package, description: "ส่งมอบงานแล้ว รอผู้ดูแลอนุมัติ" },
  approved: { label: "อนุมัติแล้ว", color: "text-green-700", bg: "bg-green-50", icon: CheckCircle2, description: "งานส่งมอบได้รับการอนุมัติเรียบร้อย" },
  rejected: { label: "ถูกปฏิเสธ", color: "text-red-700", bg: "bg-red-50", icon: AlertTriangle, description: "งานถูกปฏิเสธ กรุณาแก้ไขแล้วส่งใหม่" },
};

function PublicDeliverySection({ surveyId, token, surveyData, customerData }: { surveyId: number; token: string; surveyData?: any; customerData?: any }) {
  const [isExportingInstPDF, setIsExportingInstPDF] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const activeCategory = useRef<string>("");

  const proxyImageMut2 = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut2.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  const { data: companySettings2 } = trpc.companySettings.get.useQuery(undefined, { retry: false });
  const companyInfoForPdf2: CompanyInfo | null = companySettings2 ? {
    companyName: companySettings2.companyName,
    phone: companySettings2.phone,
    address: companySettings2.address,
    logoUrl: companySettings2.logoUrl,
  } : null;

  const { data: deliveryInfo, refetch: refetchDelivery } = trpc.delivery.publicInfo.useQuery(
    { token, surveyId },
    { enabled: !!token && !!surveyId }
  );
  const { data: installPhotos = [], refetch: refetchPhotos } = trpc.installationPhoto.publicList.useQuery(
    { token, surveyId },
    { enabled: !!token && !!surveyId }
  );
  const { data: photoCategories = [] } = trpc.installationPhotoCategory.list.useQuery();
  const { data: validation, refetch: refetchValidation } = trpc.installationPhotoCategory.validateForDelivery.useQuery(
    { surveyId },
    { enabled: !!surveyId }
  );

  const progressPercent = useMemo(() => {
    if (!validation || validation.requiredCount === 0) return 100;
    return Math.round((validation.completedRequired / validation.requiredCount) * 100);
  }, [validation]);

  const uploadMutation = trpc.installationPhoto.publicUpload.useMutation({
    onSuccess: () => { refetchPhotos(); refetchValidation(); toast.success("อัปโหลดสำเร็จ"); setUploadingCategory(null); },
    onError: (e: any) => { toast.error(e.message || "อัปโหลดล้มเหลว"); setUploadingCategory(null); },
  });
  const deleteMutation = trpc.installationPhoto.publicDelete.useMutation({
    onSuccess: () => { refetchPhotos(); refetchValidation(); toast.success("ลบรูปสำเร็จ"); setConfirmDeleteId(null); },
    onError: (e: any) => { toast.error(e.message || "ลบล้มเหลว"); setConfirmDeleteId(null); },
  });
  const submitMutation = trpc.delivery.publicSubmit.useMutation({
    onSuccess: () => { refetchDelivery(); toast.success("ส่งมอบงานสำเร็จ!"); setConfirmSubmit(false); },
    onError: (e: any) => { toast.error(e.message || "ส่งมอบล้มเหลว"); setConfirmSubmit(false); },
  });

  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const category = activeCategory.current;
    setUploadingCategory(category);
    const validFiles = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024);
    if (validFiles.length === 0) { setUploadingCategory(null); return; }
    setUploadProgress({ current: 0, total: validFiles.length });
    try {
      const compressed = await compressImages(validFiles, (done, total) => {
        setUploadProgress({ current: done, total });
      });
      const CHUNK = 3;
      let uploaded = 0;
      for (let i = 0; i < compressed.length; i += CHUNK) {
        const chunk = compressed.slice(i, i + CHUNK);
        await Promise.all(chunk.map(({ base64, fileName }) =>
          uploadMutation.mutateAsync({ token, surveyId, fileName, fileData: base64, category })
        ));
        uploaded += chunk.length;
        setUploadProgress({ current: uploaded, total: compressed.length });
      }
      toast.success(`อัพโหลดสำเร็จ ${compressed.length} รูป`);
    } catch (err: any) {
      toast.error(err?.message || "อัพโหลดล้มเหลว");
    } finally {
      setUploadProgress(null);
      setUploadingCategory(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, [token, surveyId, uploadMutation]);

  const triggerUpload = (categoryKey: string) => {
    activeCategory.current = categoryKey;
    fileInputRef.current?.click();
  };

  const triggerCamera = (categoryKey: string) => {
    activeCategory.current = categoryKey;
    cameraInputRef.current?.click();
  };

  const deliveryStatus = deliveryInfo?.deliveryStatus || "pending";
  const statusInfo = DELIVERY_STATUS_INFO[deliveryStatus] || DELIVERY_STATUS_INFO.pending;
  const StatusIcon = statusInfo.icon;
  const canUpload = deliveryStatus === "pending" || deliveryStatus === "rejected";
  const canSubmit = canUpload && installPhotos.length > 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardHat className="h-4 w-4" /> ส่งมอบงานติดตั้ง
          </CardTitle>
          <div className="flex items-center gap-2">
            {installPhotos.length > 0 && surveyData && customerData && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={isExportingInstPDF}
                onClick={async () => {
                  setIsExportingInstPDF(true);
                  try {
                    const catMap: Record<string, string> = {};
                    for (const cat of photoCategories) catMap[cat.key] = cat.label;
                    await exportInstallationPDF(
                      {
                        id: surveyData.id, status: surveyData.status,
                        systemSize: surveyData.systemSize, panelCount: surveyData.panelCount,
                        panelBrand: surveyData.panelBrand, inverterModel: surveyData.inverterModel,
                        systemType: surveyData.systemType,
                        installationDate: surveyData.installationDate,
                        installationStatus: surveyData.installationStatus,
                        completedAt: surveyData.completedAt,
                      },
                      {
                        name: customerData.name, phone: customerData.phone,
                        fullAddress: customerData.fullAddress,
                        subDistrict: customerData.subDistrict,
                        district: customerData.district,
                        province: customerData.province,
                        postalCode: customerData.postalCode,
                      },
                      installPhotos.map((p: any) => ({ url: p.url, category: p.category, caption: p.caption })),
                      catMap,
                      deliveryInfo ? {
                        deliveryStatus: deliveryInfo.deliveryStatus || undefined,
                        deliverySubmittedAt: deliveryInfo.deliverySubmittedAt || undefined,
                        deliveryApprovedAt: deliveryInfo.deliveryApprovedAt || undefined,
                        deliveryRejectionReason: deliveryInfo.deliveryRejectionReason || undefined,
                      } : null,
                      undefined,
                      imageProxyFn,
                      companyInfoForPdf2,
                    );
                    toast.success("Export PDF สำเร็จ");
                  } catch (err: any) {
                    toast.error(err?.message || "Export PDF ล้มเหลว");
                  } finally {
                    setIsExportingInstPDF(false);
                  }
                }}
              >
                <FileDown className="h-3.5 w-3.5" />
                {isExportingInstPDF ? "กำลัง Export..." : "Export PDF"}
              </Button>
            )}
            <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-xs border-0 flex items-center gap-1`}>
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{statusInfo.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rejection reason */}
        {deliveryStatus === "rejected" && deliveryInfo?.deliveryRejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-700 mb-1">เหตุผลที่ถูกปฏิเสธ:</p>
            <p className="text-sm text-red-600">{deliveryInfo.deliveryRejectionReason}</p>
          </div>
        )}

        {/* Hidden file input (gallery) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        {/* Hidden camera input (direct capture) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Progress bar for required categories */}
        {validation && validation.requiredCount > 0 && (
          <div className="p-3 rounded-lg bg-muted/40 border">
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
              <div className="mt-2">
                <p className="text-[11px] text-red-600 font-medium mb-1">ยังขาด:</p>
                <div className="flex flex-wrap gap-1">
                  {validation.missingRequired.map((c: any) => (
                    <Badge key={c.key} variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50 gap-1">
                      <XCircle className="h-2.5 w-2.5" /> {c.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {validation.missingConditional.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] text-amber-600 font-medium mb-1">ถ้ามี (ไม่บังคับ):</p>
                <div className="flex flex-wrap gap-1">
                  {validation.missingConditional.map((c: any) => (
                    <Badge key={c.key} variant="outline" className="text-[10px] border-amber-200 text-amber-600 bg-amber-50 gap-1">
                      <Info className="h-2.5 w-2.5" /> {c.label}
                      {c.conditionNote && <span className="text-[9px] opacity-70">({c.conditionNote})</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photo categories grid */}
        <div className="space-y-4">
          {photoCategories.length > 0 ? (
            photoCategories.map((cat: any) => {
              const catPhotos = installPhotos.filter((p: any) => p.category === cat.key);
              return (
                <div key={cat.key} className={`border rounded-lg p-3 ${cat.isRequired && catPhotos.length === 0 ? 'border-red-200 bg-red-50/30' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                      {cat.label}
                      {catPhotos.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{catPhotos.length}</Badge>
                      )}
                      {cat.isRequired && (
                        <Badge className={`text-[9px] border-0 ${catPhotos.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {catPhotos.length > 0 ? '✓ จำเป็น' : '✗ จำเป็น'}
                        </Badge>
                      )}
                      {cat.isConditional && (
                        <Badge className="text-[9px] border-0 bg-amber-100 text-amber-700">
                          {cat.conditionNote || 'ถ้ามี'}
                        </Badge>
                      )}
                    </h4>
                    {canUpload && (
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 px-2.5"
                          onClick={() => triggerCamera(cat.key)}
                          disabled={uploadingCategory === cat.key}
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">ถ่ายรูป</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 px-2.5"
                          onClick={() => triggerUpload(cat.key)}
                          disabled={uploadingCategory === cat.key}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{uploadingCategory === cat.key ? "อัปโหลด..." : "เลือกรูป"}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                  {catPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {catPhotos.map((photo: any) => (
                        <div key={photo.id} className="relative rounded-lg overflow-hidden bg-muted aspect-square group">
                          <img
                            src={photo.url}
                            alt={photo.caption || cat.label}
                            className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                            onClick={() => setLightboxImg(photo.url)}
                          />
                          {canUpload && (
                            <button
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(photo.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`text-center py-4 text-xs text-muted-foreground rounded-lg ${cat.isRequired ? 'bg-red-50/50' : 'bg-muted/30'}`}>
                      {canUpload ? (
                        <>
                          กดปุ่ม "ถ่ายรูป" หรือ "เลือกรูป" เพื่ออัปโหลด
                          {cat.isRequired && <span className="text-red-500 font-medium block mt-0.5">จำเป็นต้องอัปโหลด</span>}
                          {cat.isConditional && <span className="text-amber-500 block mt-0.5">{cat.conditionNote || 'ถ้ามี'}</span>}
                        </>
                      ) : "ไม่มีรูป"}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* Fallback when no photo categories are configured */
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                  รูปติดตั้ง
                  {installPhotos.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{installPhotos.length}</Badge>
                  )}
                </h4>
                {canUpload && (
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 px-2.5"
                      onClick={() => triggerCamera("other")}
                      disabled={uploadingCategory === "other"}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">ถ่ายรูป</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1 px-2.5"
                      onClick={() => triggerUpload("other")}
                      disabled={uploadingCategory === "other"}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{uploadingCategory === "other" ? "อัปโหลด..." : "เลือกรูป"}</span>
                    </Button>
                  </div>
                )}
              </div>
              {installPhotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {installPhotos.map((photo: any) => (
                    <div key={photo.id} className="relative rounded-lg overflow-hidden bg-muted aspect-square group">
                      <img
                        src={photo.url}
                        alt={photo.caption || "รูปติดตั้ง"}
                        className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                        onClick={() => setLightboxImg(photo.url)}
                      />
                      {canUpload && (
                        <button
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(photo.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground bg-muted/30 rounded-lg">
                  <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {canUpload ? "กดปุ่ม \"ถ่ายรูป\" หรือ \"เลือกรูป\" เพื่ออัปโหลดรูปติดตั้ง" : "ยังไม่มีรูปติดตั้ง"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit button */}
        {canUpload && (
          <div className="pt-2 border-t">
            <Button
              className="w-full gap-2"
              size="lg"
              disabled={!canSubmit || submitMutation.isPending || (validation ? !validation.isComplete : false)}
              onClick={() => setConfirmSubmit(true)}
            >
              <Send className="h-4 w-4" />
              {submitMutation.isPending ? "กำลังส่งมอบ..." : "ส่งมอบงานติดตั้ง"}
            </Button>
            {installPhotos.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">กรุณาอัปโหลดรูปอย่างน้อย 1 รูปก่อนส่งมอบ</p>
            )}
            {validation && !validation.isComplete && installPhotos.length > 0 && (
              <p className="text-xs text-red-500 text-center mt-2">
                ยังขาดรูปหมวดหมู่ที่จำเป็น {validation.missingRequired.length} หมวด กรุณาอัปโหลดให้ครบก่อนส่งมอบ
              </p>
            )}
          </div>
        )}

        {/* Approved/submitted info */}
        {deliveryStatus === "approved" && deliveryInfo?.deliveryApprovedAt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700">งานส่งมอบเรียบร้อย</p>
            <p className="text-xs text-green-600 mt-1">
              อนุมัติเมื่อ {new Date(deliveryInfo.deliveryApprovedAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        )}

        {deliveryStatus === "submitted" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <Package className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-700">ส่งมอบงานแล้ว</p>
            <p className="text-xs text-amber-600 mt-1">รอผู้ดูแลตรวจสอบและอนุมัติ</p>
          </div>
        )}
      </CardContent>

      {/* Confirm submit dialog */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันส่งมอบงาน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณมีรูปติดตั้งทั้งหมด {installPhotos.length} รูป ต้องการส่งมอบงานนี้ใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => submitMutation.mutate({ token, surveyId })}>
              ยืนยันส่งมอบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete dialog */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรูปนี้?</AlertDialogTitle>
            <AlertDialogDescription>รูปที่ลบจะไม่สามารถกู้คืนได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDeleteId && deleteMutation.mutate({ token, surveyId, id: confirmDeleteId })}>
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightboxImg} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </Card>
  );
}
