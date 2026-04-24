import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, GripVertical, Tags, Camera, FileText, Wrench } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const PRESET_COLORS = [
  { color: "#78716c", bg: "#f5f5f4", name: "เทา" },
  { color: "#1d4ed8", bg: "#eff6ff", name: "น้ำเงิน" },
  { color: "#d97706", bg: "#fffbeb", name: "เหลือง" },
  { color: "#047857", bg: "#ecfdf5", name: "เขียวเข้ม" },
  { color: "#15803d", bg: "#dcfce7", name: "เขียว" },
  { color: "#7c3aed", bg: "#f5f3ff", name: "ม่วง" },
  { color: "#ea580c", bg: "#fff7ed", name: "ส้ม" },
  { color: "#dc2626", bg: "#fef2f2", name: "แดง" },
  { color: "#0891b2", bg: "#ecfeff", name: "ฟ้า" },
  { color: "#be185d", bg: "#fdf2f8", name: "ชมพู" },
];

export default function StatusManagement() {
  const [activeTab, setActiveTab] = useState<"customer" | "survey" | "photoCategory" | "docCategory" | "installPhotoCategory">("customer");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Tags className="h-6 w-6" /> จัดการสถานะ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">เพิ่ม แก้ไข ลบสถานะสำหรับลูกค้าและงานสำรวจ</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="customer">สถานะลูกค้า</TabsTrigger>
            <TabsTrigger value="survey">สถานะงานสำรวจ</TabsTrigger>
            <TabsTrigger value="photoCategory" className="gap-1"><Camera className="h-3.5 w-3.5" /> หมวดหมู่รูปสำรวจ</TabsTrigger>
            <TabsTrigger value="docCategory" className="gap-1"><FileText className="h-3.5 w-3.5" /> หมวดหมู่เอกสาร</TabsTrigger>
            <TabsTrigger value="installPhotoCategory" className="gap-1"><Wrench className="h-3.5 w-3.5" /> หมวดหมู่รูปติดตั้ง</TabsTrigger>
          </TabsList>
          <TabsContent value="customer">
            <StatusList type="customer" />
          </TabsContent>
          <TabsContent value="survey">
            <StatusList type="survey" />
          </TabsContent>
          <TabsContent value="photoCategory">
            <CategoryList categoryType="photo" />
          </TabsContent>
          <TabsContent value="docCategory">
            <CategoryList categoryType="document" />
          </TabsContent>
          <TabsContent value="installPhotoCategory">
            <CategoryList categoryType="installationPhoto" />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StatusList({ type }: { type: "customer" | "survey" }) {
  const { data: statuses, isLoading, refetch } = trpc.customStatus.list.useQuery({ type });
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = trpc.customStatus.create.useMutation({
    onSuccess: () => { toast.success("เพิ่มสถานะสำเร็จ"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.customStatus.update.useMutation({
    onSuccess: () => { toast.success("แก้ไขสถานะสำเร็จ"); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customStatus.delete.useMutation({
    onSuccess: () => { toast.success("ลบสถานะสำเร็จ"); setDeleteId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {type === "customer" ? "สถานะที่ใช้ในหน้าลูกค้า" : "สถานะที่ใช้ในหน้างานสำรวจ"}
          {statuses && ` (${statuses.length} รายการ)`}
        </p>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> เพิ่มสถานะ
        </Button>
      </div>

      {statuses && statuses.length > 0 ? (
        <div className="space-y-2">
          {statuses.map((s: any) => (
            <Card key={s.id} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                    style={{ color: s.color, backgroundColor: s.bgColor, borderColor: s.color + "30" }}
                  >
                    {s.label}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    ลำดับ: {s.sortOrder}
                  </span>
                  {s.isDefault && (
                    <Badge variant="secondary" className="text-[10px]">ค่าเริ่มต้น</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Tags className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีสถานะ</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> เพิ่มสถานะแรก
          </Button>
        </div>
      )}

      {/* Add Dialog */}
      <StatusFormDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onSubmit={(data) => createMutation.mutate({ ...data, type, sortOrder: (statuses?.length || 0) + 1 })}
        loading={createMutation.isPending}
        title="เพิ่มสถานะใหม่"
      />

      {/* Edit Dialog */}
      {editItem && (
        <StatusFormDialog
          open={!!editItem}
          onOpenChange={(v) => !v && setEditItem(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editItem.id, ...data })}
          loading={updateMutation.isPending}
          title="แก้ไขสถานะ"
          defaultValues={editItem}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบสถานะ</AlertDialogTitle>
            <AlertDialogDescription>
              ลูกค้าหรืองานสำรวจที่ใช้สถานะนี้อยู่จะถูกเปลี่ยนเป็นไม่มีสถานะ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusFormDialog({ open, onOpenChange, onSubmit, loading, title, defaultValues }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: { label: string; color: string; bgColor: string }) => void;
  loading: boolean;
  title: string;
  defaultValues?: { label: string; color: string; bgColor: string };
}) {
  const [label, setLabel] = useState(defaultValues?.label || "");
  const [selectedColor, setSelectedColor] = useState(
    defaultValues ? PRESET_COLORS.findIndex(c => c.color === defaultValues.color) : 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { toast.error("กรุณาระบุชื่อสถานะ"); return; }
    const preset = PRESET_COLORS[selectedColor] || PRESET_COLORS[0];
    onSubmit({ label: label.trim(), color: preset.color, bgColor: preset.bg });
  };

  const currentPreset = PRESET_COLORS[selectedColor] || PRESET_COLORS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>กำหนดชื่อและสีของสถานะ</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ชื่อสถานะ *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="เช่น รอดำเนินการ, ปิดการขาย"
              autoFocus
            />
          </div>
          <div>
            <Label>สี</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {PRESET_COLORS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                    selectedColor === i ? "border-primary shadow-sm" : "border-transparent hover:border-muted"
                  }`}
                  onClick={() => setSelectedColor(i)}
                >
                  <span
                    className="w-6 h-6 rounded-full border"
                    style={{ backgroundColor: preset.bg, borderColor: preset.color + "40" }}
                  >
                    <span className="block w-3 h-3 rounded-full mx-auto mt-1.5" style={{ backgroundColor: preset.color }} />
                  </span>
                  <span className="text-[10px] text-muted-foreground">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>ตัวอย่าง</Label>
            <div className="mt-2 p-3 bg-muted/30 rounded-lg">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border"
                style={{ color: currentPreset.color, backgroundColor: currentPreset.bg, borderColor: currentPreset.color + "30" }}
              >
                {label || "ตัวอย่างสถานะ"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryList({ categoryType }: { categoryType: "photo" | "document" | "installationPhoto" }) {
  const trpcUtils = trpc.useUtils();
  const labels: Record<string, { title: string; desc: string }> = {
    photo: { title: "หมวดหมู่รูปสำรวจ", desc: "จัดการหมวดหมู่สำหรับรูปภาพหน้างานสำรวจ" },
    document: { title: "หมวดหมู่เอกสาร", desc: "จัดการหมวดหมู่สำหรับเอกสารงานสำรวจ" },
    installationPhoto: { title: "หมวดหมู่รูปติดตั้ง", desc: "จัดการหมวดหมู่สำหรับรูปภาพงานติดตั้ง (เพิ่ม/ลบได้)" },
  };

  // Select the correct tRPC procedures based on categoryType
  const listQuery = categoryType === "photo"
    ? trpc.photoCategory.list.useQuery()
    : categoryType === "document"
    ? trpc.documentCategory.list.useQuery()
    : trpc.installationPhotoCategory.list.useQuery();

  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const createMutation = categoryType === "photo"
    ? trpc.photoCategory.create.useMutation({ onSuccess: () => { toast.success("เพิ่มหมวดหมู่สำเร็จ"); setShowAdd(false); setNewLabel(""); setNewKey(""); trpcUtils.photoCategory.list.invalidate(); } })
    : categoryType === "document"
    ? trpc.documentCategory.create.useMutation({ onSuccess: () => { toast.success("เพิ่มหมวดหมู่สำเร็จ"); setShowAdd(false); setNewLabel(""); setNewKey(""); trpcUtils.documentCategory.list.invalidate(); } })
    : trpc.installationPhotoCategory.create.useMutation({ onSuccess: () => { toast.success("เพิ่มหมวดหมู่สำเร็จ"); setShowAdd(false); setNewLabel(""); setNewKey(""); trpcUtils.installationPhotoCategory.list.invalidate(); } });

  const updateMutation = categoryType === "photo"
    ? trpc.photoCategory.update.useMutation({ onSuccess: () => { toast.success("แก้ไขหมวดหมู่สำเร็จ"); setEditItem(null); trpcUtils.photoCategory.list.invalidate(); } })
    : categoryType === "document"
    ? trpc.documentCategory.update.useMutation({ onSuccess: () => { toast.success("แก้ไขหมวดหมู่สำเร็จ"); setEditItem(null); trpcUtils.documentCategory.list.invalidate(); } })
    : trpc.installationPhotoCategory.update.useMutation({ onSuccess: () => { toast.success("แก้ไขหมวดหมู่สำเร็จ"); setEditItem(null); trpcUtils.installationPhotoCategory.list.invalidate(); } });

  const deleteMutation = categoryType === "photo"
    ? trpc.photoCategory.delete.useMutation({ onSuccess: () => { toast.success("ลบหมวดหมู่สำเร็จ"); setDeleteId(null); trpcUtils.photoCategory.list.invalidate(); } })
    : categoryType === "document"
    ? trpc.documentCategory.delete.useMutation({ onSuccess: () => { toast.success("ลบหมวดหมู่สำเร็จ"); setDeleteId(null); trpcUtils.documentCategory.list.invalidate(); } })
    : trpc.installationPhotoCategory.delete.useMutation({ onSuccess: () => { toast.success("ลบหมวดหมู่สำเร็จ"); setDeleteId(null); trpcUtils.installationPhotoCategory.list.invalidate(); } });

  const { data: categories, isLoading } = listQuery;
  const info = labels[categoryType];

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const handleCreate = () => {
    if (!newLabel.trim()) { toast.error("กรุณาระบุชื่อหมวดหมู่"); return; }
    const key = newKey.trim() || newLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_ก-๙]/g, "");
    if (!key) { toast.error("กรุณาระบุ key"); return; }
    createMutation.mutate({ key, label: newLabel.trim(), sortOrder: (categories?.length || 0) + 1 });
  };

  const handleUpdate = () => {
    if (!editItem || !editLabel.trim()) { toast.error("กรุณาระบุชื่อหมวดหมู่"); return; }
    updateMutation.mutate({ id: editItem.id, label: editLabel.trim() });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium">{info.title}</p>
          <p className="text-xs text-muted-foreground">{info.desc} ({categories?.length || 0} รายการ)</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> เพิ่มหมวดหมู่
        </Button>
      </div>

      {categories && categories.length > 0 ? (
        <div className="space-y-2">
          {categories.map((cat: any) => (
            <Card key={cat.id} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <Badge variant="secondary" className="text-xs">{cat.label}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{cat.key}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">ลำดับ: {cat.sortOrder}</span>
                  {cat.isDefault && (
                    <Badge variant="outline" className="text-[10px]">ค่าเริ่มต้น</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditItem(cat); setEditLabel(cat.label); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!cat.isDefault && cat.key !== "other" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(cat.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Tags className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีหมวดหมู่</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> เพิ่มหมวดหมู่แรก
          </Button>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มหมวดหมู่ใหม่</DialogTitle>
            <DialogDescription>กำหนดชื่อและ key สำหรับหมวดหมู่</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อหมวดหมู่ *</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="เช่น อินเวอร์เตอร์, แผงโซลาร์" autoFocus />
            </div>
            <div>
              <Label>Key (ภาษาอังกฤษ, ไม่มีเว้นวรรค)</Label>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="เช่น inverter, solar_panel" />
              <p className="text-xs text-muted-foreground mt-1">หากไม่ระบุจะสร้างจากชื่อหมวดหมู่อัตโนมัติ</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขหมวดหมู่</DialogTitle>
            <DialogDescription>แก้ไขชื่อหมวดหมู่ (key ไม่สามารถเปลี่ยนได้)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Key</Label>
              <Input value={editItem?.key || ""} disabled className="bg-muted" />
            </div>
            <div>
              <Label>ชื่อหมวดหมู่ *</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>ยกเลิก</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบหมวดหมู่</AlertDialogTitle>
            <AlertDialogDescription>
              รูปภาพ/เอกสารที่ใช้หมวดหมู่นี้อยู่จะถูกเปลี่ยนเป็น "อื่นๆ"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
