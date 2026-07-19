import { useState, useRef, useEffect, useCallback } from "react";
import SignaturePad from "signature_pad";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { exportDeliveryPDF, type DeliveryPDFData, type CompanyInfo, type ImageProxyFn } from "@/lib/pdfExport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ClipboardCheck, PenTool,
  RotateCcw, Loader2, FileText, User, Wrench, Image as ImageIcon,
  AlertTriangle, Download, HardHat,
} from "lucide-react";
import ProfilePickerDialog, { type SelectedProfileData } from "@/components/ProfilePickerDialog";

export default function HandoverSign() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const { data, isLoading, error, refetch } = trpc.deliveryForm.getByHandoverToken.useQuery(
    { token },
    { enabled: !!token, retry: 1 }
  );

  // Technician sign mutation
  const techSignMutation = trpc.deliveryForm.publicSignTechnician.useMutation({
    onSuccess: () => {
      toast.success("ช่างเซ็นส่งมอบงานสำเร็จ!");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Customer sign mutation
  const customerSignMutation = trpc.deliveryForm.publicSignHandover.useMutation({
    onSuccess: () => {
      toast.success("ลูกค้าเซ็นรับมอบงานสำเร็จ!");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Image proxy for PDF generation
  const proxyImageMut = trpc.util.proxyImage.useMutation();
  const imageProxyFn: ImageProxyFn = async (url: string) => {
    try {
      const result = await proxyImageMut.mutateAsync({ url });
      return result?.data || null;
    } catch { return null; }
  };

  // State
  const [techName, setTechName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [showTechPad, setShowTechPad] = useState(false);
  const [showCustomerPad, setShowCustomerPad] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  const handleDownloadPdf = () => {
    if (!data) return;
    setShowProfilePicker(true);
  };

  const handleProfileSelected = async (profile: SelectedProfileData) => {
    setShowProfilePicker(false);
    if (!data) return;
    setPdfLoading(true);
    try {
      const companyInfo: CompanyInfo = {
        companyName: profile.name,
        phone: profile.phone,
        address: profile.address,
        logoUrl: profile.logoUrl,
        photoBorderColor: profile.headerColor || data.photoBorderColor || "#1e3a5f",
        deliveryReportTitle: data.deliveryReportTitle,
      };

      const pdfData: DeliveryPDFData = {
        formId: data.id,
        surveyId: data.surveyId || 0,
        customerName: data.customerName || "-",
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        roofType: data.roofType,
        phaseType: data.phaseType,
        systemSize: data.systemSize ? Number(data.systemSize) || undefined : undefined,
        panelCount: data.panelCount ? Number(data.panelCount) || undefined : undefined,
        panelBrand: data.panelBrand,
        inverterModel: data.inverterModel,
        checklistItems: data.checklistItems || [],
        templateNameMap: data.templateNameMap || {},
        customSections: Array.isArray(data.customSections) ? data.customSections : [],
        notes: data.notes,
        disclaimerText: data.disclaimerText,
        photos: data.photos || [],
        customerSignatureUrl: data.customerSignatureUrl,
        customerSignerName: data.customerSignerName,
        technicianSignatureUrl: data.technicianSignatureUrl,
        technicianName: data.technicianName,
        signedAt: data.signedAt,
      };

      await exportDeliveryPDF(pdfData, undefined, imageProxyFn, companyInfo);
      toast.success("ดาวน์โหลด PDF สำเร็จ");
    } catch (err: any) {
      console.error("PDF error:", err);
      toast.error("ไม่สามารถสร้าง PDF ได้: " + (err.message || ""));
    } finally {
      setPdfLoading(false);
    }
  };

  // Technician signature pad
  const techCanvasRef = useRef<HTMLCanvasElement>(null);
  const techPadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (showTechPad && techCanvasRef.current) {
      const canvas = techCanvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      techPadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
    }
    return () => { if (showTechPad) techPadRef.current = null; };
  }, [showTechPad]);

  // Customer signature pad
  const customerCanvasRef = useRef<HTMLCanvasElement>(null);
  const customerPadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (showCustomerPad && customerCanvasRef.current) {
      const canvas = customerCanvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      customerPadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
    }
    return () => { if (showCustomerPad) customerPadRef.current = null; };
  }, [showCustomerPad]);

  const handleTechSign = useCallback(() => {
    if (!techPadRef.current) return;
    if (techPadRef.current.isEmpty()) {
      toast.error("กรุณาเซ็นลายเซ็นก่อน");
      return;
    }
    if (!techName.trim()) {
      toast.error("กรุณากรอกชื่อช่าง");
      return;
    }
    const dataUrl = techPadRef.current.toDataURL("image/png");
    techSignMutation.mutate({
      token,
      signatureData: dataUrl,
      technicianName: techName.trim(),
    });
  }, [token, techName, techSignMutation]);

  const handleCustomerSign = useCallback(() => {
    if (!customerPadRef.current) return;
    if (customerPadRef.current.isEmpty()) {
      toast.error("กรุณาเซ็นลายเซ็นก่อน");
      return;
    }
    if (!customerName.trim()) {
      toast.error("กรุณากรอกชื่อผู้เซ็น");
      return;
    }
    const dataUrl = customerPadRef.current.toDataURL("image/png");
    customerSignMutation.mutate({
      token,
      signatureData: dataUrl,
      signerName: customerName.trim(),
    });
  }, [token, customerName, customerSignMutation]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-2">ลิงก์ไม่ถูกต้อง</h2>
            <p className="text-sm text-muted-foreground">
              ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine states
  const isSigned = data.status === "signed" || data.status === "completed";
  const techSigned = !!data.technicianSignatureUrl;
  const customerSigned = !!data.customerSignatureUrl;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold">หนังสือส่งมอบงาน</h1>
              <p className="text-xs text-muted-foreground">ระบบโซลาร์เซลล์</p>
            </div>
            {isSigned && (
              <Badge className="bg-green-100 text-green-700 gap-1">
                <CheckCircle2 className="h-3 w-3" /> เซ็นแล้ว
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              ข้อมูลลูกค้า
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">ชื่อ:</span> <span className="font-medium">{data.customerName}</span></div>
              <div><span className="text-muted-foreground">โทร:</span> <span className="font-medium">{data.customerPhone}</span></div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">ที่อยู่:</span> <span className="font-medium">{data.customerAddress}</span></div>
              {data.roofType && <div><span className="text-muted-foreground">หลังคา:</span> <span className="font-medium">{data.roofType}</span></div>}
              {data.phaseType && <div><span className="text-muted-foreground">ระบบไฟ:</span> <span className="font-medium">{data.phaseType === "three" ? "3 เฟส" : "1 เฟส"}</span></div>}
            </div>
          </CardContent>
        </Card>

        {/* Technical Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              ข้อมูลทางเทคนิค
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {data.systemSize && <div><span className="text-muted-foreground">ขนาดระบบ:</span> <span className="font-medium">{data.systemSize} kW</span></div>}
              {data.panelCount && <div><span className="text-muted-foreground">จำนวนแผง:</span> <span className="font-medium">{data.panelCount} แผง</span></div>}
              {data.panelBrand && <div><span className="text-muted-foreground">ยี่ห้อแผง:</span> <span className="font-medium">{data.panelBrand}</span></div>}
              {data.inverterModel && <div><span className="text-muted-foreground">อินเวอร์เตอร์:</span> <span className="font-medium">{data.inverterModel}</span></div>}
            </div>
          </CardContent>
        </Card>

        {/* Installation Photos */}
        {data.photos && data.photos.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-green-500" />
                รูปภาพหน้างาน ({data.photos.length} รูป)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.photos.map((photo: any) => (
                  <div
                    key={photo.id}
                    className="relative rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => setLightboxImg(photo.url)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || ""}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                        {photo.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checklist - grouped by template */}
        {data.checklistItems && data.checklistItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-amber-500" />
                รายการตรวจสอบส่งมอบ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const templateNameMap = data.templateNameMap || {};
                  const groups: { templateId: number | undefined; name: string; items: any[] }[] = [];
                  let currentGroup: typeof groups[0] | null = null;
                  data.checklistItems.forEach((item: any) => {
                    const tid = item.templateId;
                    if (!currentGroup || currentGroup.templateId !== tid) {
                      currentGroup = { templateId: tid, name: tid ? (templateNameMap[tid] || `หมวด ${tid}`) : "รายการเพิ่มเติม", items: [] };
                      groups.push(currentGroup);
                    }
                    currentGroup.items.push(item);
                  });
                  return groups.map((group, gi) => (
                    <div key={gi}>
                      {groups.length > 1 && (
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 border-b pb-1">{group.name}</p>
                      )}
                      <div className="space-y-1.5">
                        {group.items.map((item: any, idx: number) => (
                          <div key={idx} className={`flex items-center gap-2 p-2 rounded text-sm ${
                            item.checked ? "bg-green-50" : "bg-gray-50"
                          }`}>
                            {item.checked ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-300 shrink-0" />
                            )}
                            <span className={item.checked ? "text-green-800" : "text-gray-600"}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom Sections */}
        {data.customSections && data.customSections.length > 0 && (
          <>
            {data.customSections.map((section: any, idx: number) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    {section.title || `หัวข้อ ${idx + 1}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{section.content}</p>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {/* Notes */}
        {data.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                หมายเหตุ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Disclaimer Text */}
        {data.disclaimerText && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="pt-4">
              <p className="text-xs text-gray-600 whitespace-pre-line">{data.disclaimerText}</p>
            </CardContent>
          </Card>
        )}

        {/* ===== SIGNATURE SECTION ===== */}
        {/* Step 1: Technician Signature */}
        <Card className={`border-2 ${techSigned ? "border-green-200" : "border-orange-200"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardHat className="h-4 w-4 text-orange-600" />
              ขั้นตอนที่ 1: ลายเซ็นช่าง (ผู้ส่งมอบ)
              {techSigned && (
                <Badge className="bg-green-100 text-green-700 text-[10px] ml-auto">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> เซ็นแล้ว
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {techSigned ? (
              <div className="text-center py-3">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-800">ช่างเซ็นส่งมอบงานแล้ว</p>
                {data.technicianName && (
                  <p className="text-xs text-muted-foreground mt-1">โดย: {data.technicianName}</p>
                )}
                {data.technicianSignedAt && (
                  <p className="text-xs text-muted-foreground">
                    เมื่อ: {new Date(data.technicianSignedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {data.technicianSignatureUrl && (
                  <div className="mt-2 border rounded-lg p-2 inline-block bg-white">
                    <img src={data.technicianSignatureUrl} alt="ลายเซ็นช่าง" className="max-h-[60px]" />
                  </div>
                )}
              </div>
            ) : showTechPad ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อช่างผู้ส่งมอบ</label>
                  <Input
                    placeholder="กรอกชื่อ-นามสกุล ช่าง"
                    value={techName}
                    onChange={(e) => setTechName(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ลายเซ็นช่าง</label>
                  <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={techCanvasRef}
                      className="w-full touch-none"
                      style={{ height: "180px" }}
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => techPadRef.current?.clear()} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> ล้าง
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowTechPad(false)}>
                      ยกเลิก
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleTechSign}
                    disabled={techSignMutation.isPending}
                    className="gap-1.5 bg-orange-600 hover:bg-orange-700"
                  >
                    {techSignMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    ยืนยันเซ็นส่งมอบ
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <HardHat className="h-10 w-10 text-orange-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  ช่างผู้ติดตั้งกรุณาเซ็นส่งมอบงานก่อน
                </p>
                <Button onClick={() => setShowTechPad(true)} className="gap-1.5 bg-orange-600 hover:bg-orange-700">
                  <PenTool className="h-4 w-4" /> เซ็นส่งมอบงาน (ช่าง)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Customer Signature */}
        <Card className={`border-2 ${customerSigned ? "border-green-200" : techSigned ? "border-amber-200" : "border-gray-200 opacity-60"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PenTool className="h-4 w-4 text-amber-600" />
              ขั้นตอนที่ 2: ลายเซ็นลูกค้า (ผู้รับมอบ)
              {customerSigned && (
                <Badge className="bg-green-100 text-green-700 text-[10px] ml-auto">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> เซ็นแล้ว
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerSigned ? (
              <div className="text-center py-3">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-800">ลูกค้าเซ็นรับมอบงานเรียบร้อยแล้ว</p>
                {data.customerSignerName && (
                  <p className="text-xs text-muted-foreground mt-1">โดย: {data.customerSignerName}</p>
                )}
                {data.signedAt && (
                  <p className="text-xs text-muted-foreground">
                    เมื่อ: {new Date(data.signedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {data.customerSignatureUrl && (
                  <div className="mt-2 border rounded-lg p-2 inline-block bg-white">
                    <img src={data.customerSignatureUrl} alt="ลายเซ็นลูกค้า" className="max-h-[60px]" />
                  </div>
                )}
                {/* Download PDF button after both signed */}
                <div className="mt-4">
                  <Button
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                    className="gap-2"
                    variant="outline"
                  >
                    {pdfLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> กำลังสร้าง PDF...</>
                    ) : (
                      <><Download className="h-4 w-4" /> ดาวน์โหลดใบส่งมอบงาน (PDF)</>
                    )}
                  </Button>
                </div>
              </div>
            ) : !techSigned ? (
              <div className="text-center py-4">
                <PenTool className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  กรุณาให้ช่างเซ็นส่งมอบงานก่อน (ขั้นตอนที่ 1)
                </p>
              </div>
            ) : showCustomerPad ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อผู้รับมอบ (ลูกค้า)</label>
                  <Input
                    placeholder="กรอกชื่อ-นามสกุล ลูกค้า"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ลายเซ็นลูกค้า</label>
                  <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={customerCanvasRef}
                      className="w-full touch-none"
                      style={{ height: "180px" }}
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => customerPadRef.current?.clear()} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> ล้าง
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowCustomerPad(false)}>
                      ยกเลิก
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCustomerSign}
                    disabled={customerSignMutation.isPending}
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                  >
                    {customerSignMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    ยืนยันเซ็นรับมอบ
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <PenTool className="h-10 w-10 text-amber-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  ลูกค้ากรุณาตรวจสอบข้อมูลด้านบนให้ครบถ้วน แล้วกดเซ็นรับมอบงาน
                </p>
                <Button onClick={() => setShowCustomerPad(true)} className="gap-1.5 bg-green-600 hover:bg-green-700">
                  <PenTool className="h-4 w-4" /> เซ็นรับมอบงาน (ลูกค้า)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-4 text-xs text-muted-foreground">
          <p>เอกสารนี้สร้างโดยระบบ Solar Survey Management</p>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
            onClick={() => setLightboxImg(null)}
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Profile Picker Dialog */}
      <ProfilePickerDialog
        open={showProfilePicker}
        onOpenChange={setShowProfilePicker}
        onConfirm={handleProfileSelected}
        title="เลือกโปรไฟล์บริษัทสำหรับใบส่งมอบงาน"
        usePublicList
      />
    </div>
  );
}
