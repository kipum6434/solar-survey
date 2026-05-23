import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, GripVertical, Pencil, Trash2, Settings2 } from "lucide-react";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "ข้อความ",
  number: "ตัวเลข",
  select: "ตัวเลือก",
  textarea: "ข้อความยาว",
};

export default function TechnicalFieldSettings() {
  const { data: fields, isLoading, refetch } = trpc.technicalField.list.useQuery();
  const createMutation = trpc.technicalField.create.useMutation({ onSuccess: () => { refetch(); toast.success("เพิ่มฟิลด์สำเร็จ"); } });
  const updateMutation = trpc.technicalField.update.useMutation({ onSuccess: () => { refetch(); toast.success("อัปเดตสำเร็จ"); } });
  const deleteMutation = trpc.technicalField.delete.useMutation({ onSuccess: () => { refetch(); toast.success("ลบสำเร็จ"); } });
  const reorderMutation = trpc.technicalField.reorder.useMutation({ onSuccess: () => refetch() });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editField, setEditField] = useState<any>(null);
  const [form, setForm] = useState({ label: "", fieldType: "text", placeholder: "", options: "" });

  const handleAdd = () => {
    setForm({ label: "", fieldType: "text", placeholder: "", options: "" });
    setShowAddDialog(true);
  };

  const handleEdit = (field: any) => {
    setForm({
      label: field.label,
      fieldType: field.fieldType,
      placeholder: field.placeholder || "",
      options: field.options || "",
    });
    setEditField(field);
  };

  const handleSave = () => {
    if (!form.label.trim()) { toast.error("กรุณากรอกชื่อฟิลด์"); return; }
    if (editField) {
      updateMutation.mutate({
        id: editField.id,
        label: form.label,
        fieldType: form.fieldType as any,
        placeholder: form.placeholder || undefined,
        options: form.fieldType === "select" ? form.options : undefined,
      });
      setEditField(null);
    } else {
      createMutation.mutate({
        label: form.label,
        fieldType: form.fieldType as any,
        placeholder: form.placeholder || undefined,
        options: form.fieldType === "select" ? form.options : undefined,
      });
      setShowAddDialog(false);
    }
  };

  const handleDelete = (field: any) => {
    if (field.isBuiltIn) { toast.error("ไม่สามารถลบฟิลด์พื้นฐานได้"); return; }
    if (confirm(`ต้องการลบฟิลด์ "${field.label}" หรือไม่?`)) {
      deleteMutation.mutate({ id: field.id });
    }
  };

  const handleToggleActive = (field: any) => {
    updateMutation.mutate({ id: field.id, isActive: !field.isActive });
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (!fields) return;
    const newFields = [...fields];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newFields.length) return;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    reorderMutation.mutate({ orderedIds: newFields.map(f => f.id) });
  };

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">ตั้งค่าฟิลด์ข้อมูลทางเทคนิค</h1>
              <p className="text-sm text-muted-foreground">เพิ่ม/ลบ/แก้ไข หัวข้อในส่วน "ข้อมูลทางเทคนิค" ของงานสำรวจ</p>
            </div>
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" /> เพิ่มฟิลด์ใหม่
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
        ) : (
          <div className="space-y-2">
            {fields?.map((field, index) => (
              <Card key={field.id} className={`transition-opacity ${!field.isActive ? "opacity-50" : ""}`}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveField(index, "up")} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <GripVertical className="h-4 w-4 rotate-90" />
                    </button>
                    <button onClick={() => moveField(index, "down")} disabled={index === (fields?.length || 0) - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <GripVertical className="h-4 w-4 -rotate-90" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.label}</span>
                      <Badge variant="secondary" className="text-xs">{FIELD_TYPE_LABELS[field.fieldType] || field.fieldType}</Badge>
                      {field.isBuiltIn && <Badge variant="outline" className="text-xs">พื้นฐาน</Badge>}
                    </div>
                    {field.placeholder && <p className="text-xs text-muted-foreground mt-0.5">Placeholder: {field.placeholder}</p>}
                    {field.fieldType === "select" && field.options && (
                      <p className="text-xs text-muted-foreground mt-0.5">ตัวเลือก: {JSON.parse(field.options).join(", ")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">เปิดใช้</Label>
                      <Switch checked={field.isActive} onCheckedChange={() => handleToggleActive(field)} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(field)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!field.isBuiltIn && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(field)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!fields || fields.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">ยังไม่มีฟิลด์ กดปุ่ม "เพิ่มฟิลด์ใหม่" เพื่อเริ่มต้น</div>
            )}
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>เพิ่มฟิลด์ใหม่</DialogTitle></DialogHeader>
            <FieldForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>ยกเลิก</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending}>
                {createMutation.isPending ? "กำลังบันทึก..." : "เพิ่ม"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editField} onOpenChange={(open) => { if (!open) setEditField(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>แก้ไขฟิลด์</DialogTitle></DialogHeader>
            <FieldForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditField(null)}>ยกเลิก</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function FieldForm({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>ชื่อฟิลด์ *</Label>
        <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="เช่น ขนาดสายไฟ" />
      </div>
      <div>
        <Label>ประเภท</Label>
        <Select value={form.fieldType} onValueChange={(v) => setForm({ ...form, fieldType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">ข้อความ</SelectItem>
            <SelectItem value="number">ตัวเลข</SelectItem>
            <SelectItem value="select">ตัวเลือก (Dropdown)</SelectItem>
            <SelectItem value="textarea">ข้อความยาว</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Placeholder (ข้อความตัวอย่าง)</Label>
        <Input value={form.placeholder} onChange={(e) => setForm({ ...form, placeholder: e.target.value })} placeholder="เช่น กรอกขนาดสายไฟ..." />
      </div>
      {form.fieldType === "select" && (
        <div>
          <Label>ตัวเลือก (คั่นด้วยเครื่องหมาย ,)</Label>
          <Input
            value={form.options ? (form.options.startsWith("[") ? JSON.parse(form.options).join(", ") : form.options) : ""}
            onChange={(e) => {
              const items = e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean);
              setForm({ ...form, options: JSON.stringify(items) });
            }}
            placeholder="เช่น ตัวเลือก 1, ตัวเลือก 2, ตัวเลือก 3"
          />
        </div>
      )}
    </div>
  );
}
