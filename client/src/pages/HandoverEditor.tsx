import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft, Image as ImageIcon, CheckCircle2, Plus, Trash2,
  Link2, Copy, Loader2, FileText, Send, Eye, GripVertical, Save,
} from "lucide-react";

export default function HandoverEditor() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/delivery-forms/:id/handover");
  const formId = params?.id ? Number(params.id) : null;

  // Fetch handover data
  const { data, isLoading, refetch } = trpc.deliveryForm.getHandoverData.useQuery(
    { id: formId! },
    { enabled: !!formId }
  );
  const { data: photoCategories } = trpc.installationPhotoCategory.list.useQuery();
  const { data: companySettings } = trpc.companySettings.get.useQuery();

  // Mutations
  const updatePhotos = trpc.deliveryForm.updateSelectedPhotos.useMutation({
    onSuccess: () => { toast.success("บันทึกรูปที่เลือกแล้ว"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateSections = trpc.deliveryForm.updateCustomSections.useMutation({
    onSuccess: () => { toast.success("บันทึกเนื้อหาแล้ว"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const generateLink = trpc.deliveryForm.generateHandoverLink.useMutation({
    onSuccess: (result) => {
      const url = `${window.location.origin}/handover/${result.token}`;
      navigator.clipboard.writeText(url);
      toast.success("สร้างลิงก์สำเร็จ! คัดลอกแล้ว");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Checklist mutation
  const updateChecklist = trpc.deliveryForm.updateChecklist.useMutation({
    onSuccess: () => { toast.success("บันทึก checklist แล้ว"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  // Local state
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [customSections, setCustomSections] = useState<{ title: string; content: string }[]>([]);
  const [checklistItems, setChecklistItems] = useState<{ templateId?: number; label: string; checked: boolean }[]>([]);
  const [photosChanged, setPhotosChanged] = useState(false);
  const [sectionsChanged, setSectionsChanged] = useState(false);
  const [checklistChanged, setChecklistChanged] = useState(false);

  // Initialize from server data
  useEffect(() => {
    if (data) {
      setSelectedPhotoIds(data.selectedPhotoIds || []);
      setCustomSections(data.customSections || []);
      setChecklistItems(data.checklistItems || []);
    }
  }, [data]);

  // Group photos by category
  const groupedPhotos = useMemo(() => {
    if (!data?.allPhotos) return {};
    const groups: Record<string, any[]> = {};
    for (const photo of data.allPhotos) {
      const cat = photo.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(photo);
    }
    return groups;
  }, [data?.allPhotos]);

  // Category label map
  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = { other: "อื่นๆ" };
    if (photoCategories) {
      for (const cat of photoCategories as any[]) {
        map[cat.key || cat.name] = cat.label || cat.name;
      }
    }
    return map;
  }, [photoCategories]);

  const togglePhoto = (photoId: number) => {
    setPhotosChanged(true);
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const selectAllInCategory = (categoryPhotos: any[]) => {
    setPhotosChanged(true);
    const ids = categoryPhotos.map((p) => p.id);
    setSelectedPhotoIds((prev) => {
      const existing = new Set(prev);
      ids.forEach((id) => existing.add(id));
      return Array.from(existing);
    });
  };

  const deselectAllInCategory = (categoryPhotos: any[]) => {
    setPhotosChanged(true);
    const ids = new Set(categoryPhotos.map((p) => p.id));
    setSelectedPhotoIds((prev) => prev.filter((id) => !ids.has(id)));
  };

  const handleSavePhotos = () => {
    if (!formId) return;
    updatePhotos.mutate({ id: formId, photoIds: selectedPhotoIds });
    setPhotosChanged(false);
  };

  const handleSaveSections = () => {
    if (!formId) return;
    updateSections.mutate({ id: formId, sections: customSections });
    setSectionsChanged(false);
  };

  const handleSaveChecklist = () => {
    if (!formId) return;
    updateChecklist.mutate({ id: formId, checklistItems });
    setChecklistChanged(false);
  };

  const toggleChecklistItem = (index: number) => {
    setChecklistChanged(true);
    setChecklistItems((prev) => prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item));
  };

  const addChecklistItem = () => {
    setChecklistChanged(true);
    setChecklistItems((prev) => [...prev, { label: "", checked: false }]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistChanged(true);
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChecklistLabel = (index: number, label: string) => {
    setChecklistChanged(true);
    setChecklistItems((prev) => prev.map((item, i) => i === index ? { ...item, label } : item));
  };

  const addSection = () => {
    setSectionsChanged(true);
    setCustomSections((prev) => [...prev, { title: "", content: "" }]);
  };

  const removeSection = (index: number) => {
    setSectionsChanged(true);
    setCustomSections((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, field: "title" | "content", value: string) => {
    setSectionsChanged(true);
    setCustomSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  // Save ALL at once (photos + checklist + sections)
  const handleSaveAll = async () => {
    if (!formId) return;
    try {
      await updatePhotos.mutateAsync({ id: formId, photoIds: selectedPhotoIds });
      await updateSections.mutateAsync({ id: formId, sections: customSections });
      await updateChecklist.mutateAsync({ id: formId, checklistItems });
      setPhotosChanged(false);
      setSectionsChanged(false);
      setChecklistChanged(false);
      toast.success("บันทึกทั้งหมดเรียบร้อย");
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || "Unknown error"));
    }
  };

  const hasUnsavedChanges = photosChanged || sectionsChanged || checklistChanged;
  const isSaving = updatePhotos.isPending || updateSections.isPending || updateChecklist.isPending;

  const handleGenerateLink = async () => {
    if (!formId) return;
    // Save ALL data BEFORE generating link (photos, sections, checklist)
    try {
      await updatePhotos.mutateAsync({ id: formId, photoIds: selectedPhotoIds });
      await updateSections.mutateAsync({ id: formId, sections: customSections });
      await updateChecklist.mutateAsync({ id: formId, checklistItems });
      setPhotosChanged(false);
      setSectionsChanged(false);
      setChecklistChanged(false);
    } catch (e: any) {
      toast.error("บันทึกข้อมูลไม่สำเร็จ: " + (e.message || "Unknown error"));
      return;
    }
    // Now generate the link
    generateLink.mutate({ id: formId });
  };

  const handleUpdateLink = async () => {
    if (!formId) return;
    try {
      await updatePhotos.mutateAsync({ id: formId, photoIds: selectedPhotoIds });
      await updateSections.mutateAsync({ id: formId, sections: customSections });
      await updateChecklist.mutateAsync({ id: formId, checklistItems });
      setPhotosChanged(false);
      setSectionsChanged(false);
      setChecklistChanged(false);
      toast.success("อัปเดตข้อมูลลิงก์เรียบร้อยแล้ว");
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e.message || "Unknown error"));
    }
  };

  const handoverUrl = data?.form?.handoverToken
    ? `${window.location.origin}/handover/${data.form.handoverToken}`
    : null;

  const copyLink = () => {
    if (handoverUrl) {
      navigator.clipboard.writeText(handoverUrl);
      toast.success("คัดลอกลิงก์แล้ว");
    }
  };

  if (!formId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">ไม่พบใบส่งมอบงาน</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={`space-y-6 max-w-5xl mx-auto ${hasUnsavedChanges ? 'pb-24' : ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation(`/delivery-forms/${formId}`)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">จัดการหนังสือส่งมอบงาน</h1>
            {data?.customer && (
              <p className="text-sm text-muted-foreground">{data.customer.name} | #{data?.form?.surveyId}</p>
            )}
          </div>
          {data?.form && (
            <Badge className={
              data.form.status === "signed" ? "bg-green-100 text-green-700" :
              data.form.status === "pending_signature" ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-700"
            }>
              {data.form.status === "signed" ? "เซ็นแล้ว" :
               data.form.status === "pending_signature" ? "รอลูกค้าเซ็น" :
               data.form.status === "completed" ? "เสร็จสิ้น" : "ร่าง"}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !data ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">ไม่พบข้อมูล</p>
          </div>
        ) : (
          <>
            {/* Header Info Preview (auto from data) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  ข้อมูลส่วนหัว (ดึงอัตโนมัติ)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">ชื่อลูกค้า:</span> <span className="font-medium">{data.customer?.name || "-"}</span></div>
                  <div><span className="text-muted-foreground">เบอร์โทร:</span> <span className="font-medium">{data.customer?.phone || "-"}</span></div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">ที่อยู่:</span> <span className="font-medium">{data.customer?.fullAddress || data.customer?.address || "-"}</span></div>
                  <div><span className="text-muted-foreground">ประเภทหลังคา:</span> <span className="font-medium">{data.customer?.roofType || "-"}</span></div>
                  <div><span className="text-muted-foreground">ระบบไฟ:</span> <span className="font-medium">{data.customer?.phaseType === "three" ? "3 เฟส" : data.customer?.phaseType === "single" ? "1 เฟส" : "-"}</span></div>
                  <div><span className="text-muted-foreground">ขนาดระบบ:</span> <span className="font-medium">{data.survey?.systemSize ? `${data.survey.systemSize} kW` : "-"}</span></div>
                  <div><span className="text-muted-foreground">จำนวนแผง:</span> <span className="font-medium">{data.survey?.panelCount ? `${data.survey.panelCount} แผง` : "-"}</span></div>
                  <div><span className="text-muted-foreground">ยี่ห้อแผง:</span> <span className="font-medium">{data.survey?.panelBrand || "-"}</span></div>
                  <div><span className="text-muted-foreground">อินเวอร์เตอร์:</span> <span className="font-medium">{data.survey?.inverterModel || "-"}</span></div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 italic">* ข้อมูลนี้ดึงจากข้อมูลลูกค้าและงานสำรวจอัตโนมัติ (ไม่แสดงราคา)</p>
              </CardContent>
            </Card>

            {/* Photo Selection */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                    เลือกรูปภาพหน้างาน
                    <Badge variant="outline" className="text-xs">{selectedPhotoIds.length} รูป</Badge>
                  </CardTitle>
                  {photosChanged && (
                    <Button size="sm" onClick={handleSavePhotos} disabled={updatePhotos.isPending} className="gap-1.5">
                      {updatePhotos.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      บันทึก
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {data.allPhotos.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-4">ยังไม่มีรูปติดตั้ง</p>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedPhotos).map(([category, photos]) => (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium">{categoryLabelMap[category] || category}</h4>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => selectAllInCategory(photos)}
                            >
                              เลือกทั้งหมด
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => deselectAllInCategory(photos)}
                            >
                              ยกเลิกทั้งหมด
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                          {photos.map((photo: any) => {
                            const isSelected = selectedPhotoIds.includes(photo.id);
                            return (
                              <div
                                key={photo.id}
                                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                  isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent hover:border-gray-300"
                                }`}
                                onClick={() => togglePhoto(photo.id)}
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.caption || ""}
                                  className="w-full aspect-square object-cover"
                                  loading="lazy"
                                />
                                <div className={`absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center ${
                                  isSelected ? "bg-blue-500" : "bg-white/80 border"
                                }`}>
                                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                </div>
                                {photo.caption && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                                    {photo.caption}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-500" />
                    รายการตรวจสอบส่งมอบ
                    <Badge variant="outline" className="text-xs">{checklistItems.filter(i => i.checked).length}/{checklistItems.length}</Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    {checklistChanged && (
                      <Button size="sm" onClick={handleSaveChecklist} disabled={updateChecklist.isPending} className="gap-1.5">
                        {updateChecklist.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        บันทึก
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={addChecklistItem} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> เพิ่มรายการ
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {checklistItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-4">
                    ยังไม่มีรายการตรวจสอบ กดปุ่ม "เพิ่มรายการ" เพื่อเพิ่ม
                  </p>
                ) : (
                  <div className="space-y-2">
                    {checklistItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleChecklistItem(idx)}
                        />
                        <Input
                          value={item.label}
                          onChange={(e) => updateChecklistLabel(idx, e.target.value)}
                          placeholder="รายการตรวจสอบ..."
                          className={`text-sm flex-1 ${item.checked ? 'line-through text-muted-foreground' : ''}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 shrink-0 h-8 w-8 p-0"
                          onClick={() => removeChecklistItem(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Custom Sections */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-purple-500" />
                    เนื้อหาเพิ่มเติม (แก้ไขได้)
                  </CardTitle>
                  <div className="flex gap-2">
                    {sectionsChanged && (
                      <Button size="sm" onClick={handleSaveSections} disabled={updateSections.isPending} className="gap-1.5">
                        {updateSections.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        บันทึก
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={addSection} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> เพิ่มหัวข้อ
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {customSections.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-4">
                    ยังไม่มีเนื้อหาเพิ่มเติม กดปุ่ม "เพิ่มหัวข้อ" เพื่อเพิ่ม
                  </p>
                ) : (
                  <div className="space-y-4">
                    {customSections.map((section, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="หัวข้อ (เช่น ข้อตกลงเพิ่มเติม, การรับประกัน)"
                            value={section.title}
                            onChange={(e) => updateSection(idx, "title", e.target.value)}
                            className="text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 shrink-0"
                            onClick={() => removeSection(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="รายละเอียด..."
                          value={section.content}
                          onChange={(e) => updateSection(idx, "content", e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generate Link / Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-green-500" />
                  ส่งให้ลูกค้าเซ็นรับมอบ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {handoverUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input value={handoverUrl} readOnly className="text-xs font-mono" />
                      <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 shrink-0">
                        <Copy className="h-3.5 w-3.5" /> คัดลอก
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ส่งลิงก์นี้ให้ลูกค้า — ลูกค้าจะเห็นข้อมูลงาน + รูปที่เลือก + checklist แล้วเซ็นรับมอบได้เลย
                    </p>
                    {data.form?.status === "signed" && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-800">ลูกค้าเซ็นรับมอบแล้ว</p>
                          {data.form.signedAt && (
                            <p className="text-xs text-green-600">
                              เมื่อ {new Date(data.form.signedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(handoverUrl, "_blank")}
                        className="gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" /> ดูตัวอย่างหน้าลูกค้า
                      </Button>
                      {(photosChanged || sectionsChanged || checklistChanged) && (
                        <Button
                          size="sm"
                          onClick={handleUpdateLink}
                          disabled={updatePhotos.isPending || updateSections.isPending || updateChecklist.isPending}
                          className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                        >
                          {(updatePhotos.isPending || updateSections.isPending || updateChecklist.isPending) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          อัปเดตข้อมูลลิงก์
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Link2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">
                      เมื่อเลือกรูปและตั้งค่าเนื้อหาเรียบร้อยแล้ว กดสร้างลิงก์เพื่อส่งให้ลูกค้า
                    </p>
                    <Button
                      onClick={handleGenerateLink}
                      disabled={generateLink.isPending}
                      className="gap-1.5"
                    >
                      {generateLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      สร้างลิงก์ส่งมอบงาน
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Sticky bottom save bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <p className="text-sm text-muted-foreground flex-1">
              มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
            </p>
            <Button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="gap-2 h-10 px-6"
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Save className="h-4 w-4" /> บันทึกทั้งหมด</>
              )}
            </Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
