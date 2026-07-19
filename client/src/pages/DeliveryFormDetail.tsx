import { useState, useRef, useEffect } from "react";
import SignaturePad from "signature_pad";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { exportDeliveryPDF, type DeliveryPDFData, type CompanyInfo, type ImageProxyFn } from "@/lib/pdfExport";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, ClipboardCheck, CheckCircle2, XCircle, PenTool,
  Download, Loader2, FileText, User, Wrench, Clock, Send,
} from "lucide-react";

export default function DeliveryFormDetail() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/delivery-forms/:id");
  const formId = params?.id ? Number(params.id) : null;

  // We need to get the delivery form by its ID - use the list and find
  const { data: forms, isLoading: listLoading } = trpc.deliveryForm.list.useQuery();
  const form = forms?.find((f) => f.id === formId);
  const surveyId = form?.surveyId;

  // Fetch the full delivery form data (checklist, signatures)
  const { data: deliveryForm, isLoading: deliveryLoading } = trpc.deliveryForm.get.useQuery(
    { surveyId: surveyId! },
    { enabled: !!surveyId }
  );

  // Fetch survey data for context
  const { data: surveyData, isLoading: surveyLoading } = trpc.survey.getById.useQuery(
    { id: surveyId! },
    { enabled: !!surveyId }
  );

  // Fetch installation photos and company settings for PDF
  const { data: installPhotos = [] } = trpc.installationPhoto.list.useQuery(
    { surveyId: surveyId! },
    { enabled: !!surveyId }
  );
  const { data: companySettingsData } = trpc.companySettings.get.useQuery();
  const { data: checklistTemplates = [] } = trpc.checklistTemplate.list.useQuery();

  // Image proxy for CORS images
  const proxyImageMut = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  const isLoading = listLoading || deliveryLoading || surveyLoading;

  const [pdfLoading, setPdfLoading] = useState(false);

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: "ร่าง", color: "bg-gray-100 text-gray-700", icon: Clock },
    signed: { label: "เซ็นรับมอบแล้ว", color: "bg-blue-100 text-blue-700", icon: PenTool },
    completed: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  };

  const handleGeneratePdf = async () => {
    if (!deliveryForm || !surveyData) return;
    setPdfLoading(true);
    try {
      const survey = surveyData.survey;
      const customer = surveyData.customer;

      // Build selected photos array
      const selectedIds: number[] = deliveryForm.selectedPhotoIds ? JSON.parse(deliveryForm.selectedPhotoIds) : [];
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
        deliveryReportTitle: companySettingsData.deliveryReportTitle,
      } : null;

      // Build full address
      const fullAddress = [customer?.address, customer?.district, customer?.subDistrict, customer?.province].filter(Boolean).join(" ") || undefined;

      const pdfData: DeliveryPDFData = {
        formId: deliveryForm.id,
        surveyId: surveyId!,
        customerName: customer?.name || "-",
        customerPhone: customer?.phone,
        customerAddress: fullAddress,
        roofType: customer?.roofType,
        phaseType: customer?.phaseType,
        systemSize: survey?.systemSize,
        panelCount: survey?.panelCount,
        panelBrand: survey?.panelBrand,
        inverterModel: survey?.inverterModel,
        checklistItems: deliveryForm.checklistItems || [],
        templateNameMap,
        customSections: (typeof deliveryForm.customSections === "string" ? JSON.parse(deliveryForm.customSections) : deliveryForm.customSections) || [],
        notes: deliveryForm.notes,
        disclaimerText: companySettingsData?.disclaimerText,
        photos: selectedPhotos,
        customerSignatureUrl: deliveryForm.customerSignatureUrl,
        customerSignerName: customer?.name,
        technicianSignatureUrl: deliveryForm.technicianSignatureUrl,
        technicianName: deliveryForm.technicianName,
        signedAt: deliveryForm.signedAt,
      };

      await exportDeliveryPDF(pdfData, undefined, imageProxyFn, companyInfo);
      toast.success("ดาวน์โหลด PDF สำเร็จ");
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast.error("ไม่สามารถสร้าง PDF ได้: " + (err.message || "Unknown error"));
    } finally {
      setPdfLoading(false);
    }
  };

  const formatDate = (date: Date | string | number | null | undefined) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
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
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/delivery-forms")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> กลับ
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !form || !deliveryForm ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">ไม่พบข้อมูลใบส่งมอบงาน</p>
          </div>
        ) : (
          <>
            {/* Title Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    ใบส่งมอบงาน
                    <Badge variant="outline" className="text-xs">DF-{String(formId).padStart(6, "0")}</Badge>
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {form.customerName || `งาน #${form.surveyId}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const sc = statusConfig[form.status] || statusConfig.draft;
                  const StatusIcon = sc.icon;
                  return (
                    <Badge className={`${sc.color} gap-1`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {sc.label}
                    </Badge>
                  );
                })()}
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setLocation(`/delivery-forms/${formId}/handover`)}
                  className="gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  จัดการหนังสือส่งมอบ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePdf}
                  disabled={pdfLoading}
                  className="gap-1.5"
                >
                  {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  ดาวน์โหลด PDF
                </Button>
              </div>
            </div>

            {/* Customer Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  ข้อมูลลูกค้า
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">ชื่อลูกค้า</p>
                    <p className="font-medium">{surveyData?.customer?.name || form.customerName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">เบอร์โทร</p>
                    <p className="font-medium">{surveyData?.customer?.phone || form.customerPhone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">รหัสงาน</p>
                    <p className="font-medium">#{form.surveyId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">ขนาดระบบ</p>
                    <p className="font-medium">{surveyData?.survey?.systemSize ? `${surveyData.survey.systemSize} kW` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">อินเวอร์เตอร์</p>
                    <p className="font-medium">{surveyData?.survey?.inverterModel || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">แผงโซลาร์</p>
                    <p className="font-medium">{surveyData?.survey?.panelBrand || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Checklist Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-amber-500" />
                  รายการตรวจสอบส่งมอบ
                  {deliveryForm.checklistItems && deliveryForm.checklistItems.length > 0 && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      {deliveryForm.checklistItems.filter((i: any) => i.checked).length}/{deliveryForm.checklistItems.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deliveryForm.checklistItems && deliveryForm.checklistItems.length > 0 ? (
                  <div className="space-y-2">
                    {deliveryForm.checklistItems.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          item.checked
                            ? "bg-green-50 border-green-200"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        {item.checked ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300 shrink-0" />
                        )}
                        <span className={`text-sm ${item.checked ? "text-green-800" : "text-gray-600"}`}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">ไม่มีรายการ checklist</p>
                )}
              </CardContent>
            </Card>

            {/* Notes Card */}
            {deliveryForm.notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    หมายเหตุ / ข้อตกลงเพิ่มเติม
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{deliveryForm.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Signatures Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-indigo-500" />
                  ลายเซ็น
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Customer Signature */}
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <User className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">ลายเซ็นลูกค้า</span>
                      {deliveryForm.customerSignatureUrl && (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">เซ็นแล้ว</Badge>
                      )}
                    </div>
                    <div className="border rounded-lg p-4 min-h-[120px] flex items-center justify-center bg-gray-50">
                      {deliveryForm.customerSignatureUrl ? (
                        <img
                          src={deliveryForm.customerSignatureUrl}
                          alt="ลายเซ็นลูกค้า"
                          className="max-h-[100px] max-w-full object-contain"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground italic">ยังไม่ได้เซ็น</p>
                      )}
                    </div>
                  </div>

                  {/* Technician Signature */}
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Wrench className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">ลายเซ็นช่าง</span>
                      {deliveryForm.technicianSignatureUrl && (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">เซ็นแล้ว</Badge>
                      )}
                    </div>
                    <div className="border rounded-lg p-4 min-h-[120px] flex items-center justify-center bg-gray-50">
                      {deliveryForm.technicianSignatureUrl ? (
                        <img
                          src={deliveryForm.technicianSignatureUrl}
                          alt="ลายเซ็นช่าง"
                          className="max-h-[100px] max-w-full object-contain"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground italic">ยังไม่ได้เซ็น</p>
                      )}
                    </div>
                    {deliveryForm.technicianName && (
                      <p className="text-xs text-muted-foreground mt-2">{deliveryForm.technicianName}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metadata Footer */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-4">
              <span>สร้างเมื่อ: {formatDate(form.createdAt)}</span>
              {form.signedAt && <span>เซ็นเมื่อ: {formatDate(form.signedAt)}</span>}
              <Button
                variant="link"
                size="sm"
                className="text-xs p-0 h-auto"
                onClick={() => setLocation(`/surveys/${form.surveyId}`)}
              >
                ดูงานสำรวจ →
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
