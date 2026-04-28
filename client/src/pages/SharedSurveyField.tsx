import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP, PHOTO_CATEGORY_MAP } from "@/lib/constants";
import { useParams } from "wouter";
import { useState, useRef, useCallback, useMemo } from "react";
import { compressImages } from "@/lib/imageCompression";
import {
  Camera, MapPin, Calendar, Phone, Zap, Home, Gauge,
  X, Sun, Upload, Trash2, CheckCircle2, Clock,
  Save, FileText, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function SharedSurveyField() {
  const params = useParams<{ token: string }>();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.shareLink.getByToken.useQuery({ token: params.token || "" });
  const { data: photoCategories } = trpc.photoCategory.list.useQuery();

  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showCompleteSurveyConfirm, setShowCompleteSurveyConfirm] = useState(false);
  const [showTechnical, setShowTechnical] = useState(true);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
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
  } | null>(null);
  const [techSaving, setTechSaving] = useState(false);
  const [techDirty, setTechDirty] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const completeSurveyMut = trpc.survey.publicCompleteSurvey.useMutation({
    onSuccess: () => { toast.success("สำรวจเสร็จสิ้นแล้ว"); window.location.reload(); },
    onError: (e: any) => { toast.error(e.message || "เกิดข้อผิดพลาด"); },
  });

  const uploadPhotoMut = trpc.shareLink.publicUploadSurveyPhoto.useMutation();
  const deletePhotoMut = trpc.shareLink.publicDeleteSurveyPhoto.useMutation();
  const updateTechMut = trpc.shareLink.publicUpdateSurveyTechnical.useMutation();

  // Build dynamic category map
  const categoryMap: Record<string, string> = useMemo(() => {
    const map = { ...PHOTO_CATEGORY_MAP };
    if (photoCategories) {
      for (const cat of photoCategories) {
        map[cat.key] = cat.label;
      }
    }
    return map;
  }, [photoCategories]);

  const categoryKeys = useMemo(() => Object.keys(categoryMap), [categoryMap]);

  // Initialize tech form when data loads
  const s = data && 'survey' in data ? data.survey : null;
  const c = data && 'customer' in data ? data.customer : null;
  const photosData = data && 'photos' in data ? data.photos : [];
  const surveyId = s?.id || 0;
  const token = params.token || "";

  // Initialize tech form once
  if (s && !techForm) {
    setTechForm({
      systemSize: s.systemSize || "",
      panelCount: s.panelCount ? String(s.panelCount) : "",
      inverterModel: s.inverterModel || "",
      panelBrand: s.panelBrand || "",
      needBattery: (s as any).needBattery || "",
      needOptimizer: (s as any).needOptimizer || "",
      systemType: s.systemType || "",
      surveyNotes: s.surveyNotes || "",
    });
  }

  // Photo upload handler
  const handlePhotoUpload = useCallback(async (category: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingCategory(category);
    setUploadProgress({ current: 0, total: files.length });
    try {
      const fileArray = Array.from(files);
      const compressed = await compressImages(fileArray, (done, total) => {
        setUploadProgress({ current: done, total });
      });

      // Upload in chunks of 3
      const CHUNK = 3;
      let uploaded = 0;
      for (let i = 0; i < compressed.length; i += CHUNK) {
        const chunk = compressed.slice(i, i + CHUNK);
        await Promise.all(chunk.map(async (item) => {
          await uploadPhotoMut.mutateAsync({
            token,
            surveyId,
            fileName: item.fileName,
            base64Data: item.base64,
            category,
            mimeType: "image/jpeg",
          });
          uploaded++;
          setUploadProgress({ current: uploaded, total: compressed.length });
        }));
      }

      toast.success(`อัพโหลดสำเร็จ ${compressed.length} รูป`);
      utils.shareLink.getByToken.invalidate({ token });
    } catch (e: any) {
      toast.error(e.message || "อัพโหลดล้มเหลว");
    } finally {
      setUploadingCategory(null);
      setUploadProgress(null);
    }
  }, [token, surveyId, uploadPhotoMut, utils]);

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

  // Save technical data
  const handleSaveTech = useCallback(async () => {
    if (!techForm) return;
    setTechSaving(true);
    try {
      await updateTechMut.mutateAsync({
        token,
        surveyId,
        systemSize: techForm.systemSize || undefined,
        panelCount: techForm.panelCount ? Number(techForm.panelCount) : undefined,
        inverterModel: techForm.inverterModel || undefined,
        panelBrand: techForm.panelBrand || undefined,
        needBattery: techForm.needBattery || undefined,
        needOptimizer: techForm.needOptimizer || undefined,
        systemType: (techForm.systemType as "string" | "micro" | "both") || undefined,
        surveyNotes: techForm.surveyNotes || undefined,
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

  // Group photos by category
  const photosByCategory: Record<string, typeof photosData> = {};
  for (const photo of (photosData || [])) {
    const cat = (photo as any).category || "other";
    if (!photosByCategory[cat]) photosByCategory[cat] = [];
    photosByCategory[cat].push(photo);
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
        {/* Customer Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">ข้อมูลลูกค้า</CardTitle>
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
            {c.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{c.phone}</div>}
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
            {c.electricityBill && <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />ค่าไฟ: {Number(c.electricityBill).toLocaleString()} บาท/เดือน</div>}
            {c.roofType && <div className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />หลังคา: {c.roofType}</div>}
            {c.phaseType && <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-muted-foreground" />ระบบไฟ: {c.phaseType === "single" ? "1 เฟส" : "3 เฟส"}</div>}
          </CardContent>
        </Card>

        {/* Technical Data Form */}
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
                  <Input
                    value={techForm.systemSize}
                    onChange={(e) => { setTechForm({ ...techForm, systemSize: e.target.value }); setTechDirty(true); }}
                    placeholder="เช่น 5.0"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">จำนวนแผง</label>
                  <Input
                    type="number"
                    value={techForm.panelCount}
                    onChange={(e) => { setTechForm({ ...techForm, panelCount: e.target.value }); setTechDirty(true); }}
                    placeholder="เช่น 10"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ยี่ห้อแผง</label>
                  <Input
                    value={techForm.panelBrand}
                    onChange={(e) => { setTechForm({ ...techForm, panelBrand: e.target.value }); setTechDirty(true); }}
                    placeholder="เช่น JA Solar"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">อินเวอร์เตอร์</label>
                  <Input
                    value={techForm.inverterModel}
                    onChange={(e) => { setTechForm({ ...techForm, inverterModel: e.target.value }); setTechDirty(true); }}
                    placeholder="เช่น Huawei SUN2000"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภทระบบ</label>
                  <Select
                    value={techForm.systemType || "none"}
                    onValueChange={(v) => { setTechForm({ ...techForm, systemType: v === "none" ? "" : v }); setTechDirty(true); }}
                  >
                    <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ยังไม่ระบุ</SelectItem>
                      <SelectItem value="string">String Inverter</SelectItem>
                      <SelectItem value="micro">Micro Inverter</SelectItem>
                      <SelectItem value="both">ทั้งสองแบบ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ต้องการแบตเตอรี่</label>
                  <Select
                    value={techForm.needBattery || "none"}
                    onValueChange={(v) => { setTechForm({ ...techForm, needBattery: v === "none" ? "" : v }); setTechDirty(true); }}
                  >
                    <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ยังไม่ระบุ</SelectItem>
                      <SelectItem value="yes">ต้องการ</SelectItem>
                      <SelectItem value="no">ไม่ต้องการ</SelectItem>
                      <SelectItem value="maybe">อาจจะ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">หมายเหตุสำรวจ</label>
                <Textarea
                  value={techForm.surveyNotes}
                  onChange={(e) => { setTechForm({ ...techForm, surveyNotes: e.target.value }); setTechDirty(true); }}
                  placeholder="บันทึกข้อมูลเพิ่มเติมจากการสำรวจ..."
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSaveTech}
                disabled={techSaving || !techDirty}
                className="w-full gap-2"
                variant={techDirty ? "default" : "outline"}
              >
                <Save className="h-4 w-4" />
                {techSaving ? "กำลังบันทึก..." : techDirty ? "บันทึกข้อมูลเทคนิค" : "บันทึกแล้ว"}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Photo Upload by Category */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4" /> อัพโหลดรูปสำรวจ ({(photosData || []).length} รูป)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryKeys.map((catKey) => {
              const catLabel = categoryMap[catKey];
              const catPhotos = photosByCategory[catKey] || [];
              const isUploading = uploadingCategory === catKey;

              return (
                <div key={catKey} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{catLabel} ({catPhotos.length})</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[catKey]?.click()}
                    >
                      {isUploading && uploadProgress ? (
                        <><Upload className="h-3.5 w-3.5 animate-bounce" /> อัพ {uploadProgress.current}/{uploadProgress.total}</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5" /> เพิ่มรูป</>
                      )}
                    </Button>
                    <input
                      ref={(el) => { fileInputRefs.current[catKey] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(catKey, e.target.files)}
                    />
                  </div>
                  {catPhotos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {catPhotos.map((photo: any) => (
                        <div key={photo.id} className="relative group aspect-square">
                          <img
                            src={photo.url}
                            alt={photo.fileName}
                            className="w-full h-full object-cover rounded-md cursor-pointer"
                            onClick={() => setLightboxImg(photo.url)}
                          />
                          <button
                            onClick={() => setDeletingPhotoId(photo.id)}
                            className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
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
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightboxImg(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightboxImg} alt="Preview" className="max-w-full max-h-full object-contain" />
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
    </div>
  );
}
