import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, CheckSquare, Pencil, Save, X, Loader2, Star,
} from "lucide-react";

export default function ChecklistTemplates() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const { data: templates, isLoading, refetch } = trpc.checklistTemplate.listAll.useQuery(undefined, {
    enabled: isAdmin,
  });

  const createMut = trpc.checklistTemplate.create.useMutation({
    onSuccess: () => { toast.success("เพิ่มเทมเพลตสำเร็จ"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMut = trpc.checklistTemplate.update.useMutation({
    onSuccess: () => { toast.success("อัพเดทสำเร็จ"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.checklistTemplate.delete.useMutation({
    onSuccess: () => { toast.success("ลบสำเร็จ"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [newName, setNewName] = useState("");
  const [newItems, setNewItems] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editItems, setEditItems] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    // Parse items from newline-separated text
    const itemsList = newItems.split("\n").map(s => s.trim()).filter(Boolean);
    createMut.mutate({ name: newName.trim(), items: JSON.stringify(itemsList) });
    setNewName("");
    setNewItems("");
  };

  const handleStartEdit = (template: any) => {
    setEditingId(template.id);
    setEditName(template.name);
    try {
      const items = JSON.parse(template.items || "[]");
      setEditItems(Array.isArray(items) ? items.join("\n") : "");
    } catch {
      setEditItems("");
    }
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      const itemsList = editItems.split("\n").map(s => s.trim()).filter(Boolean);
      updateMut.mutate({ id: editingId, name: editName.trim(), items: JSON.stringify(itemsList) });
      setEditingId(null);
    }
  };

  const handleSetDefault = (id: number) => {
    updateMut.mutate({ id, isDefault: true });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMut.mutate({ id: deleteId });
      setDeleteId(null);
    }
  };

  const parseItems = (itemsStr: string): string[] => {
    try {
      const parsed = JSON.parse(itemsStr || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const content = (
    <div className="container max-w-3xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary" />
          จัดการ Checklist ส่งมอบงาน
        </h1>
        <p className="text-muted-foreground mt-1">
          เพิ่ม/ลบ/แก้ไข เทมเพลต Checklist ที่ใช้ในแบบฟอร์มส่งมอบงาน
        </p>
      </div>

      {/* Add new template */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">เพิ่มเทมเพลตใหม่</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="ชื่อเทมเพลต เช่น Checklist ส่งมอบงานมาตรฐาน"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Textarea
            placeholder={"รายการ Checklist (บรรทัดละ 1 รายการ)\nเช่น:\nตรวจสอบแผงโซลาร์\nตรวจสอบอินเวอร์เตอร์\nตรวจสอบสายไฟ"}
            value={newItems}
            onChange={(e) => setNewItems(e.target.value)}
            rows={5}
          />
          <Button onClick={handleAdd} disabled={!newName.trim() || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">เพิ่มเทมเพลต</span>
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>เทมเพลต Checklist ({templates?.length ?? 0})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              กำลังโหลด...
            </div>
          ) : !templates?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              ยังไม่มีเทมเพลต Checklist — เพิ่มเทมเพลตแรกด้านบน
            </div>
          ) : (
            <div className="divide-y">
              {templates.map((item: any, idx: number) => {
                const items = parseItems(item.items);

                if (editingId === item.id) {
                  return (
                    <div key={item.id} className="px-4 py-3 space-y-2 bg-muted/30">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                        placeholder="ชื่อเทมเพลต"
                        autoFocus
                      />
                      <Textarea
                        value={editItems}
                        onChange={(e) => setEditItems(e.target.value)}
                        rows={5}
                        placeholder="รายการ Checklist (บรรทัดละ 1 รายการ)"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={updateMut.isPending}>
                          <Save className="h-3.5 w-3.5 mr-1" /> บันทึก
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5 mr-1" /> ยกเลิก
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-muted-foreground w-6 text-center">{idx + 1}</span>
                      <span className="flex-1 text-sm font-medium">{item.name}</span>
                      {item.isDefault && (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px] gap-1">
                          <Star className="h-2.5 w-2.5" /> ค่าเริ่มต้น
                        </Badge>
                      )}
                      {!item.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleSetDefault(item.id)}
                        >
                          ตั้งเป็นค่าเริ่มต้น
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleStartEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {items.length > 0 && (
                      <div className="ml-9 mt-1">
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {items.slice(0, 5).map((itm: string, i: number) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <CheckSquare className="h-3 w-3 text-muted-foreground/50" />
                              {itm}
                            </li>
                          ))}
                          {items.length > 5 && (
                            <li className="text-muted-foreground/50">
                              ... อีก {items.length - 5} รายการ
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบเทมเพลต Checklist นี้หรือไม่? การลบจะไม่กระทบกับแบบฟอร์มที่สร้างไปแล้ว
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return <DashboardLayout>{content}</DashboardLayout>;
}
