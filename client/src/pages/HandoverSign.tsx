import { useState, useRef, useEffect, useCallback } from "react";
import SignaturePad from "signature_pad";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, ClipboardCheck, PenTool,
  RotateCcw, Loader2, FileText, User, Wrench, Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";

export default function HandoverSign() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const { data, isLoading, error, refetch } = trpc.deliveryForm.getByHandoverToken.useQuery(
    { token },
    { enabled: !!token, retry: 1 }
  );

  const signMutation = trpc.deliveryForm.publicSignHandover.useMutation({
    onSuccess: () => {
      toast.success("เซ็นรับมอบงานสำเร็จ!");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // State
  const [signerName, setSignerName] = useState("");
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (showSignaturePad && canvasRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
    }
    return () => { padRef.current = null; };
  }, [showSignaturePad]);

  const handleSign = useCallback(() => {
    if (!padRef.current) return;
    if (padRef.current.isEmpty()) {
      toast.error("กรุณาเซ็นลายเซ็นก่อน");
      return;
    }
    if (!signerName.trim()) {
      toast.error("กรุณากรอกชื่อผู้เซ็น");
      return;
    }
    const dataUrl = padRef.current.toDataURL("image/png");
    signMutation.mutate({
      token,
      signatureData: dataUrl,
      signerName: signerName.trim(),
    });
  }, [token, signerName, signMutation]);

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

  // Already signed
  const isSigned = data.status === "signed" || data.status === "completed";

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

        {/* Checklist */}
        {data.checklistItems && data.checklistItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-amber-500" />
                รายการตรวจสอบส่งมอบ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {data.checklistItems.map((item: any, idx: number) => (
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

        {/* Signature Section */}
        <Card className="border-2 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PenTool className="h-4 w-4 text-amber-600" />
              ลายเซ็นรับมอบงาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isSigned ? (
              <div className="text-center py-4">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-800">เซ็นรับมอบงานเรียบร้อยแล้ว</p>
                {data.customerSignerName && (
                  <p className="text-xs text-muted-foreground mt-1">โดย: {data.customerSignerName}</p>
                )}
                {data.signedAt && (
                  <p className="text-xs text-muted-foreground">
                    เมื่อ: {new Date(data.signedAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {data.customerSignatureUrl && (
                  <div className="mt-3 border rounded-lg p-3 inline-block bg-white">
                    <img src={data.customerSignatureUrl} alt="ลายเซ็น" className="max-h-[80px]" />
                  </div>
                )}
              </div>
            ) : showSignaturePad ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อผู้เซ็น</label>
                  <Input
                    placeholder="กรอกชื่อ-นามสกุล"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ลายเซ็น</label>
                  <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={canvasRef}
                      className="w-full touch-none"
                      style={{ height: "180px" }}
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => padRef.current?.clear()} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> ล้าง
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowSignaturePad(false)}>
                      ยกเลิก
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSign}
                    disabled={signMutation.isPending}
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                  >
                    {signMutation.isPending ? (
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
                  กรุณาตรวจสอบข้อมูลด้านบนให้ครบถ้วน แล้วกดเซ็นรับมอบงาน
                </p>
                <Button onClick={() => setShowSignaturePad(true)} className="gap-1.5">
                  <PenTool className="h-4 w-4" /> เซ็นรับมอบงาน
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
    </div>
  );
}
