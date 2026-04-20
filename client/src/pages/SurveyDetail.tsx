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
  Zap, Sun, Home, Gauge, Receipt, Settings2, Users,
} from "lucide-react";
import { MultiUserSelect } from "@/components/MultiUserSelect";
import { SourceCombobox } from "@/components/SourceCombobox";

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

  const { data, isLoading, refetch } = trpc.survey.getById.useQuery({ id: surveyId });
  const { data: photos, refetch: refetchPhotos } = trpc.photo.list.useQuery({ surveyId });
  const { data: documents, refetch: refetchDocs } = trpc.document.list.useQuery({ surveyId });
  const { data: followUps, refetch: refetchFollowUps } = trpc.followUp.list.useQuery({ surveyId });
  const { data: shareLinks, refetch: refetchLinks } = trpc.shareLink.list.useQuery({ surveyId });
  const { data: teamAdminSenders } = trpc.teamMember.list.useQuery({ role: "admin_sender" });
  const { data: teamSurveyors } = trpc.teamMember.list.useQuery({ role: "surveyor" });
  const { data: teamClosers } = trpc.teamMember.list.useQuery({ role: "closer" });

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

        {/* Technical Info Card - Always Editable (click to edit each field) */}
        <TechInfoCard survey={s} surveyId={surveyId} updateSurvey={updateSurvey} />

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
                        <img src={photo.url} alt={photo.caption || photo.fileName} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxImg(photo.url)} />
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
                                <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={() => setLightboxImg(photo.url)}>
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
      <EditSurveyDialog open={showEditStatus} onOpenChange={setShowEditStatus} survey={s} adminSenders={teamAdminSenders || []} surveyors={teamSurveyors || []} closers={teamClosers || []} assignments={(data as any)?.assignments || []} onSubmit={(d: any) => updateSurvey.mutate({ id: surveyId, ...d })} loading={updateSurvey.isPending} />

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
      <AddFollowUpDialog open={showAddFollowUp} onOpenChange={setShowAddFollowUp} surveyId={surveyId} customerId={c.id} surveyors={teamSurveyors || []} onSubmit={(d: any) => createFollowUp.mutate(d)} loading={createFollowUp.isPending} />
    </DashboardLayout>
  );
}

