import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import { formatPhone } from "@/lib/formatPhone";
import { useParams } from "wouter";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import SignaturePad from "signature_pad";
import { compressImages } from "@/lib/imageCompression";
import { useUploadWithRetry } from "@/hooks/useUploadWithRetry";
import { UploadStatusBar } from "@/components/UploadStatusBar";
import {
  Camera, MapPin, Calendar, Phone, Mail, Zap, Home, Gauge,
  X, Image, Sun, Wrench, FolderDown, Download, Upload, Trash2,
  Package, CheckCircle2, Clock, AlertTriangle, HardHat, Send, Plus,
  CircleAlert, CircleCheck, Info, XCircle, PauseCircle, FileText, MessageSquare,
  PenTool, RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import type { ImageProxyFn, CompanyInfo } from "@/lib/pdfExport";
const getPdfExport = () => import("@/lib/pdfExport");
import { FileDown } from "lucide-react";

export default function SharedSurvey() {
  const params = useParams<{ token: string }>();
  const { data, isLoading, error } = trpc.shareLink.getByToken.useQuery({ token: params.token || "" });
  const { data: photoCategories } = trpc.photoCategory.list.useQuery();
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [showCompleteSurveyConfirm, setShowCompleteSurveyConfirm] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<string>("");
  const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null);
  const [captionText, setCaptionText] = useState("");

  const proxyImageMut = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  // Company settings for PDF header
  const { data: companySettings } = trpc.companySettings.get.useQuery(undefined, { retry: false });
  const { data: surveyDocSetting } = trpc.documentSettings.getByKey.useQuery({ key: "survey_doc_number" }, { retry: false });
  const companyInfoForPdf: CompanyInfo | null = companySettings ? {
    companyName: companySettings.companyName,
    phone: companySettings.phone,
    address: companySettings.address,
    logoUrl: companySettings.logoUrl,
    photoBorderColor: companySettings.photoBorderColor,
  } : null;

  const completeSurveyMut = trpc.survey.publicCompleteSurvey.useMutation({
    onSuccess: () => { toast.success("สำรวจเสร็จสิ้นแล้ว"); window.location.reload(); },
    onError: (e: any) => { toast.error(e.message || "เกิดข้อผิดพลาด"); },
  });

  // Build category map from DB only (photo_categories table)
  const categoryMap: Record<string, string> = {};
  const categoryOrder: string[] = [];
  if (photoCategories) {
    for (const cat of photoCategories) {
      categoryMap[cat.key] = cat.label;
      categoryOrder.push(cat.key);
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
                  const { exportSurveyPDF } = await getPdfExport();
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
                    categoryOrder,
                    surveyDocSetting?.documentNumber,
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
              {c.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />{formatPhone(c.phone)}
                  <a href={`tel:${c.phone}`} className="ml-2 inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-full transition-colors">
                    <Phone className="h-3 w-3" />โทรหาลูกค้า
                  </a>
                </div>
              )}
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
              {s.panelBrand && <div className="flex items-center gap-2">ยี่ห้อแผง: {s.panelBrand}</div>}
              {s.inverterModel && <div className="flex items-center gap-2">อินเวอร์เตอร์: {s.inverterModel}</div>}

              {s.systemType && <div className="flex items-center gap-2">ประเภทระบบ: {s.systemType === "hybrid" ? "Hybrid" : s.systemType === "string" ? "String" : s.systemType === "micro" ? "Micro" : "ทั้งสอง"}</div>}
              {s.needBattery && s.needBattery !== "-" && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 text-blue-800 font-medium">
                  <Package className="h-4 w-4 text-blue-600" />แบตเตอรี่: {s.needBattery}
                </div>
              )}
              {s.needOptimizer && s.needOptimizer !== "-" && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-md px-3 py-1.5 text-purple-800 font-medium">
                  <Wrench className="h-4 w-4 text-purple-600" />Optimizer: {s.needOptimizer}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Template Fields Card */}
        {c.source && <PublicTemplateFieldsCard sourceName={c.source} surveyId={surveyId} token={token} />}

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
                    setDownloadProgress({ current: 0, total: 100 });
                    try {
                      // Use server-side ZIP generation
                      const customerName = encodeURIComponent(c.name);
                      const downloadUrl = `/api/photos/download-zip/${surveyId}?customerName=${customerName}`;
                      
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
                    } catch { /* ignore */ }
                    setIsDownloadingAll(false);
                    setDownloadProgress({ current: 0, total: 0 });
                  }}
                >
                  <FolderDown className="h-3.5 w-3.5" />
                  {isDownloadingAll
                    ? `กำลังโหลด ${downloadProgress.current}%`
                    : `ดาวน์โหลดทั้งหมด`}
                </Button>
                {isDownloadingAll && (
                  <div className="w-full mt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>กำลังดาวน์โหลดรูปภาพ ({photosData.length} รูป)...</span>
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {photosData.map((photo: any) => (
                  <div key={photo.id} className="flex flex-col">
                    <div className="relative rounded-lg overflow-hidden bg-muted aspect-square cursor-pointer group" onClick={() => setLightboxImg(photo.url)}>
                      <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <Badge variant="secondary" className="text-[9px] bg-white/80 text-foreground">
                          {categoryMap[photo.category] || photo.category}
                        </Badge>
                      </div>
                      {/* Caption edit button overlay */}
                      <button
                        className="absolute top-1 right-1 bg-white/90 hover:bg-blue-100 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setEditingCaptionId(photo.id); setCaptionText(photo.caption || ""); }}
                      >
                        <MessageSquare className="h-3 w-3 text-blue-600" />
                      </button>
                    </div>
                    {/* Caption display/edit */}
                    {editingCaptionId === photo.id ? (
                      <PhotoCaptionEditor
                        photoId={photo.id}
                        token={token}
                        captionText={captionText}
                        setCaptionText={setCaptionText}
                        onDone={() => setEditingCaptionId(null)}
                      />
                    ) : photo.caption ? (
                      <p className="mt-1 text-xs text-muted-foreground truncate cursor-pointer hover:text-foreground px-1" onClick={() => { setEditingCaptionId(photo.id); setCaptionText(photo.caption || ""); }} title={photo.caption}>
                        <MessageSquare className="h-3 w-3 inline mr-1" />{photo.caption}
                      </p>
                    ) : null}
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
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 z-[101] bg-black/60 text-white rounded-full p-2" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </button>
          <div className="w-full h-full flex items-center justify-center p-2 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="Preview" className="max-w-full max-h-full object-contain select-none" style={{ touchAction: "pinch-zoom" }} onClick={() => setLightboxImg(null)} />
          </div>
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

  // Technician signature state
  const [techName, setTechName] = useState("");
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (confirmSubmit && sigCanvasRef.current && !sigPadRef.current) {
      const canvas = sigCanvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      sigPadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
    }
    if (!confirmSubmit) {
      sigPadRef.current = null;
    }
  }, [confirmSubmit]);

  const handleConfirmSubmit = () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      toast.error("กรุณาเซ็นลายเซ็นก่อนส่งมอบ");
      return;
    }
    if (!techName.trim()) {
      toast.error("กรุณากรอกชื่อช่างผู้ติดตั้ง");
      return;
    }
    const sigData = sigPadRef.current.toDataURL("image/png");
    submitMutation.mutate({
      token,
      surveyId,
      technicianSignature: sigData,
      technicianName: techName.trim(),
    });
  };

  const proxyImageMut2 = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut2.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  const { data: companySettings2 } = trpc.companySettings.get.useQuery(undefined, { retry: false });
  const { data: installDocSetting } = trpc.documentSettings.getByKey.useQuery({ key: "install_doc_number" }, { retry: false });
  const companyInfoForPdf2: CompanyInfo | null = companySettings2 ? {
    companyName: companySettings2.companyName,
    phone: companySettings2.phone,
    address: companySettings2.address,
    logoUrl: companySettings2.logoUrl,
    photoBorderColor: companySettings2.photoBorderColor,
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

  // Withdraw delivery mutation
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const withdrawMutation = trpc.delivery.publicWithdraw.useMutation({
    onSuccess: () => { refetchDelivery(); toast.success("ถอนส่งมอบสำเร็จ สามารถแก้ไขรูปได้แล้ว"); setConfirmWithdraw(false); },
    onError: (e: any) => { toast.error(e.message || "ถอนส่งมอบล้มเหลว"); setConfirmWithdraw(false); },
  });

    // Postpone/Cancel Installation state
  const [showPostponeInstallDialog, setShowPostponeInstallDialog] = useState(false);
  const [showCancelInstallDialog, setShowCancelInstallDialog] = useState(false);
  const [postponeInstallReason, setPostponeInstallReason] = useState("");
  const [cancelInstallReason, setCancelInstallReason] = useState("");
  const [installActionByName, setInstallActionByName] = useState("");
  const [newInstallDate, setNewInstallDate] = useState<Date | undefined>(undefined);
  const postponeInstallMut = trpc.survey.publicPostponeInstallation.useMutation({
    onSuccess: () => { toast.success("เลื่อนติดตั้งสำเร็จ"); setShowPostponeInstallDialog(false); setPostponeInstallReason(""); setInstallActionByName(""); setNewInstallDate(undefined); window.location.reload(); },
    onError: (e: any) => toast.error(e.message || "เกิดข้อผิดพลาด"),
  });
  const cancelInstallMut = trpc.survey.publicCancelInstallation.useMutation({
    onSuccess: () => { toast.success("ยกเลิกติดตั้งสำเร็จ"); setShowCancelInstallDialog(false); setCancelInstallReason(""); setInstallActionByName(""); window.location.reload(); },
    onError: (e: any) => toast.error(e.message || "เกิดข้อผิดพลาด"),
  });

  const installStatus = surveyData?.installationStatus || "waiting";
  const isInstallPostponedOrCancelled = installStatus === "postponed" || installStatus === "cancelled";

  const { state: uploadState, uploadFiles: uploadWithRetry, retryFailed, clearState: clearUploadState } = useUploadWithRetry();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const category = activeCategory.current;
    setUploadingCategory(category);
    const validFiles = Array.from(files).filter(f => f.size <= 10 * 1024 * 1024);
    if (validFiles.length === 0) { setUploadingCategory(null); return; }
    try {
      const compressed = await compressImages(validFiles);

      const { successCount, failedCount } = await uploadWithRetry(compressed, async (item) => {
        await uploadMutation.mutateAsync({ token, surveyId, fileName: item.fileName, fileData: item.base64, category });
      });

      if (successCount > 0) {
        refetchPhotos(); refetchValidation();
        toast.success(`อัพโหลดสำเร็จ ${successCount} รูป`);
      }
      if (failedCount > 0) {
        toast.error(`อัพโหลดล้มเหลว ${failedCount} รูป (กดลองใหม่ได้ที่ด้านล่าง)`);
      }
    } catch (err: any) {
      toast.error(err?.message || "อัพโหลดล้มเหลว");
    } finally {
      setUploadingCategory(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, [token, surveyId, uploadMutation, uploadWithRetry, refetchPhotos, refetchValidation]);

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
                    const catOrder: string[] = [];
                    for (const cat of photoCategories) { catMap[cat.key] = cat.label; catOrder.push(cat.key); }
                    const { exportInstallationPDF } = await getPdfExport();
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
                      catOrder,
                      installDocSetting?.documentNumber,
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
                        <div key={photo.id} className="flex flex-col">
                          <div className="relative rounded-lg overflow-hidden bg-muted aspect-square group">
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
                          {photo.caption && (
                            <p className="text-xs text-muted-foreground mt-1 px-0.5 line-clamp-2 italic">{photo.caption}</p>
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
                    <div key={photo.id} className="flex flex-col">
                      <div className="relative rounded-lg overflow-hidden bg-muted aspect-square group">
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
                      {photo.caption && (
                        <p className="text-xs text-muted-foreground mt-1 px-0.5 line-clamp-2 italic">{photo.caption}</p>
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center space-y-3">
            <Package className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm font-medium text-amber-700">ส่งมอบงานแล้ว</p>
            <p className="text-xs text-amber-600">รอผู้ดูแลตรวจสอบและอนุมัติ</p>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => setConfirmWithdraw(true)}
              disabled={withdrawMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {withdrawMutation.isPending ? "กำลังถอน..." : "ถอนส่งมอบ (แก้ไขรูป)"}
            </Button>
            <p className="text-[11px] text-amber-500">กดถอนเพื่อแก้ไข/เพิ่ม/ลบรูป แล้วส่งมอบใหม่อีกครั้ง</p>
          </div>
        )}
      </CardContent>

      {/* Confirm submit dialog with technician signature */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-amber-500" />
              ยืนยันส่งมอบงาน
            </DialogTitle>
            <DialogDescription>
              คุณมีรูปติดตั้งทั้งหมด {installPhotos.length} รูป กรุณาเซ็นลายเซ็นช่างเพื่อยืนยันการส่งมอบ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium">ชื่อช่างผู้ติดตั้ง</Label>
              <Input
                placeholder="กรอกชื่อ-นามสกุล"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">ลายเซ็นช่าง</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={sigCanvasRef}
                  className="w-full touch-none"
                  style={{ height: "150px" }}
                />
              </div>
              <div className="flex justify-end mt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => sigPadRef.current?.clear()}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="h-3 w-3" /> ล้างลายเซ็น
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>ยกเลิก</Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={submitMutation.isPending}
              className="gap-1.5"
            >
              {submitMutation.isPending ? (
                <><span className="animate-spin">&#9696;</span> กำลังส่งมอบ...</>
              ) : (
                <><Send className="h-4 w-4" /> ยืนยันส่งมอบ</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Confirm withdraw dialog */}
      <AlertDialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ถอนส่งมอบงาน?</AlertDialogTitle>
            <AlertDialogDescription>
              สถานะจะกลับเป็น "รออัพรูป" คุณสามารถแก้ไข/เพิ่ม/ลบรูปได้ แล้วกดส่งมอบใหม่อีกครั้งเมื่อพร้อม
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-600 text-white hover:bg-amber-700" onClick={() => withdrawMutation.mutate({ token, surveyId })}>
              ยืนยันถอนส่งมอบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Postpone/Cancel Installation Buttons */}
      <CardContent className="pt-0">
        {!isInstallPostponedOrCancelled && installStatus !== "completed" && installStatus !== "delivered" && (
          <div className="border-t pt-4 mt-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-yellow-500" />
                <p className="text-xs text-muted-foreground">ต้องการเลื่อนหรือยกเลิกติดตั้ง?</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-yellow-300 text-yellow-700 hover:bg-yellow-50" onClick={() => setShowPostponeInstallDialog(true)}>
                  <PauseCircle className="h-3.5 w-3.5" /> เลื่อน
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-red-300 text-red-700 hover:bg-red-50" onClick={() => setShowCancelInstallDialog(true)}>
                  <XCircle className="h-3.5 w-3.5" /> ยกเลิก
                </Button>
              </div>
            </div>
          </div>
        )}

        {isInstallPostponedOrCancelled && (
          <div className={`border-t pt-4 mt-2 rounded-lg p-3 ${installStatus === 'postponed' ? 'bg-yellow-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-2">
              {installStatus === 'postponed' ? <PauseCircle className="h-5 w-5 text-yellow-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <div>
                <p className={`font-medium text-sm ${installStatus === 'postponed' ? 'text-yellow-800' : 'text-red-800'}`}>
                  {installStatus === 'postponed' ? 'งานติดตั้งถูกเลื่อน' : 'งานติดตั้งถูกยกเลิก'}
                </p>
                <p className="text-xs text-muted-foreground">กรุณาติดต่อแอดมินเพื่อดำเนินการต่อ</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Postpone Installation Dialog */}
      <Dialog open={showPostponeInstallDialog} onOpenChange={(open) => { if (!open) { setShowPostponeInstallDialog(false); setPostponeInstallReason(""); setInstallActionByName(""); setNewInstallDate(undefined); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PauseCircle className="h-5 w-5 text-yellow-600" /> เลื่อนติดตั้ง</DialogTitle>
            <DialogDescription>สถานะจะเปลี่ยนเป็น "เลื่อนติดตั้ง" สามารถเลือกวันติดตั้งใหม่ได้</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">ชื่อผู้ดำเนินการ <span className="text-red-500">*</span></Label>
              <Input placeholder="ชื่อของคุณ..." value={installActionByName} onChange={(e) => setInstallActionByName(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">สาเหตุ <span className="text-red-500">*</span></Label>
              <Textarea placeholder="ระบุสาเหตุที่ต้องเลื่อน..." value={postponeInstallReason} onChange={(e) => setPostponeInstallReason(e.target.value)} rows={3} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">วันติดตั้งใหม่ <span className="text-muted-foreground text-xs">(ถ้าทราบแล้ว)</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="h-4 w-4 mr-2" />
                    {newInstallDate ? newInstallDate.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : <span className="text-muted-foreground">เลือกวันที่ใหม่...</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={newInstallDate}
                    onSelect={setNewInstallDate}
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPostponeInstallDialog(false); setPostponeInstallReason(""); setInstallActionByName(""); setNewInstallDate(undefined); }}>ยกเลิก</Button>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700 text-white gap-1.5"
              disabled={!postponeInstallReason.trim() || !installActionByName.trim() || postponeInstallMut.isPending}
              onClick={() => postponeInstallMut.mutate({ token, surveyId, reason: postponeInstallReason.trim(), actionBy: installActionByName.trim(), actionByRole: "installer", newDate: newInstallDate ? newInstallDate.getTime() : undefined })}
            >
              <PauseCircle className="h-4 w-4" /> ยืนยันเลื่อน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Installation Dialog */}
      <Dialog open={showCancelInstallDialog} onOpenChange={(open) => { if (!open) { setShowCancelInstallDialog(false); setCancelInstallReason(""); setInstallActionByName(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" /> ยกเลิกติดตั้ง</DialogTitle>
            <DialogDescription>สถานะจะเปลี่ยนเป็น "ยกเลิกติดตั้ง" สามารถเปิดใหม่ได้ภายหลัง</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">ชื่อผู้ดำเนินการ <span className="text-red-500">*</span></Label>
              <Input placeholder="ชื่อของคุณ..." value={installActionByName} onChange={(e) => setInstallActionByName(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">สาเหตุ <span className="text-red-500">*</span></Label>
              <Textarea placeholder="ระบุสาเหตุที่ต้องยกเลิก..." value={cancelInstallReason} onChange={(e) => setCancelInstallReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelInstallDialog(false); setCancelInstallReason(""); setInstallActionByName(""); }}>ยกเลิก</Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={!cancelInstallReason.trim() || !installActionByName.trim() || cancelInstallMut.isPending}
              onClick={() => cancelInstallMut.mutate({ token, surveyId, reason: cancelInstallReason.trim(), actionBy: installActionByName.trim(), actionByRole: "installer" })}
            >
              <XCircle className="h-4 w-4" /> ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 z-[101] bg-black/60 text-white rounded-full p-2" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </button>
          <div className="w-full h-full flex items-center justify-center p-2 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="Preview" className="max-w-full max-h-full object-contain select-none" style={{ touchAction: "pinch-zoom" }} onClick={() => setLightboxImg(null)} />
          </div>
        </div>
      )}
      {/* Upload Status Bar */}
      <UploadStatusBar
        state={uploadState}
        onRetry={async () => {
          const { successCount } = await retryFailed();
          if (successCount > 0) {
            refetchPhotos(); refetchValidation();
            toast.success(`อัพโหลดสำเร็จ ${successCount} รูป`);
          }
        }}
        onDismiss={clearUploadState}
      />
    </Card>
  );
}

/* ==================== PHOTO CAPTION EDITOR (Public) ==================== */
function PhotoCaptionEditor({ photoId, token, captionText, setCaptionText, onDone }: {
  photoId: number; token: string; captionText: string; setCaptionText: (v: string) => void; onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const updateCaption = trpc.photo.publicUpdateCaption.useMutation({
    onSuccess: () => { toast.success("บันทึกหมายเหตุสำเร็จ"); utils.shareLink.getByToken.invalidate(); onDone(); },
    onError: (e: any) => toast.error(e.message || "บันทึกล้มเหลว"),
  });

  return (
    <div className="mt-1 flex gap-1">
      <Input
        value={captionText}
        onChange={(e) => setCaptionText(e.target.value)}
        placeholder="หมายเหตุ..."
        className="h-7 text-xs"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { updateCaption.mutate({ token, photoId, caption: captionText }); }
          if (e.key === "Escape") { onDone(); }
        }}
      />
      <Button size="icon" className="h-7 w-7 shrink-0" onClick={() => updateCaption.mutate({ token, photoId, caption: captionText })} disabled={updateCaption.isPending}>
        <CheckCircle2 className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDone}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/* ==================== PUBLIC TEMPLATE FIELDS CARD ==================== */
function PublicTemplateFieldsCard({ sourceName, surveyId, token }: { sourceName: string; surveyId: number; token: string }) {
  const { data: template, isLoading: loadingTemplate } = trpc.surveyTemplate.publicGetBySourceName.useQuery(
    { token, sourceName },
    { enabled: !!sourceName && !!token }
  );
  const { data: savedData, refetch: refetchData } = trpc.surveyTemplate.publicGetData.useQuery(
    { token, surveyId },
    { enabled: !!surveyId && !!token }
  );
  const saveData = trpc.surveyTemplate.publicSaveData.useMutation({
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
    saveData.mutate({ token, surveyId, templateId: template.id, entries });
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
                  <PublicTemplateFieldInput
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

/* ==================== PUBLIC TEMPLATE FIELD INPUT ==================== */
function PublicTemplateFieldInput({ field, value, otherValue, onChange, onOtherChange }: {
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
