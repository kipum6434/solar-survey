import { useState, useRef, useEffect, useCallback } from "react";
import SignaturePad from "signature_pad";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { exportDeliveryPDF, type DeliveryPDFData, type CompanyInfo, type ImageProxyFn } from "@/lib/pdfExport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  FileSignature, CheckCircle2, XCircle, ClipboardCheck, PenTool,
  RotateCcw, Download, Loader2, FileText, User, Wrench,
} from "lucide-react";

interface DeliveryFormSectionProps {
  surveyId: number;
  installationStatus: string | null;
  surveyData?: any;
  customerData?: any;
}

export default function DeliveryFormSection({ surveyId, installationStatus, surveyData, customerData }: DeliveryFormSectionProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Queries
  const { data: form, isLoading: formLoading, refetch: refetchForm } = trpc.deliveryForm.get.useQuery({ surveyId });
  const { data: checklistTemplates = [] } = trpc.checklistTemplate.list.useQuery();
  const { data: installPhotos = [] } = trpc.installationPhoto.list.useQuery({ surveyId });
  const { data: companySettingsData } = trpc.companySettings.get.useQuery();

  // Mutations
  const createForm = trpc.deliveryForm.create.useMutation({
    onSuccess: () => { toast.success("สร้างใบส่งมอบงานสำเร็จ"); refetchForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateChecklist = trpc.deliveryForm.updateChecklist.useMutation({
    onSuccess: () => { refetchForm(); },
    onError: (e) => toast.error(e.message),
  });
  const saveSignature = trpc.deliveryForm.saveSignature.useMutation({
    onSuccess: () => { toast.success("บันทึกลายเซ็นสำเร็จ"); refetchForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateNotes = trpc.deliveryForm.updateNotes.useMutation({
    onSuccess: () => { toast.success("บันทึกหมายเหตุสำเร็จ"); refetchForm(); },
    onError: (e) => toast.error(e.message),
  });

  // State
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesChanged, setNotesChanged] = useState(false);
  const [activeSignature, setActiveSignature] = useState<"customer" | "technician" | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Signature pad refs
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (form?.notes && !notesChanged) {
      setNotes(form.notes);
    }
  }, [form?.notes, notesChanged]);

  // Initialize signature pad when dialog opens
  useEffect(() => {
    if (activeSignature && signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);

      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
    }
    return () => {
      signaturePadRef.current = null;
    };
  }, [activeSignature]);

  const handleSaveSignature = useCallback(() => {
    if (!signaturePadRef.current || !activeSignature) return;
    if (signaturePadRef.current.isEmpty()) {
      toast.error("กรุณาเซ็นลายเซ็นก่อน");
      return;
    }
    const dataUrl = signaturePadRef.current.toDataURL("image/png");
    saveSignature.mutate({
      surveyId,
      type: activeSignature,
      signatureData: dataUrl,
    });
    setActiveSignature(null);
  }, [activeSignature, surveyId, saveSignature]);

  const handleCreateForm = () => {
    // Each template has: id, name, items (JSON string array of checklist labels)
    // We need to flatten all template items into individual checklist items
    const checklistItems: { templateId: number; label: string; checked: boolean }[] = [];
    for (const t of checklistTemplates as any[]) {
      try {
        const items: string[] = typeof t.items === "string" ? JSON.parse(t.items) : (t.items || []);
        for (const label of items) {
          checklistItems.push({ templateId: t.id, label, checked: false });
        }
      } catch {
        // If items parsing fails, use template name as fallback
        checklistItems.push({ templateId: t.id, label: t.name || "รายการตรวจสอบ", checked: false });
      }
    }
    createForm.mutate({
      surveyId,
      checklistItems,
    });
    setShowCreateConfirm(false);
  };

  const handleToggleChecklist = (index: number) => {
    if (!form) return;
    const items = [...(form.checklistItems || [])];
    items[index] = { ...items[index], checked: !items[index].checked };
    updateChecklist.mutate({
      id: form.id,
      checklistItems: items,
    });
  };

  const handleSaveNotes = () => {
    if (!form) return;
    updateNotes.mutate({ id: form.id, notes });
    setNotesChanged(false);
  };

  // Image proxy for CORS images
  const proxyImageMut = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  const handleGeneratePdf = async () => {
    if (!form || !surveyData || !customerData) return;
    setIsGeneratingPdf(true);
    try {
      // Build selected photos array
      const selectedIds: number[] = form.selectedPhotoIds ? JSON.parse(form.selectedPhotoIds) : [];
      const selectedPhotos = (installPhotos as any[]).filter((p) => selectedIds.includes(p.id)).map((p) => ({ url: p.url, caption: p.caption }));

      // Build templateNameMap
      const templateNameMap: Record<number, string> = Object.fromEntries(
        (checklistTemplates as any[]).map((t) => [t.id, t.name])
      );

      // Build companyInfo
      const companyInfo: CompanyInfo | null = companySettingsData ? {
        companyName: companySettingsData.companyName,
        phone: companySettingsData.phone,
        address: companySettingsData.address,
        logoUrl: companySettingsData.logoUrl,
        photoBorderColor: companySettingsData.photoBorderColor,
      } : null;

      // Build full address
      const fullAddress = [customerData?.fullAddress, customerData?.subDistrict, customerData?.district, customerData?.province, customerData?.postalCode].filter(Boolean).join(" ") || undefined;

      const pdfData: DeliveryPDFData = {
        formId: form.id,
        surveyId,
        customerName: customerData?.name || "-",
        customerPhone: customerData?.phone,
        customerAddress: fullAddress,
        roofType: customerData?.roofType,
        phaseType: customerData?.phaseType,
        systemSize: surveyData?.systemSize,
        panelCount: surveyData?.panelCount,
        panelBrand: surveyData?.panelBrand,
        inverterModel: surveyData?.inverterModel,
        checklistItems: form.checklistItems || [],
        templateNameMap,
        customSections: (typeof form.customSections === "string" ? JSON.parse(form.customSections) : form.customSections) || [],
        notes: form.notes,
        disclaimerText: companySettingsData?.disclaimerText,
        photos: selectedPhotos,
        customerSignatureUrl: form.customerSignatureUrl,
        customerSignerName: customerData?.name,
        technicianSignatureUrl: form.technicianSignatureUrl,
        technicianName: form.technicianName,
        signedAt: form.signedAt,
      };

      await exportDeliveryPDF(pdfData, undefined, imageProxyFn, companyInfo);
      toast.success("ดาวน์โหลด PDF สำเร็จ");
    } catch (err: any) {
      toast.error(err?.message || "สร้าง PDF ล้มเหลว");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const canCreateForm = installationStatus === "completed" || installationStatus === "delivered" || installationStatus === "payment_collected" || isAdmin;

  if (formLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!form) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            ใบส่งมอบงาน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-1">ยังไม่มีใบส่งมอบงาน</p>
            <p className="text-xs text-muted-foreground mb-4">สร้างใบส่งมอบงานเพื่อให้ลูกค้าเซ็นรับมอบ</p>
            {canCreateForm ? (
              <Button
                className="gap-1.5"
                onClick={() => setShowCreateConfirm(true)}
                disabled={createForm.isPending}
              >
                <FileSignature className="h-4 w-4" />
                {createForm.isPending ? "กำลังสร้าง..." : "สร้างใบส่งมอบงาน"}
              </Button>
            ) : (
              <p className="text-xs text-amber-600">ต้องติดตั้งเสร็จก่อนจึงจะสร้างใบส่งมอบได้</p>
            )}
          </div>

          <AlertDialog open={showCreateConfirm} onOpenChange={setShowCreateConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>สร้างใบส่งมอบงาน</AlertDialogTitle>
                <AlertDialogDescription>
                  ระบบจะสร้างใบส่งมอบงานพร้อม checklist {checklistTemplates.length} รายการ
                  <br />
                  <span className="text-xs mt-1 block">สามารถแก้ไข checklist และเพิ่มลายเซ็นได้ภายหลัง</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction onClick={handleCreateForm}>สร้าง</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  const allChecked = (form.checklistItems || []).every((item: any) => item.checked);
  const checkedCount = (form.checklistItems || []).filter((item: any) => item.checked).length;
  const totalCount = (form.checklistItems || []).length;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              ใบส่งมอบงาน
              <Badge variant="secondary" className="text-[10px]">DF-{String(form.id).padStart(5, "0")}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {form.signedAt && (
                <Badge className="bg-green-50 text-green-700 border-0 text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> เซ็นรับมอบแล้ว
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
              >
                <Download className="h-3.5 w-3.5" />
                {isGeneratingPdf ? "กำลังสร้าง..." : "ดาวน์โหลด PDF"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Checklist Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            รายการตรวจสอบส่งมอบ
            <Badge variant={allChecked ? "default" : "secondary"} className={`text-[10px] ${allChecked ? "bg-green-600" : ""}`}>
              {checkedCount}/{totalCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มีรายการ checklist (เพิ่มได้ที่ ตั้งค่า &gt; Checklist ส่งมอบ)</p>
          ) : (
            <div className="space-y-2">
              {(form.checklistItems || []).map((item: any, index: number) => (
                <button
                  key={index}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    item.checked
                      ? "bg-green-50/50 border-green-200 hover:bg-green-50"
                      : "bg-white hover:bg-muted/30 border-border"
                  }`}
                  onClick={() => handleToggleChecklist(index)}
                >
                  <div className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                    item.checked ? "bg-green-600 border-green-600" : "border-gray-300"
                  }`}>
                    {item.checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <span className={`text-sm flex-1 ${item.checked ? "text-green-700 line-through" : "text-foreground"}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">หมายเหตุ / ข้อตกลงเพิ่มเติม</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="ระบุหมายเหตุหรือข้อตกลงเพิ่มเติม (ถ้ามี)..."
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNotesChanged(true); }}
            rows={3}
            className="resize-none text-sm"
          />
          {notesChanged && (
            <Button
              size="sm"
              className="mt-2 gap-1.5"
              onClick={handleSaveNotes}
              disabled={updateNotes.isPending}
            >
              {updateNotes.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              บันทึกหมายเหตุ
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Signatures Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            ลายเซ็น
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Signature */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">ลายเซ็นลูกค้า</span>
                {form.customerSignatureUrl && (
                  <Badge className="bg-green-50 text-green-700 border-0 text-[10px]">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> เซ็นแล้ว
                  </Badge>
                )}
              </div>
              {form.customerSignatureUrl ? (
                <div className="border rounded-lg p-2 bg-white">
                  <img src={form.customerSignatureUrl} alt="ลายเซ็นลูกค้า" className="w-full h-24 object-contain" />
                  <p className="text-xs text-center text-muted-foreground mt-1">{customerData?.name || "-"}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-xs gap-1"
                    onClick={() => setActiveSignature("customer")}
                  >
                    <RotateCcw className="h-3 w-3" /> เซ็นใหม่
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setActiveSignature("customer")}
                >
                  <PenTool className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">กดเพื่อเซ็นลายเซ็นลูกค้า</p>
                </div>
              )}
            </div>

            {/* Technician Signature */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">ลายเซ็นช่าง</span>
                {form.technicianSignatureUrl && (
                  <Badge className="bg-green-50 text-green-700 border-0 text-[10px]">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> เซ็นแล้ว
                  </Badge>
                )}
              </div>
              {form.technicianSignatureUrl ? (
                <div className="border rounded-lg p-2 bg-white">
                  <img src={form.technicianSignatureUrl} alt="ลายเซ็นช่าง" className="w-full h-24 object-contain" />
                  <p className="text-xs text-center text-muted-foreground mt-1">{form.technicianName || "-"}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-xs gap-1"
                    onClick={() => setActiveSignature("technician")}
                  >
                    <RotateCcw className="h-3 w-3" /> เซ็นใหม่
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setActiveSignature("technician")}
                >
                  <PenTool className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">กดเพื่อเซ็นลายเซ็นช่าง</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Pad Dialog */}
      {activeSignature && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setActiveSignature(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {activeSignature === "customer" ? "ลายเซ็นลูกค้า" : "ลายเซ็นช่าง"}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveSignature(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="border-2 rounded-lg overflow-hidden bg-white mb-3">
              <canvas
                ref={signatureCanvasRef}
                className="w-full touch-none"
                style={{ height: "200px" }}
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => signaturePadRef.current?.clear()}
              >
                <RotateCcw className="h-3.5 w-3.5" /> ล้าง
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSaveSignature}
                disabled={saveSignature.isPending}
              >
                {saveSignature.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                บันทึกลายเซ็น
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
