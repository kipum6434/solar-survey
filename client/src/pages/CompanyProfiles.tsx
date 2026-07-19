import { useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Upload, Star, Pencil, Loader2, ImageIcon, Palette } from "lucide-react";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const PRESET_COLORS = [
  "#1e3a5f", // Dark blue (current)
  "#0f4c81", // Navy blue
  "#2c5f2d", // Forest green
  "#1a1a2e", // Dark navy
  "#4a0e4e", // Deep purple
  "#8b0000", // Dark red
  "#2d3436", // Charcoal
  "#0a3d62", // Ocean blue
  "#1b5e20", // Green
  "#4a148c", // Purple
  "#bf360c", // Burnt orange
  "#006064", // Teal
];

interface ProfileFormData {
  name: string;
  address: string;
  phone: string;
  headerColor: string;
}

export default function CompanyProfiles() {
  const { data: profiles, isLoading, refetch } = trpc.companyProfile.list.useQuery();
  const createMutation = trpc.companyProfile.create.useMutation({
    onSuccess: () => { toast.success("สร้างโปรไฟล์บริษัทเรียบร้อย"); refetch(); setShowCreateDialog(false); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.companyProfile.update.useMutation({
    onSuccess: () => { toast.success("อัพเดทโปรไฟล์เรียบร้อย"); refetch(); setShowEditDialog(false); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.companyProfile.delete.useMutation({
    onSuccess: () => { toast.success("ลบโปรไฟล์เรียบร้อย"); refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const uploadLogoMutation = trpc.companyProfile.uploadLogo.useMutation({
    onSuccess: () => { toast.success("อัพโหลดโลโก้เรียบร้อย"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({ name: "", address: "", phone: "", headerColor: "#1e3a5f" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingProfileId, setUploadingProfileId] = useState<number | null>(null);

  const handleCreate = useCallback(() => {
    if (!formData.name.trim()) { toast.error("กรุณาระบุชื่อบริษัท"); return; }
    createMutation.mutate({
      name: formData.name,
      address: formData.address || undefined,
      phone: formData.phone || undefined,
      headerColor: formData.headerColor || undefined,
      isDefault: !profiles || profiles.length === 0,
    });
  }, [formData, createMutation, profiles]);

  const handleEdit = useCallback(() => {
    if (!editingId || !formData.name.trim()) return;
    updateMutation.mutate({
      id: editingId,
      name: formData.name,
      address: formData.address || null,
      phone: formData.phone || null,
      headerColor: formData.headerColor || null,
    });
  }, [editingId, formData, updateMutation]);

  const handleSetDefault = useCallback((id: number) => {
    updateMutation.mutate({ id, isDefault: true });
  }, [updateMutation]);

  const handleDelete = useCallback((id: number, name: string) => {
    if (window.confirm(`ต้องการลบโปรไฟล์ "${name}" หรือไม่?`)) {
      deleteMutation.mutate({ id });
    }
  }, [deleteMutation]);

  const handleLogoUpload = useCallback((profileId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("กรุณาอัพโหลดไฟล์ PNG, JPG หรือ WebP เท่านั้น");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(`ขนาดไฟล์ต้องไม่เกิน 2MB`);
      return;
    }
    setUploadingProfileId(profileId);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadLogoMutation.mutate({ profileId, base64Data: base64, fileName: file.name, mimeType: file.type }, {
        onSettled: () => setUploadingProfileId(null),
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadLogoMutation]);

  const openCreateDialog = () => {
    setFormData({ name: "", address: "", phone: "", headerColor: "#1e3a5f" });
    setShowCreateDialog(true);
  };

  const openEditDialog = (profile: any) => {
    setEditingId(profile.id);
    setFormData({
      name: profile.name || "",
      address: profile.address || "",
      phone: profile.phone || "",
      headerColor: profile.headerColor || "#1e3a5f",
    });
    setShowEditDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              โปรไฟล์บริษัท
            </h1>
            <p className="text-muted-foreground mt-1">
              จัดการบริษัทที่ใช้ในหัวเอกสาร PDF — เลือกโปรไฟล์ตอน Export ได้
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" /> เพิ่มบริษัท
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !profiles || profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">ยังไม่มีโปรไฟล์บริษัท</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" /> สร้างโปรไฟล์แรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {profiles.map((profile) => (
              <Card key={profile.id} className={profile.isDefault ? "border-primary/50 ring-1 ring-primary/20" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Logo */}
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                      {profile.logoUrl ? (
                        <img src={profile.logoUrl} alt={profile.name} className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg truncate">{profile.name}</h3>
                        {profile.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                            <Star className="h-3 w-3" /> ค่าเริ่มต้น
                          </span>
                        )}
                      </div>
                      {profile.address && <p className="text-sm text-muted-foreground mt-0.5 truncate">{profile.address}</p>}
                      {profile.phone && <p className="text-sm text-muted-foreground">โทร: {profile.phone}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">สีหัวเอกสาร:</span>
                        <div
                          className="w-6 h-4 rounded border"
                          style={{ backgroundColor: profile.headerColor || "#1e3a5f" }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {!profile.isDefault && (
                        <Button variant="ghost" size="sm" onClick={() => handleSetDefault(profile.id)} title="ตั้งเป็นค่าเริ่มต้น">
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleLogoUpload(profile.id, e)}
                          ref={uploadingProfileId === profile.id ? fileInputRef : undefined}
                        />
                        <Button variant="ghost" size="sm" asChild disabled={uploadLogoMutation.isPending && uploadingProfileId === profile.id}>
                          <span>
                            {uploadLogoMutation.isPending && uploadingProfileId === profile.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </span>
                        </Button>
                      </label>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(profile)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(profile.id, profile.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>เพิ่มโปรไฟล์บริษัท</DialogTitle>
              <DialogDescription>ข้อมูลนี้จะแสดงในหัวเอกสาร PDF เมื่อเลือกโปรไฟล์นี้</DialogDescription>
            </DialogHeader>
            <ProfileForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>ยกเลิก</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                สร้างโปรไฟล์
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>แก้ไขโปรไฟล์บริษัท</DialogTitle>
              <DialogDescription>แก้ไขข้อมูลที่แสดงในหัวเอกสาร PDF</DialogDescription>
            </DialogHeader>
            <ProfileForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>ยกเลิก</Button>
              <Button onClick={handleEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function ProfileForm({ formData, setFormData }: { formData: ProfileFormData; setFormData: (d: ProfileFormData) => void }) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="profile-name">ชื่อบริษัท *</Label>
        <Input
          id="profile-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="เช่น บริษัท ทีซีเอส พาวเวอร์ พลัส จำกัด"
        />
      </div>
      <div>
        <Label htmlFor="profile-address">ที่อยู่</Label>
        <Textarea
          id="profile-address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="ที่อยู่บริษัทที่จะแสดงในหัวเอกสาร"
          rows={2}
        />
      </div>
      <div>
        <Label htmlFor="profile-phone">เบอร์โทร</Label>
        <Input
          id="profile-phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="เช่น 02-xxx-xxxx"
        />
      </div>
      <div>
        <Label className="flex items-center gap-2">
          <Palette className="h-4 w-4" /> สีหัวเอกสาร PDF
        </Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-md border-2 transition-all ${formData.headerColor === color ? "border-primary scale-110 ring-2 ring-primary/30" : "border-transparent hover:scale-105"}`}
              style={{ backgroundColor: color }}
              onClick={() => setFormData({ ...formData, headerColor: color })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Label htmlFor="custom-color" className="text-xs text-muted-foreground">หรือกำหนดเอง:</Label>
          <input
            id="custom-color"
            type="color"
            value={formData.headerColor}
            onChange={(e) => setFormData({ ...formData, headerColor: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border"
          />
          <span className="text-xs text-muted-foreground font-mono">{formData.headerColor}</span>
        </div>
      </div>
    </div>
  );
}
