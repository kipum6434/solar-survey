import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Phone, MapPin, Upload, Trash2, ImageIcon, Save, Loader2, CheckCircle } from "lucide-react";

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const RECOMMENDED_SIZE = "512 x 512 px";
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function CompanySettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading, refetch } = trpc.companySettings.get.useQuery();
  const updateMutation = trpc.companySettings.update.useMutation({
    onSuccess: () => {
      toast.success("อัพเดทข้อมูลบริษัทเรียบร้อยแล้ว");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const uploadLogoMutation = trpc.companySettings.uploadLogo.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนโลโก้บริษัทเรียบร้อยแล้ว");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deleteLogoMutation = trpc.companySettings.deleteLogo.useMutation({
    onSuccess: () => {
      toast.success("ลบโลโก้บริษัทเรียบร้อยแล้ว");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [formLoaded, setFormLoaded] = useState(false);

  // Sync form state when data loads
  if (settings && !formLoaded) {
    setCompanyName(settings.companyName || "");
    setPhone(settings.phone || "");
    setAddress(settings.address || "");
    setFormLoaded(true);
  }

  const handleSave = useCallback(() => {
    updateMutation.mutate({ companyName, phone, address });
  }, [companyName, phone, address, updateMutation]);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("กรุณาอัพโหลดไฟล์ PNG, JPG หรือ WebP เท่านั้น");
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      toast.error(`ขนาดไฟล์ต้องไม่เกิน 2MB (ไฟล์ปัจจุบัน: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadLogoMutation.mutate({
        base64Data: base64,
        fileName: file.name,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadLogoMutation, toast]);

  const handleDeleteLogo = useCallback(() => {
    if (window.confirm("ต้องการลบโลโก้บริษัทหรือไม่?")) {
      deleteLogoMutation.mutate();
    }
  }, [deleteLogoMutation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่าบริษัท</h1>
        <p className="text-muted-foreground mt-1">จัดการข้อมูลบริษัทที่แสดงในรายงาน PDF และเอกสาร</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              ข้อมูลบริษัท
            </CardTitle>
            <CardDescription>ข้อมูลนี้จะแสดงใน header ของรายงาน PDF ที่ส่งออก</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                ชื่อบริษัท
              </Label>
              <Input
                id="companyName"
                placeholder="เช่น บริษัท TCS Solar จำกัด"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                เบอร์โทรศัพท์
              </Label>
              <Input
                id="phone"
                placeholder="เช่น 02-xxx-xxxx หรือ 08x-xxx-xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                ที่อยู่บริษัท
              </Label>
              <Textarea
                id="address"
                placeholder="เช่น 123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              {updateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> บันทึกข้อมูลบริษัท</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Logo Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-amber-500" />
              โลโก้บริษัท
            </CardTitle>
            <CardDescription>โลโก้จะแสดงที่มุมบนขวาของทุกหน้าในรายงาน PDF</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Preview */}
            <div className="flex flex-col items-center gap-4">
              {settings?.logoUrl ? (
                <div className="relative group">
                  <div className="w-32 h-32 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                    <img
                      src={settings.logoUrl}
                      alt="โลโก้บริษัท"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    อัพโหลดแล้ว
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground/50 bg-muted/20">
                  <ImageIcon className="h-10 w-10 mb-1" />
                  <span className="text-xs">ยังไม่มีโลโก้</span>
                </div>
              )}
            </div>

            {/* Upload Info */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium text-foreground">ข้อกำหนดโลโก้:</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                <li>• ขนาดแนะนำ: <strong>{RECOMMENDED_SIZE}</strong></li>
                <li>• ขนาดไฟล์สูงสุด: <strong>2 MB</strong></li>
                <li>• รูปแบบที่รองรับ: <strong>PNG, JPG, WebP</strong></li>
                <li>• แนะนำพื้นหลังโปร่งใส (PNG) เพื่อผลลัพธ์ที่ดีที่สุด</li>
              </ul>
            </div>

            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLogoMutation.isPending}
              >
                {uploadLogoMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังอัพโหลด...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> {settings?.logoUrl ? "เปลี่ยนโลโก้" : "อัพโหลดโลโก้"}</>
                )}
              </Button>
              {settings?.logoUrl && (
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteLogo}
                  disabled={deleteLogoMutation.isPending}
                >
                  {deleteLogoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ตัวอย่าง Header PDF</CardTitle>
          <CardDescription>ตัวอย่างคร่าวๆ ว่าข้อมูลจะแสดงใน PDF อย่างไร</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-gradient-to-r from-amber-500 to-amber-600 p-4 text-white relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">
                  {companyName || "ชื่อบริษัท (ยังไม่ได้ตั้ง)"}
                </h3>
                {phone && (
                  <p className="text-sm text-amber-100 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {phone}
                  </p>
                )}
                {address && (
                  <p className="text-sm text-amber-100 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {address}
                  </p>
                )}
                <p className="text-xs text-amber-200 mt-2">รายงานการสำรวจ Solar  |  ลูกค้า: ตัวอย่าง  |  #001</p>
              </div>
              {settings?.logoUrl && (
                <div className="w-14 h-14 rounded-lg bg-white/90 flex items-center justify-center flex-shrink-0 ml-4">
                  <img src={settings.logoUrl} alt="Logo" className="max-w-[48px] max-h-[48px] object-contain" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
