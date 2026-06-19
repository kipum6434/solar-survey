import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stamp, Save, Loader2, CheckCircle2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function DocumentSettings() {
  const { data: settings, isLoading, refetch } = trpc.documentSettings.list.useQuery();
  const upsertMutation = trpc.documentSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตเลขทะเบียนเอกสารเรียบร้อย");
      refetch();
      setEditingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ documentNumber: "", label: "", description: "" });

  const startEdit = (setting: { id: number; label: string; documentNumber: string; description?: string | null }) => {
    setEditingId(setting.id);
    setEditForm({
      documentNumber: setting.documentNumber,
      label: setting.label,
      description: setting.description || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ documentNumber: "", label: "", description: "" });
  };

  const saveEdit = (settingKey: string) => {
    if (!editForm.documentNumber.trim()) {
      toast.error("กรุณากรอกเลขทะเบียนเอกสาร");
      return;
    }
    upsertMutation.mutate({
      settingKey,
      label: editForm.label,
      documentNumber: editForm.documentNumber.trim(),
      description: editForm.description || undefined,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Stamp className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">เลขทะเบียนเอกสาร</h1>
          <p className="text-sm text-gray-500">ตั้งค่าเลขทะเบียนเอกสาร ISO ที่แสดงใน PDF</p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <p className="text-sm text-blue-700">
            เลขทะเบียนเอกสารจะแสดงที่มุมขวาบนของทุกหน้าใน PDF ที่ Export ออกมา 
            สามารถแก้ไขได้เมื่อมีการเปลี่ยน REV หรือเลขทะเบียนใหม่
          </p>
        </CardContent>
      </Card>

      {/* Settings List */}
      <div className="space-y-4">
        {settings && settings.length > 0 ? (
          settings.map((setting) => (
            <Card key={setting.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{setting.label}</CardTitle>
                    {setting.description && (
                      <CardDescription className="mt-1">{setting.description}</CardDescription>
                    )}
                  </div>
                  {editingId !== setting.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(setting)}
                      className="text-gray-500 hover:text-amber-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {editingId === setting.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">ชื่อเอกสาร</label>
                      <Input
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        placeholder="เช่น เลขทะเบียนเอกสารสำรวจ"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">เลขทะเบียนเอกสาร</label>
                      <Input
                        value={editForm.documentNumber}
                        onChange={(e) => setEditForm({ ...editForm, documentNumber: e.target.value })}
                        placeholder="เช่น FM-SA-01-04 REV.00"
                        className="font-mono text-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">คำอธิบาย (ไม่บังคับ)</label>
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="คำอธิบายเพิ่มเติม"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(setting.settingKey)}
                        disabled={upsertMutation.isPending}
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        {upsertMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        บันทึก
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-mono text-lg font-semibold text-gray-800">
                      {setting.documentNumber}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <Stamp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>ยังไม่มีเลขทะเบียนเอกสาร</p>
              <p className="text-xs mt-1">กรุณาติดต่อผู้ดูแลระบบ</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
