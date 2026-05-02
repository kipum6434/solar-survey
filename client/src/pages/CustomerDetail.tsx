import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import { formatPhone, formatPhoneInput } from "@/lib/formatPhone";
import { SourceCombobox } from "@/components/SourceCombobox";
import { MultiUserSelect } from "@/components/MultiUserSelect";
import { useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Mail, MapPin, Zap, Home, Gauge, StickyNote, Plus, ClipboardList, Calendar, User, Globe,
} from "lucide-react";

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const customerId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [showAddSurvey, setShowAddSurvey] = useState(false);

  const { data: customer, isLoading, refetch } = trpc.customer.getById.useQuery({ id: customerId });
  const { data: surveys } = trpc.survey.getByCustomer.useQuery({ customerId });
  const { data: teamAll } = trpc.teamMember.listAll.useQuery();

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => { toast.success("อัพเดทข้อมูลสำเร็จ"); setEditing(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const createSurveyMutation = trpc.survey.create.useMutation({
    onSuccess: (result) => { toast.success("สร้างงานสำรวจสำเร็จ"); setShowAddSurvey(false); setLocation(`/surveys/${result.id}`); },
    onError: (e) => toast.error(e.message),
  });

  const [editForm, setEditForm] = useState<any>(null);

  const startEdit = () => {
    if (customer) {
      setEditForm({ ...customer });
      setEditing(true);
    }
  };

  const saveEdit = () => {
    if (!editForm) return;
    updateMutation.mutate({ id: customerId, ...editForm });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">ไม่พบข้อมูลลูกค้า</p>
          <Button variant="outline" onClick={() => setLocation("/customers")} className="mt-4">กลับ</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {customer.source && <Badge variant="secondary" className="text-xs">{customer.source}</Badge>}
              <span className="text-xs text-muted-foreground">เพิ่มเมื่อ {new Date(customer.createdAt).toLocaleDateString("th-TH")}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={startEdit}>แก้ไข</Button>
            <Button onClick={() => setShowAddSurvey(true)} className="gap-2">
              <Plus className="h-4 w-4" /> สร้างงานสำรวจ
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Info */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">ข้อมูลติดต่อ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {customer.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${customer.phone}`} className="text-primary hover:underline">{formatPhone(customer.phone)}</a>
                  </div>
                )}
                {customer.facebookName && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span>FB: {customer.facebookName}</span>
                  </div>
                )}
                {(customer.fullAddress || customer.address) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex flex-col gap-1">
                      {customer.fullAddress && <span>{customer.fullAddress}</span>}
                      <span className="text-sm text-muted-foreground">{[customer.district, customer.province, customer.postalCode].filter(Boolean).join(", ")}</span>
                      {customer.address && customer.address.startsWith('http') && (
                        <a
                          href={customer.address}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-1 px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 active:bg-primary/30 transition-colors touch-manipulation"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <MapPin className="h-4 w-4" />
                          เปิด Google Maps
                        </a>
                      )}
                      {customer.address && !customer.address.startsWith('http') && (
                        <span className="text-sm text-muted-foreground">{customer.address}</span>
                      )}
                    </div>
                  </div>
                )}
                {customer.latitude && customer.longitude && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs"
                    >
                      ดูบน Google Maps
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">ข้อมูลไฟฟ้า/หลังคา</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {customer.electricityBill && (
                  <div className="flex items-center gap-3">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>ค่าไฟ: {customer.electricityBill} บาท/เดือน</span>
                  </div>
                )}
                {customer.roofType && (
                  <div className="flex items-center gap-3">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>หลังคา: {customer.roofType}</span>
                  </div>
                )}
                {customer.phaseType && (
                  <div className="flex items-center gap-3">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span>ระบบไฟ: {customer.phaseType === "single" ? "1 เฟส" : "3 เฟส"}</span>
                  </div>
                )}
                {customer.meterSize && (
                  <div className="flex items-center gap-3">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span>ขนาดมิเตอร์: {customer.meterSize}</span>
                  </div>
                )}
                {customer.roofArea && (
                  <div className="flex items-center gap-3">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>พื้นที่หลังคา: {customer.roofArea}</span>
                  </div>
                )}
              </CardContent>
            </Card>

                {customer.surveyorName && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> คนส่งสำรวจ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{customer.surveyorName}</p>
                </CardContent>
              </Card>
            )}

            {customer.notes && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <StickyNote className="h-4 w-4" /> หมายเหตุ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Surveys */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" /> งานสำรวจ ({surveys?.data?.length ?? 0})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {surveys?.data && surveys.data.length > 0 ? (
                  <div className="space-y-3">
                    {surveys.data.map((s: any) => {
                      const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => setLocation(`/surveys/${s.id}`)}
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <ClipboardList className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">งานสำรวจ #{s.id}</span>
                              <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-[10px] border-0`}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {s.scheduledDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(s.scheduledDate).toLocaleDateString("th-TH")}
                                </span>
                              )}
                              {s.scheduledTime && <span>{s.scheduledTime} น.</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">ยังไม่มีงานสำรวจ</p>
                    <Button onClick={() => setShowAddSurvey(true)} variant="outline" size="sm" className="mt-3 gap-2">
                      <Plus className="h-3 w-3" /> สร้างงานสำรวจ
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลลูกค้า</DialogTitle>
            <DialogDescription>อัพเดทข้อมูลลูกค้า</DialogDescription>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>ชื่อ</Label>
                  <Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div><Label>เบอร์โทร</Label><Input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: formatPhoneInput(e.target.value) })} /></div>
                <div><Label>ชื่อ Facebook</Label><Input value={editForm.facebookName || ""} onChange={(e) => setEditForm({ ...editForm, facebookName: e.target.value })} placeholder="ชื่อ FB ลูกค้า" /></div>
                <div className="col-span-2"><Label>โลเคชั่น (Google Maps Link)</Label><Input value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="วางลิงก์ Google Maps" /></div>
                <div className="col-span-2"><Label>ที่อยู่</Label><Input value={editForm.fullAddress || ""} onChange={(e) => setEditForm({ ...editForm, fullAddress: e.target.value })} placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน" /></div>
                <div><Label>จังหวัด</Label><Input value={editForm.province || ""} onChange={(e) => setEditForm({ ...editForm, province: e.target.value })} /></div>
                <div><Label>เขต/อำเภอ</Label><Input value={editForm.district || ""} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} placeholder="เขต/อำเภอ" /></div>
                <div>
                  <Label>แหล่งที่มา</Label>
                  <SourceCombobox value={editForm.source || ""} onChange={(v) => setEditForm({ ...editForm, source: v })} />
                </div>
                <div><Label>ค่าไฟ/เดือน</Label><Input value={editForm.electricityBill || ""} onChange={(e) => setEditForm({ ...editForm, electricityBill: e.target.value })} placeholder="เช่น 3000-5000" /></div>
                <div><Label>ประเภทหลังคา</Label><Input value={editForm.roofType || ""} onChange={(e) => setEditForm({ ...editForm, roofType: e.target.value })} /></div>
                <div>
                  <Label>ระบบไฟ</Label>
                  <Select value={editForm.phaseType || "single"} onValueChange={(v) => setEditForm({ ...editForm, phaseType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">1 เฟส</SelectItem>
                      <SelectItem value="three">3 เฟส</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>ขนาดมิเตอร์</Label><Input value={editForm.meterSize || ""} onChange={(e) => setEditForm({ ...editForm, meterSize: e.target.value })} /></div>
                <div><Label>Latitude</Label><Input value={editForm.latitude || ""} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })} /></div>
                <div><Label>Longitude</Label><Input value={editForm.longitude || ""} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>คนส่งสำรวจ</Label>
                  <Select value={editForm.surveyorId ? String(editForm.surveyorId) : "_none"} onValueChange={(v) => setEditForm({ ...editForm, surveyorId: v === "_none" ? null : Number(v) })}>
                    <SelectTrigger><SelectValue placeholder="เลือกคนส่งสำรวจ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">ยังไม่ระบุ</SelectItem>
                      {(teamAll || []).map((m: any) => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.name} {m.role === "admin_sender" ? "(แอดมิน)" : m.role === "surveyor" ? "(ช่างสำรวจ)" : `(${m.role})`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>หมายเหตุ</Label><Textarea value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(false)}>ยกเลิก</Button>
                <Button onClick={saveEdit} disabled={updateMutation.isPending}>{updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Survey Dialog */}
      <AddSurveyDialog
        open={showAddSurvey}
        onOpenChange={setShowAddSurvey}
        customerId={customerId}
        onSubmit={(d: any) => createSurveyMutation.mutate(d)}
        loading={createSurveyMutation.isPending}
        defaultAdminSenderId={customer?.surveyorId}
      />
    </DashboardLayout>
  );
}

function AddSurveyDialog({ open, onOpenChange, customerId, onSubmit, loading, defaultAdminSenderId }: any) {
  const [form, setForm] = useState({
    scheduledDate: "",
    scheduledTime: "",
    adminSenderId: defaultAdminSenderId ? String(defaultAdminSenderId) : "",
    surveyorIds: [] as number[],
    surveyNotes: "",
  });
  // Sync defaultAdminSenderId when it changes (e.g. customer data loads)
  useEffect(() => {
    if (defaultAdminSenderId && !form.adminSenderId) {
      setForm(f => ({ ...f, adminSenderId: String(defaultAdminSenderId) }));
    }
  }, [defaultAdminSenderId]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      customerId,
      scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).getTime() : undefined,
      scheduledTime: form.scheduledTime || undefined,
      adminSenderId: form.adminSenderId ? parseInt(form.adminSenderId) : undefined,
      surveyorIds: form.surveyorIds.length > 0 ? form.surveyorIds : undefined,
      surveyNotes: form.surveyNotes || undefined,
    });
    setForm({ scheduledDate: "", scheduledTime: "", adminSenderId: "", surveyorIds: [], surveyNotes: "" });
  };

  const { data: teamAll } = trpc.teamMember.listAll.useQuery();
  const adminSenderOptions = (teamAll || []).filter((m: any) => m.isActive).map((m: any) => ({ id: m.id, name: m.name, role: m.role }));
  const surveyorOptions = (teamAll || []).filter((m: any) => m.isActive && (m.role === "surveyor" || (m.roles && JSON.parse(m.roles || '[]').includes("surveyor")))).map((m: any) => ({ id: m.id, name: m.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สร้างงานสำรวจ</DialogTitle>
          <DialogDescription>กำหนดรายละเอียดงานสำรวจสำหรับลูกค้ารายนี้</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>วันที่สำรวจ</Label>
              <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
            </div>
            <div>
              <Label>เวลา</Label>
              <Input type="time" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>แอดมินผู้ส่งงาน</Label>
            <p className="text-xs text-muted-foreground">คนที่ตอบลูกค้าและส่งรายชื่อสำรวจมา</p>
            <Select value={form.adminSenderId} onValueChange={(v) => setForm({ ...form, adminSenderId: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกแอดมิน" /></SelectTrigger>
              <SelectContent>
                {adminSenderOptions.length > 0 ? adminSenderOptions.map((m: any) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name} {m.role === "admin_sender" ? "(แอดมิน)" : m.role === "surveyor" ? "(ช่างสำรวจ)" : `(${m.role})`}</SelectItem>
                )) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">ยังไม่มีสมาชิก - เพิ่มได้ที่หน้าจัดการทีมงาน</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>ทีมสำรวจ</Label>
            <p className="text-xs text-muted-foreground">เซลล์ที่ไปสำรวจ (เลือกได้หลายคน)</p>
            <MultiUserSelect
              users={surveyorOptions}
              selectedIds={form.surveyorIds}
              onChange={(ids) => setForm({ ...form, surveyorIds: ids })}
              placeholder="เลือกทีมสำรวจ..."
            />
          </div>

          <div>
            <Label>หมายเหตุ</Label>
            <Textarea value={form.surveyNotes} onChange={(e) => setForm({ ...form, surveyNotes: e.target.value })} rows={3} placeholder="รายละเอียดเพิ่มเติม" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={loading}>{loading ? "กำลังสร้าง..." : "สร้างงานสำรวจ"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
