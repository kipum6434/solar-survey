import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP, PHOTO_CATEGORY_MAP, DOC_TYPE_MAP, FOLLOW_UP_METHOD_MAP } from "@/lib/constants";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, FileText, PhoneCall, Share2, MapPin, Calendar, User, Pencil,
  Upload, Trash2, Download, Link2, Copy, X, Image, Eye, CheckCircle2, Clock,
  Zap, Home, Gauge, Sun, Battery, Compass, Wrench,
} from "lucide-react";

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
  const [techEditing, setTechEditing] = useState(false);
  const [techForm, setTechForm] = useState<any>({});

  const { data, isLoading, refetch } = trpc.survey.getById.useQuery({ id: surveyId });
  const { data: photos, refetch: refetchPhotos } = trpc.photo.list.useQuery({ surveyId });
  const { data: documents, refetch: refetchDocs } = trpc.document.list.useQuery({ surveyId });
  const { data: followUps, refetch: refetchFollowUps } = trpc.followUp.list.useQuery({ surveyId });
  const { data: shareLinks, refetch: refetchLinks } = trpc.shareLink.list.useQuery({ surveyId });
  const { data: users } = trpc.users.list.useQuery();

  const updateSurvey = trpc.survey.update.useMutation({
    onSuccess: () => { toast.success("อัพเดทสำเร็จ"); setShowEditStatus(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCustomer = trpc.customer.update.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadPhoto = trpc.photo.upload.useMutation({
    onSuccess: () => { toast.success("อัพโหลดรูปสำเร็จ"); refetchPhotos(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePhoto = trpc.photo.delete.useMutation({
    onSuccess: () => { toast.success("ลบรูปสำเร็จ"); refetchPhotos(); },
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
    onSuccess: () => { toast.success("สร้างลิงก์แชร์สำเร็จ"); refetchLinks(); },
  });

  const revokeShareLink = trpc.shareLink.revoke.useMutation({
    onSuccess: () => { toast.success("ยกเลิกลิงก์สำเร็จ"); refetchLinks(); },
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [photoCategory, setPhotoCategory] = useState("other");

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !data) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} ขนาดเกิน 10MB`); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadPhoto.mutate({
          surveyId,
          customerId: data.customer.id,
          fileName: `${Date.now()}-${file.name}`,
          category: photoCategory as any,
          base64Data: base64,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, [data, photoCategory, surveyId, uploadPhoto]);

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("ขนาดไฟล์เกิน 16MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const ext = file.name.split(".").pop()?.toLowerCase();
      let fileType: "quotation" | "simulation" | "contract" | "other" = "other";
      if (file.name.toLowerCase().includes("quot") || file.name.toLowerCase().includes("ใบเสนอ")) fileType = "quotation";
      else if (file.name.toLowerCase().includes("sim")) fileType = "simulation";
      uploadDoc.mutate({
        surveyId,
        customerId: data.customer.id,
        fileName: `${Date.now()}-${file.name}`,
        fileType,
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
              {c.phone && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{c.phone}</span>}
              {c.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.province || c.address}</span>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowEditStatus(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> แก้ไข
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setActiveTab("share"); setShowShareDialog(true); }} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> แชร์
            </Button>
          </div>
        </div>

        {/* Location link */}
        {c.latitude && c.longitude && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <a href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline text-sm">
                <MapPin className="h-4 w-4" /> ดูโลเคชั่นบน Google Maps
              </a>
            </CardContent>
          </Card>
        )}

        {/* Technical Info Card - inline editable */}
        {(() => {
          const openTechEdit = () => {
            setTechForm({
              systemSize: s.systemSize || "",
              panelCount: s.panelCount ? String(s.panelCount) : "",
              panelModel: s.panelModel || "",
              inverterModel: s.inverterModel || "",
              batteryModel: s.batteryModel || "",
              roofDirection: s.roofDirection || "",
              estimatedCost: s.estimatedCost || "",
              quotedPrice: s.quotedPrice || "",
              installNotes: s.installNotes || "",
              electricityBill: c.electricityBill || "",
              roofType: c.roofType || "",
              roofArea: c.roofArea || "",
              phaseType: c.phaseType || "",
              meterSize: c.meterSize || "",
            });
            setTechEditing(true);
          };
          return (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> ข้อมูลทางเทคนิค
              </CardTitle>
              {!techEditing && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openTechEdit}>
                  <Pencil className="h-3 w-3" /> แก้ไข
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {techEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">ขนาดระบบ (kW)</Label>
                    <Input placeholder="เช่น 10" value={techForm.systemSize} onChange={(e) => setTechForm({ ...techForm, systemSize: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">จำนวนแผง</Label>
                    <Input type="number" placeholder="เช่น 16" value={techForm.panelCount} onChange={(e) => setTechForm({ ...techForm, panelCount: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                    <Label className="text-xs text-muted-foreground">รุ่นแผงโซล่า</Label>
                    <Input placeholder="เช่น Longi 645W" value={techForm.panelModel} onChange={(e) => setTechForm({ ...techForm, panelModel: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                    <Label className="text-xs text-muted-foreground">อินเวอร์เตอร์</Label>
                    <Input placeholder="เช่น HUAWEI SUN2000-10K" value={techForm.inverterModel} onChange={(e) => setTechForm({ ...techForm, inverterModel: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                    <Label className="text-xs text-muted-foreground">แบตเตอรี่ (ถ้ามี)</Label>
                    <Input placeholder="เช่น Huawei LUNA2000-7" value={techForm.batteryModel} onChange={(e) => setTechForm({ ...techForm, batteryModel: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ทิศทางหลังคา</Label>
                    <Input placeholder="เช่น ทิศใต้" value={techForm.roofDirection} onChange={(e) => setTechForm({ ...techForm, roofDirection: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ราคาประเมิน (บาท)</Label>
                    <Input placeholder="เช่น 348000" value={techForm.estimatedCost} onChange={(e) => setTechForm({ ...techForm, estimatedCost: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ราคาเสนอ (บาท)</Label>
                    <Input placeholder="เช่น 348000" value={techForm.quotedPrice} onChange={(e) => setTechForm({ ...techForm, quotedPrice: e.target.value })} className="mt-1 h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">หมายเหตุสำหรับช่างติดตั้ง</Label>
                  <Textarea placeholder="รายละเอียดเพิ่มเติมสำหรับทีมช่าง" value={techForm.installNotes} onChange={(e) => setTechForm({ ...techForm, installNotes: e.target.value })} rows={2} className="mt-1" />
                </div>
                {/* ข้อมูลจากลูกค้า (แก้ไขได้) */}
                <div className="rounded-lg bg-blue-50/50 p-3 border border-blue-100">
                  <p className="text-[10px] font-semibold text-blue-600 mb-2">ข้อมูลจากลูกค้า</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">ค่าไฟ/เดือน (บาท)</Label>
                      <Input placeholder="เช่น 3000" value={techForm.electricityBill} onChange={(e) => setTechForm({ ...techForm, electricityBill: e.target.value })} className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ประเภทหลังคา</Label>
                      <Input placeholder="เช่น เมทัลชีท" value={techForm.roofType} onChange={(e) => setTechForm({ ...techForm, roofType: e.target.value })} className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">พื้นที่หลังคา (ตร.ม.)</Label>
                      <Input placeholder="เช่น 50" value={techForm.roofArea} onChange={(e) => setTechForm({ ...techForm, roofArea: e.target.value })} className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ระบบไฟฟ้า</Label>
                      <Select value={techForm.phaseType || "none"} onValueChange={(v) => setTechForm({ ...techForm, phaseType: v === "none" ? "" : v })}>
                        <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ไม่ระบุ</SelectItem>
                          <SelectItem value="single">1 เฟส</SelectItem>
                          <SelectItem value="three">3 เฟส</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ขนาดมิเตอร์</Label>
                      <Input placeholder="เช่น 15(45)A" value={techForm.meterSize} onChange={(e) => setTechForm({ ...techForm, meterSize: e.target.value })} className="mt-1 h-9" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setTechEditing(false)}>ยกเลิก</Button>
                  <Button size="sm" className="gap-1.5" disabled={updateSurvey.isPending} onClick={() => {
                    // Save survey technical data
                    const surveyPayload: any = { status: s.status };
                    if (techForm.systemSize) surveyPayload.systemSize = techForm.systemSize;
                    if (techForm.panelCount) surveyPayload.panelCount = parseInt(techForm.panelCount);
                    if (techForm.panelModel) surveyPayload.panelModel = techForm.panelModel;
                    if (techForm.inverterModel) surveyPayload.inverterModel = techForm.inverterModel;
                    if (techForm.batteryModel) surveyPayload.batteryModel = techForm.batteryModel;
                    if (techForm.roofDirection) surveyPayload.roofDirection = techForm.roofDirection;
                    if (techForm.estimatedCost) surveyPayload.estimatedCost = techForm.estimatedCost;
                    if (techForm.quotedPrice) surveyPayload.quotedPrice = techForm.quotedPrice;
                    surveyPayload.installNotes = techForm.installNotes || "";
                    // Save customer data too
                    const customerPayload: any = { id: c.id };
                    if (techForm.electricityBill !== (c.electricityBill || "")) customerPayload.electricityBill = techForm.electricityBill || undefined;
                    if (techForm.roofType !== (c.roofType || "")) customerPayload.roofType = techForm.roofType || undefined;
                    if (techForm.roofArea !== (c.roofArea || "")) customerPayload.roofArea = techForm.roofArea || undefined;
                    if (techForm.phaseType !== (c.phaseType || "")) customerPayload.phaseType = techForm.phaseType || undefined;
                    if (techForm.meterSize !== (c.meterSize || "")) customerPayload.meterSize = techForm.meterSize || undefined;
                    // Update both
                    const hasCustomerChanges = Object.keys(customerPayload).length > 1;
                    if (hasCustomerChanges) {
                      updateCustomer.mutate(customerPayload);
                    }
                    updateSurvey.mutate({ id: surveyId, ...surveyPayload }, {
                      onSuccess: () => { setTechEditing(false); toast.success("บันทึกข้อมูลสำเร็จ"); refetch(); },
                    });
                  }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {updateSurvey.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูลเทคนิค"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors" onClick={openTechEdit}>
                    <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ขนาดระบบ</p><p className="font-semibold">{s.systemSize ? `${s.systemSize} kW` : <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors" onClick={openTechEdit}>
                    <Sun className="h-4 w-4 text-orange-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">จำนวนแผง</p><p className="font-semibold">{s.panelCount ? `${s.panelCount} แผง` : <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors" onClick={openTechEdit}>
                    <Sun className="h-4 w-4 text-orange-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">รุ่นแผงโซล่า</p><p className="font-semibold">{s.panelModel || <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 cursor-pointer hover:bg-green-100 transition-colors" onClick={openTechEdit}>
                    <Zap className="h-4 w-4 text-green-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">อินเวอร์เตอร์</p><p className="font-semibold">{s.inverterModel || <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors" onClick={openTechEdit}>
                    <Battery className="h-4 w-4 text-purple-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">แบตเตอรี่</p><p className="font-semibold">{s.batteryModel || <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={openTechEdit}>
                    <Compass className="h-4 w-4 text-slate-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ทิศทางหลังคา</p><p className="font-semibold">{s.roofDirection || <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors" onClick={openTechEdit}>
                    <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ค่าไฟฟ้า/เดือน</p><p className="font-semibold">{c.electricityBill ? `${Number(c.electricityBill).toLocaleString()} บาท` : <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={openTechEdit}>
                    <Home className="h-4 w-4 text-slate-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ประเภทหลังคา</p><p className="font-semibold">{c.roofType || <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors" onClick={openTechEdit}>
                    <Home className="h-4 w-4 text-slate-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">พื้นที่หลังคา</p><p className="font-semibold">{c.roofArea ? `${Number(c.roofArea).toLocaleString()} ตร.ม.` : <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors" onClick={openTechEdit}>
                    <Gauge className="h-4 w-4 text-blue-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ระบบไฟฟ้า</p><p className="font-semibold">{c.phaseType ? (c.phaseType === "single" ? "1 เฟส" : "3 เฟส") : <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors" onClick={openTechEdit}>
                    <Gauge className="h-4 w-4 text-blue-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ขนาดมิเตอร์</p><p className="font-semibold">{c.meterSize || <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={openTechEdit}>
                    <Wrench className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ราคาประเมิน</p><p className="font-semibold">{s.estimatedCost ? `${Number(s.estimatedCost).toLocaleString()} บาท` : <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={openTechEdit}>
                    <Wrench className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">ราคาเสนอ</p><p className="font-semibold">{s.quotedPrice ? `${Number(s.quotedPrice).toLocaleString()} บาท` : <span className="text-muted-foreground">-</span>}</p></div>
                  </div>
                </div>
                {s.installNotes && (
                  <div className="mt-3 p-2.5 rounded-lg bg-yellow-50 text-sm cursor-pointer hover:bg-yellow-100 transition-colors" onClick={openTechEdit}>
                    <p className="text-[10px] text-muted-foreground font-semibold mb-1">หมายเหตุสำหรับช่างติดตั้ง</p>
                    <p className="whitespace-pre-wrap">{s.installNotes}</p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2 text-center">คลิกที่ช่องใดก็ได้เพื่อแก้ไขข้อมูลเทคนิค</p>
              </>
            )}
          </CardContent>
        </Card>
          );
        })()}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="photos" className="gap-1.5"><Camera className="h-3.5 w-3.5" /> รูปภาพ ({photos?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> เอกสาร ({documents?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="followup" className="gap-1.5"><PhoneCall className="h-3.5 w-3.5" /> Follow-up ({followUps?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="share" className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> แชร์ ({shareLinks?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold">รูปภาพหน้างาน</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={photoCategory} onValueChange={setPhotoCategory}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PHOTO_CATEGORY_MAP).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => photoInputRef.current?.click()} className="gap-1.5" disabled={uploadPhoto.isPending}>
                      <Upload className="h-3.5 w-3.5" /> {uploadPhoto.isPending ? "กำลังอัพ..." : "อัพโหลด"}
                    </Button>
                    <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={handlePhotoUpload} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {photos && photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {photos.map((photo: any) => (
                      <div key={photo.id} className="group relative rounded-lg overflow-hidden bg-muted aspect-square">
                        <img src={`/api/files/download?type=photo&id=${photo.id}`} alt={photo.caption || photo.fileName} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxImg(`/api/files/download?type=photo&id=${photo.id}`)} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end">
                          <div className="w-full p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-[9px] bg-white/90 text-foreground">
                                  {PHOTO_CATEGORY_MAP[photo.category] || photo.category}
                                </Badge>
                                {photo.fileSize && (
                                  <span className="text-[9px] text-white/80 font-medium">
                                    {photo.fileSize > 1048576 ? `${(photo.fileSize / 1048576).toFixed(1)} MB` : `${(photo.fileSize / 1024).toFixed(0)} KB`}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={() => setLightboxImg(`/api/files/download?type=photo&id=${photo.id}`)}>
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/90 hover:bg-red-100" onClick={(e) => { e.stopPropagation(); setConfirmDeletePhoto(photo.id); }}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มีรูปภาพ</p>
                    <p className="text-xs mt-1">คลิกปุ่มอัพโหลดเพื่อเพิ่มรูปภาพหน้างาน</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">เอกสาร</CardTitle>
                  <Button size="sm" onClick={() => docInputRef.current?.click()} className="gap-1.5" disabled={uploadDoc.isPending}>
                    <Upload className="h-3.5 w-3.5" /> {uploadDoc.isPending ? "กำลังอัพ..." : "อัพโหลดเอกสาร"}
                  </Button>
                  <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" hidden onChange={handleDocUpload} />
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
                            <Badge variant="secondary" className="text-[10px]">{DOC_TYPE_MAP[doc.fileType] || doc.fileType}</Badge>
                            {doc.fileSize && <span className="text-[10px] text-muted-foreground">{doc.fileSize > 1048576 ? `${(doc.fileSize / 1048576).toFixed(1)} MB` : `${(doc.fileSize / 1024).toFixed(0)} KB`}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`/api/files/download?type=document&id=${doc.id}`, "_blank")}>
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
          <TabsContent value="share" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">ลิงก์แชร์</CardTitle>
                  <Button size="sm" onClick={() => createShareLink.mutate({ surveyId, expiresInDays: 7 })} className="gap-1.5" disabled={createShareLink.isPending}>
                    <Link2 className="h-3.5 w-3.5" /> สร้างลิงก์ใหม่
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {shareLinks && shareLinks.length > 0 ? (
                  <div className="space-y-3">
                    {shareLinks.map((link: any) => {
                      const shareUrl = `${window.location.origin}/share/${link.token}`;
                      const isExpired = link.expiresAt && link.expiresAt < Date.now();
                      return (
                        <div key={link.id} className={`p-4 rounded-lg border ${!link.isActive || isExpired ? "opacity-50" : ""}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={link.isActive && !isExpired ? "default" : "secondary"} className="text-[10px]">
                              {!link.isActive ? "ยกเลิกแล้ว" : isExpired ? "หมดอายุ" : "ใช้งานได้"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">ดู {link.viewCount} ครั้ง</span>
                            {link.expiresAt && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                หมดอายุ {new Date(link.expiresAt).toLocaleDateString("th-TH")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input value={shareUrl} readOnly className="text-xs h-8 bg-muted/50" />
                            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("คัดลอกลิงก์แล้ว"); }}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {link.isActive && !isExpired && (
                              <Button variant="outline" size="sm" className="h-8 shrink-0 text-destructive hover:bg-red-50" onClick={() => revokeShareLink.mutate({ id: link.id })}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Share2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มีลิงก์แชร์</p>
                    <p className="text-xs mt-1">สร้างลิงก์เพื่อแชร์ข้อมูลให้ผู้ติดตั้ง</p>
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
      <EditSurveyDialog open={showEditStatus} onOpenChange={setShowEditStatus} survey={s} customer={c} users={users || []} onSubmit={(d: any) => updateSurvey.mutate({ id: surveyId, ...d })} loading={updateSurvey.isPending} />

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

      {/* Add Follow-up Dialog */}
      <AddFollowUpDialog open={showAddFollowUp} onOpenChange={setShowAddFollowUp} surveyId={surveyId} customerId={c.id} users={users || []} onSubmit={(d: any) => createFollowUp.mutate(d)} loading={createFollowUp.isPending} />
    </DashboardLayout>
  );
}

function EditSurveyDialog({ open, onOpenChange, survey, users, onSubmit, loading, customer }: any) {
  const [form, setForm] = useState<any>({});
  const s = survey;
  if (!s) return null;

  const handleOpen = () => {
    setForm({
      status: s.status,
      scheduledDate: s.scheduledDate ? new Date(s.scheduledDate).toISOString().split("T")[0] : "",
      scheduledTime: s.scheduledTime || "",
      assignedTo: s.assignedTo ? String(s.assignedTo) : "",
      surveyNotes: s.surveyNotes || "",
      systemSize: s.systemSize || "",
      panelCount: s.panelCount ? String(s.panelCount) : "",
      panelModel: s.panelModel || "",
      inverterModel: s.inverterModel || "",
      batteryModel: s.batteryModel || "",
      estimatedCost: s.estimatedCost || "",
      quotedPrice: s.quotedPrice || "",
      roofDirection: s.roofDirection || "",
      installNotes: s.installNotes || "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) handleOpen(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขงานสำรวจ</DialogTitle>
          <DialogDescription>อัพเดทข้อมูลและสถานะงานสำรวจ</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {/* ข้อมูลลูกค้า (อ่านอย่างเดียว) */}
          {customer && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground mb-2">ข้อมูลลูกค้า (แก้ไขที่หน้าลูกค้า)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {customer.electricityBill && <div className="bg-white rounded p-2"><span className="text-muted-foreground">ค่าไฟ/เดือน:</span> <span className="font-semibold">{Number(customer.electricityBill).toLocaleString()} บาท</span></div>}
                {customer.roofType && <div className="bg-white rounded p-2"><span className="text-muted-foreground">หลังคา:</span> <span className="font-semibold">{customer.roofType}</span></div>}
                {customer.roofArea && <div className="bg-white rounded p-2"><span className="text-muted-foreground">พื้นที่หลังคา:</span> <span className="font-semibold">{Number(customer.roofArea).toLocaleString()} ตร.ม.</span></div>}
                {customer.phaseType && <div className="bg-white rounded p-2"><span className="text-muted-foreground">ระบบไฟ:</span> <span className="font-semibold">{customer.phaseType === "single" ? "1 เฟส" : "3 เฟส"}</span></div>}
                {customer.meterSize && <div className="bg-white rounded p-2"><span className="text-muted-foreground">มิเตอร์:</span> <span className="font-semibold">{customer.meterSize}</span></div>}
              </div>
            </div>
          )}

          {/* สถานะและกำหนดการ */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">สถานะและกำหนดการ</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>สถานะ</Label>
                <Select value={form.status || s.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SURVEY_STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>วันที่สำรวจ</Label><Input type="date" value={form.scheduledDate || ""} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></div>
              <div><Label>เวลา</Label><Input type="time" value={form.scheduledTime || ""} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>มอบหมายให้</Label>
                <Select value={form.assignedTo || ""} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (<SelectItem key={u.id} value={String(u.id)}>{u.name || `User #${u.id}`}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ข้อมูลทางเทคนิค */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">ข้อมูลทางเทคนิค (กรอกก่อนส่งให้ทีมช่าง)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ขนาดระบบ (kW)</Label><Input placeholder="เช่น 10" value={form.systemSize || ""} onChange={(e) => setForm({ ...form, systemSize: e.target.value })} /></div>
              <div><Label>จำนวนแผง</Label><Input type="number" placeholder="เช่น 16" value={form.panelCount || ""} onChange={(e) => setForm({ ...form, panelCount: e.target.value })} /></div>
              <div className="col-span-2"><Label>รุ่นแผงโซล่า</Label><Input placeholder="เช่น Longi/Ja/Aiko 645W MONO HF N-TYPE" value={form.panelModel || ""} onChange={(e) => setForm({ ...form, panelModel: e.target.value })} /></div>
              <div className="col-span-2"><Label>รุ่นอินเวอร์เตอร์</Label><Input placeholder="เช่น HUAWEI SUN2000-10K-LCO" value={form.inverterModel || ""} onChange={(e) => setForm({ ...form, inverterModel: e.target.value })} /></div>
              <div className="col-span-2"><Label>รุ่นแบตเตอรี่ (ถ้ามี)</Label><Input placeholder="เช่น Huawei LUNA2000-7-E1" value={form.batteryModel || ""} onChange={(e) => setForm({ ...form, batteryModel: e.target.value })} /></div>
              <div><Label>ทิศทางหลังคา</Label><Input placeholder="เช่น ทิศใต้" value={form.roofDirection || ""} onChange={(e) => setForm({ ...form, roofDirection: e.target.value })} /></div>
              <div><Label>ราคาประเมิน (บาท)</Label><Input placeholder="เช่น 348000" value={form.estimatedCost || ""} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} /></div>
              <div className="col-span-2"><Label>ราคาเสนอ (บาท)</Label><Input placeholder="เช่น 348000" value={form.quotedPrice || ""} onChange={(e) => setForm({ ...form, quotedPrice: e.target.value })} /></div>
              <div className="col-span-2"><Label>หมายเหตุสำหรับช่างติดตั้ง</Label><Textarea placeholder="รายละเอียดเพิ่มเติมสำหรับทีมช่าง เช่น ต้องเดินสายผ่านท่อ, ต้องเจาะหลังคา ฯลฯ" value={form.installNotes || ""} onChange={(e) => setForm({ ...form, installNotes: e.target.value })} rows={2} /></div>
            </div>
          </div>

          {/* หมายเหตุ */}
          <div>
            <Label>หมายเหตุงานสำรวจ</Label>
            <Textarea value={form.surveyNotes || ""} onChange={(e) => setForm({ ...form, surveyNotes: e.target.value })} rows={3} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={() => {
              const payload: any = { status: form.status };
              if (form.scheduledDate) payload.scheduledDate = new Date(form.scheduledDate).getTime();
              if (form.scheduledTime) payload.scheduledTime = form.scheduledTime;
              if (form.assignedTo) payload.assignedTo = parseInt(form.assignedTo);
              if (form.surveyNotes !== undefined) payload.surveyNotes = form.surveyNotes;
              if (form.systemSize) payload.systemSize = form.systemSize;
              if (form.panelCount) payload.panelCount = parseInt(form.panelCount);
              if (form.panelModel) payload.panelModel = form.panelModel;
              if (form.inverterModel) payload.inverterModel = form.inverterModel;
              if (form.batteryModel) payload.batteryModel = form.batteryModel;
              if (form.roofDirection) payload.roofDirection = form.roofDirection;
              if (form.estimatedCost) payload.estimatedCost = form.estimatedCost;
              if (form.quotedPrice) payload.quotedPrice = form.quotedPrice;
              if (form.installNotes) payload.installNotes = form.installNotes;
              onSubmit(payload);
            }} disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddFollowUpDialog({ open, onOpenChange, surveyId, customerId, users, onSubmit, loading }: any) {
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
                  {users.map((u: any) => (<SelectItem key={u.id} value={String(u.id)}>{u.name || `User #${u.id}`}</SelectItem>))}
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
