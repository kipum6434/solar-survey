import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Save, Loader2, Info } from "lucide-react";

export default function PdfDocumentSettings() {
  const { data: settings, isLoading, refetch } = trpc.companySettings.get.useQuery();
  const updateMutation = trpc.companySettings.update.useMutation({
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเอกสาร PDF เรียบร้อยแล้ว");
      refetch();
      setHasChanges(false);
    },
    onError: (err) => {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    },
  });

  const [deliveryReportTitle, setDeliveryReportTitle] = useState("");
  const [surveyReportTitle, setSurveyReportTitle] = useState("");
  const [installReportTitle, setInstallReportTitle] = useState("");
  const [disclaimerText, setDisclaimerText] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [formLoaded, setFormLoaded] = useState(false);

  useEffect(() => {
    if (settings && !formLoaded) {
      setDeliveryReportTitle(settings.deliveryReportTitle || "ใบส่งมอบงานติดตั้ง Solar");
      setSurveyReportTitle(settings.surveyReportTitle || "รายงานการสำรวจ Solar");
      setInstallReportTitle(settings.installReportTitle || "รายงานส่งมอบงานติดตั้ง Solar");
      setDisclaimerText(settings.disclaimerText || "");
      setFormLoaded(true);
    }
  }, [settings, formLoaded]);

  const handleSave = () => {
    updateMutation.mutate({
      deliveryReportTitle: deliveryReportTitle.trim() || null,
      surveyReportTitle: surveyReportTitle.trim() || null,
      installReportTitle: installReportTitle.trim() || null,
      disclaimerText: disclaimerText.trim() || null,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">ตั้งค่าเอกสาร PDF</h1>
              <p className="text-sm text-gray-500">ปรับแต่งชื่อเอกสารและข้อความที่แสดงใน PDF</p>
            </div>
          </div>
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              บันทึก
            </Button>
          )}
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                ชื่อเอกสารจะแสดงที่ส่วนหัว (Header) ของทุกหน้าใน PDF ที่ Export ออกมา 
                ข้อความท้ายเอกสารจะแสดงก่อนส่วนลายเซ็นเพื่อแจ้งเงื่อนไขการรับประกัน
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Report Titles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ชื่อเอกสาร PDF</CardTitle>
            <CardDescription>ตั้งชื่อหัวเอกสารสำหรับ PDF แต่ละประเภท</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryTitle" className="text-sm font-medium">
                ใบส่งมอบงาน (Delivery)
              </Label>
              <Input
                id="deliveryTitle"
                value={deliveryReportTitle}
                onChange={(e) => {
                  setDeliveryReportTitle(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="เช่น ใบส่งมอบงานติดตั้ง Solar"
              />
              <p className="text-xs text-muted-foreground">ใช้สำหรับ PDF ใบส่งมอบงานที่ส่งให้ลูกค้าเซ็นรับ</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="surveyTitle" className="text-sm font-medium">
                รายงานสำรวจ (Survey)
              </Label>
              <Input
                id="surveyTitle"
                value={surveyReportTitle}
                onChange={(e) => {
                  setSurveyReportTitle(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="เช่น รายงานการสำรวจ Solar"
              />
              <p className="text-xs text-muted-foreground">ใช้สำหรับ PDF รายงานผลการสำรวจหน้างาน</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="installTitle" className="text-sm font-medium">
                รายงานติดตั้ง (Installation)
              </Label>
              <Input
                id="installTitle"
                value={installReportTitle}
                onChange={(e) => {
                  setInstallReportTitle(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="เช่น รายงานส่งมอบงานติดตั้ง Solar"
              />
              <p className="text-xs text-muted-foreground">ใช้สำหรับ PDF รายงานผลการติดตั้ง</p>
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer Text */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ข้อความท้ายเอกสาร (Disclaimer)</CardTitle>
            <CardDescription>ข้อความนี้จะแสดงท้ายใบส่งมอบทุกฉบับ ก่อนส่วนลายเซ็น เพื่อแจ้งเงื่อนไขการรับประกัน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={disclaimerText}
              onChange={(e) => {
                setDisclaimerText(e.target.value);
                setHasChanges(true);
              }}
              placeholder="เช่น: ผู้รับมอบงานรับรองว่าได้ตรวจสอบและรับทราบผลการติดตั้งระบบโซลาร์เซลล์ตามรายละเอียดที่ระบุในเอกสารฉบับนี้เรียบร้อยแล้ว..."
              rows={5}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">
              หากเว้นว่างไว้ จะไม่แสดงข้อความท้ายเอกสารใน PDF
            </p>
          </CardContent>
        </Card>

        {/* Save Button (bottom for mobile) */}
        <div className="flex justify-end pb-4">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            บันทึกการตั้งค่า
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