function EditSurveyDialog({ open, onOpenChange, survey, adminSenders, surveyors, closers, onSubmit, loading, assignments }: any) {
  const [form, setForm] = useState<any>({});
  const s = survey;
  if (!s) return null;

  const handleOpen = () => {
    const currentAssignments = assignments || [];
    const adminSender = currentAssignments.find((a: any) => a.assignment.role === "admin_sender");
    const surveyors = currentAssignments.filter((a: any) => a.assignment.role === "surveyor");
    const closer = currentAssignments.find((a: any) => a.assignment.role === "closer");
    setForm({
      status: s.status,
      scheduledDate: s.scheduledDate ? new Date(s.scheduledDate).toISOString().split("T")[0] : "",
      scheduledTime: s.scheduledTime || "",
      adminSenderId: adminSender?.user?.id ? String(adminSender.user.id) : "",
      surveyorIds: surveyors.map((a: any) => a.user?.id).filter(Boolean),
      closerId: closer?.user?.id ? String(closer.user.id) : "",
      surveyNotes: s.surveyNotes || "",
      systemSize: s.systemSize || "",
      panelCount: s.panelCount || "",
      inverterModel: s.inverterModel || "",
    });
  };

  const surveyorOptions = (surveyors || []).map((m: any) => ({ id: m.id, name: m.name, role: "surveyor" }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) handleOpen(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขงานสำรวจ</DialogTitle>
          <DialogDescription>อัพเดทข้อมูลและสถานะงานสำรวจ</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                  {(adminSenders || []).map((m: any) => (<SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>))}
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
            <div><Label>รุ่นอินเวอร์เตอร์</Label><Input value={form.inverterModel || ""} onChange={(e) => setForm({ ...form, inverterModel: e.target.value })} /></div>
            <div className="col-span-2"><Label>หมายเหตุ</Label><Textarea value={form.surveyNotes || ""} onChange={(e) => setForm({ ...form, surveyNotes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={() => {
              const payload: any = { status: form.status };
              if (form.scheduledDate) payload.scheduledDate = new Date(form.scheduledDate).getTime();
              if (form.scheduledTime) payload.scheduledTime = form.scheduledTime;
              if (form.surveyNotes) payload.surveyNotes = form.surveyNotes;
              if (form.systemSize) payload.systemSize = form.systemSize;
              if (form.panelCount) payload.panelCount = parseInt(form.panelCount);
              if (form.inverterModel) payload.inverterModel = form.inverterModel;
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

/* ==================== TECH INFO CARD - Always Editable ==================== */
function TechInfoCard({ survey: s, surveyId, updateSurvey }: { survey: any; surveyId: number; updateSurvey: any }) {
  const [form, setForm] = useState<any>(null);
  const [dirty, setDirty] = useState(false);

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

  // Sync form when survey data changes (after save)
  const surveyKey = `${s.systemSize}|${s.panelCount}|${s.inverterModel}|${s.panelBrand}|${s.quotedPrice}|${s.needBattery}|${s.needOptimizer}|${s.systemType}|${s.surveyNotes}`;

  const updateField = (key: string, val: string) => {
    setForm((prev: any) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!form) return;
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
  };

  const handleCancel = () => {
    setForm(initForm());
    setDirty(false);
  };

  if (!form) return null;

  const SYSTEM_TYPE_OPTIONS = [
    { value: "string", label: "String Inverter" },
    { value: "micro", label: "Micro Inverter" },
    { value: "both", label: "ทั้ง 2 แบบ" },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> ข้อมูลทางเทคนิค</CardTitle>
          {dirty && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>ยกเลิก</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={updateSurvey.isPending}>
                {updateSurvey.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
          <EditableField label="ขนาดระบบ (kW)" value={form.systemSize} onChange={(v) => updateField("systemSize", v)} placeholder="เช่น 5.5" icon={<Zap className="h-3.5 w-3.5 text-amber-500" />} suffix="kW" />
          <EditableField label="จำนวนแผง" value={form.panelCount} onChange={(v) => updateField("panelCount", v)} placeholder="เช่น 12" type="number" icon={<Sun className="h-3.5 w-3.5 text-amber-500" />} suffix="แผง" />
          <EditableField label="ยี่ห้อแผง" value={form.panelBrand} onChange={(v) => updateField("panelBrand", v)} placeholder="เช่น JA Solar, Longi" />
          <EditableField label="รุ่นอินเวอร์เตอร์" value={form.inverterModel} onChange={(v) => updateField("inverterModel", v)} placeholder="เช่น Huawei SUN2000" />
          <EditableField label="ราคาเสนอ (บาท)" value={form.quotedPrice} onChange={(v) => updateField("quotedPrice", v)} placeholder="เช่น 280000" suffix="บาท" />
          <EditableField label="แบตเตอรี่" value={form.needBattery} onChange={(v) => updateField("needBattery", v)} placeholder="เช่น 2 ก้อน Tesla Powerwall" />
          <EditableField label="Optimizer" value={form.needOptimizer} onChange={(v) => updateField("needOptimizer", v)} placeholder="เช่น 12 ตัว Huawei SUN2000" />
          <div className="space-y-1 col-span-2 md:col-span-1">
            <label className="text-xs text-muted-foreground">ประเภทระบบ</label>
            <Select value={form.systemType || "placeholder"} onValueChange={(v) => updateField("systemType", v === "placeholder" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>
                {SYSTEM_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
          <div className="space-y-1 col-span-2">
            <label className="text-xs text-muted-foreground">ที่อยู่</label>
            <p className="text-sm font-medium min-h-[32px] flex items-center">{[c.address, c.district, c.province].filter(Boolean).join(", ") || "-"}</p>
          </div>
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
  const closer = assignments.find((a: any) => a.assignment.role === "closer");

  const [editingTeam, setEditingTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({
    adminSenderId: "",
    surveyorIds: [] as string[],
    closerId: "",
  });

  const updateSurvey = trpc.survey.update.useMutation({
    onSuccess: () => { toast.success("อัพเดททีมงานสำเร็จ"); setEditingTeam(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = () => {
    setTeamForm({
      adminSenderId: adminSender?.user?.id ? String(adminSender.user.id) : "",
      surveyorIds: surveyors.map((a: any) => String(a.user?.id || "")),
      closerId: closer?.user?.id ? String(closer.user.id) : "",
    });
    setEditingTeam(true);
  };

  const handleSave = () => {
    const payload: any = { id: surveyId };
    // Send null to explicitly remove, number to set, omit to keep
    payload.adminSenderId = teamForm.adminSenderId ? parseInt(teamForm.adminSenderId) : null;
    payload.surveyorIds = teamForm.surveyorIds.filter(Boolean).map(Number);
    payload.closerId = teamForm.closerId ? parseInt(teamForm.closerId) : null;
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
              <Label className="text-xs">ผู้ปิดการขาย</Label>
              <div className="flex gap-1">
                <Select value={teamForm.closerId || "placeholder"} onValueChange={(v) => setTeamForm({ ...teamForm, closerId: v === "placeholder" ? "" : v })}>
                  <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {closerOpts.length > 0 ? closerOpts.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">ยังไม่มีสมาชิก - เพิ่มที่หน้าจัดการทีมงาน</div>
                    )}
                  </SelectContent>
                </Select>
                {teamForm.closerId && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => setTeamForm({ ...teamForm, closerId: "" })} title="ลบ">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
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
              <p className="font-medium">{closer?.user?.name || "-"}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
