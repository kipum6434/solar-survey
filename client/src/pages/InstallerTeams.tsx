import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wrench, Phone, StickyNote, Palette } from "lucide-react";

// Preset colors for teams — distinct, easy to distinguish
const TEAM_COLORS = [
  { value: "#3B82F6", label: "น้ำเงิน" },
  { value: "#EF4444", label: "แดง" },
  { value: "#10B981", label: "เขียว" },
  { value: "#F59E0B", label: "เหลือง" },
  { value: "#8B5CF6", label: "ม่วง" },
  { value: "#EC4899", label: "ชมพู" },
  { value: "#06B6D4", label: "ฟ้า" },
  { value: "#F97316", label: "ส้ม" },
  { value: "#14B8A6", label: "เขียวอมฟ้า" },
  { value: "#6366F1", label: "คราม" },
  { value: "#84CC16", label: "เขียวอ่อน" },
  { value: "#D946EF", label: "ม่วงอมชมพู" },
  { value: "#0EA5E9", label: "ฟ้าสด" },
  { value: "#A855F7", label: "ม่วงสด" },
  { value: "#78716C", label: "เทา" },
  { value: "#DC2626", label: "แดงเข้ม" },
];

function getTeamColorStyle(color: string | null | undefined) {
  if (!color) return { bg: "bg-purple-50", text: "text-purple-700", dot: "#a855f7" };
  return {
    bg: "",
    text: "",
    dot: color,
    style: { backgroundColor: color + "18", color: color },
  };
}

export default function InstallerTeams() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editTeam, setEditTeam] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: teams = [], isLoading } = trpc.installerTeam.list.useQuery({ onlyActive: !showInactive });
  const utils = trpc.useUtils();

  const createMutation = trpc.installerTeam.create.useMutation({
    onSuccess: () => {
      utils.installerTeam.list.invalidate();
      utils.installerTeam.listActive.invalidate();
      setShowAddDialog(false);
      toast.success("เพิ่มทีมช่างสำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.installerTeam.update.useMutation({
    onSuccess: () => {
      utils.installerTeam.list.invalidate();
      utils.installerTeam.listActive.invalidate();
      setEditTeam(null);
      toast.success("แก้ไขทีมช่างสำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.installerTeam.delete.useMutation({
    onSuccess: () => {
      utils.installerTeam.list.invalidate();
      utils.installerTeam.listActive.invalidate();
      setDeleteConfirm(null);
      toast.success("ลบทีมช่างสำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleToggleActive = useCallback((team: any) => {
    updateMutation.mutate({ id: team.id, isActive: !team.isActive });
  }, [updateMutation]);

  const activeCount = teams.filter((t: any) => t.isActive).length;
  const inactiveCount = teams.filter((t: any) => !t.isActive).length;

  return (
    <DashboardLayout>
      <div className="container py-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">จัดการทีมช่างติดตั้ง</h1>
            <p className="text-muted-foreground text-sm mt-1">เพิ่ม แก้ไข หรือลบทีมช่างสำหรับมอบหมายงานติดตั้ง</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            เพิ่มทีมช่าง
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-blue-100 text-blue-800">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ทั้งหมด</p>
                  <p className="text-2xl font-bold">{teams.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-green-100 text-green-800">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ใช้งานอยู่</p>
                  <p className="text-2xl font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {showInactive && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2 bg-gray-100 text-gray-600">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ปิดใช้งาน</p>
                    <p className="text-2xl font-bold">{inactiveCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            แสดงทีมที่ปิดใช้งาน
          </label>
        </div>

        {/* Team List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">ยังไม่มีทีมช่าง</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4" />
                เพิ่มทีมช่างทีมแรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {teams.map((team: any) => {
              const cs = getTeamColorStyle(team.color);
              return (
                <Card key={team.id} className={`hover:shadow-sm transition-shadow ${!team.isActive ? "opacity-60" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Color dot */}
                        <div
                          className={`rounded-full p-2 shrink-0 flex items-center justify-center ${!team.color ? (team.isActive ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500") : ""}`}
                          style={team.color ? { backgroundColor: team.color + "20" } : undefined}
                        >
                          <Wrench className="h-4 w-4" style={team.color ? { color: team.color } : undefined} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{team.name}</span>
                            {team.color && (
                              <span
                                className="inline-block w-4 h-4 rounded-full border border-gray-200 shrink-0"
                                style={{ backgroundColor: team.color }}
                                title={`สี: ${team.color}`}
                              />
                            )}
                            {team.isActive ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">ใช้งาน</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">ปิดใช้งาน</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            {team.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {team.phone}
                              </span>
                            )}
                            {team.note && (
                              <span className="flex items-center gap-1">
                                <StickyNote className="h-3 w-3" />
                                {team.note}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(team)} title={team.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                          <Switch checked={team.isActive} className="pointer-events-none" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditTeam(team)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(team.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add Dialog */}
        <InstallerTeamDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          title="เพิ่มทีมช่างใหม่"
        />

        {/* Edit Dialog */}
        {editTeam && (
          <InstallerTeamDialog
            open={!!editTeam}
            onClose={() => setEditTeam(null)}
            onSave={(data) => updateMutation.mutate({ id: editTeam.id, ...data })}
            isLoading={updateMutation.isPending}
            title="แก้ไขทีมช่าง"
            defaultValues={editTeam}
          />
        )}

        {/* Delete Confirm */}
        <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>ยืนยันการลบ</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">คุณต้องการลบทีมช่างนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function InstallerTeamDialog({ open, onClose, onSave, isLoading, title, defaultValues }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; phone?: string; note?: string; color?: string }) => void;
  isLoading: boolean;
  title: string;
  defaultValues?: { name: string; phone?: string; note?: string; color?: string | null };
}) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [phone, setPhone] = useState(defaultValues?.phone || "");
  const [note, setNote] = useState(defaultValues?.note || "");
  const [color, setColor] = useState(defaultValues?.color || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อทีมช่าง");
      return;
    }
    onSave({
      name: name.trim(),
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      color: color || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ชื่อทีมช่าง *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ทีมช่าง A, ทีมช่างสมชาย" className="mt-1" />
          </div>
          <div>
            <Label>เบอร์โทร</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xx-xxx-xxxx" className="mt-1" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              <Palette className="h-4 w-4" />
              สีประจำทีม
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">เลือกสีเพื่อแยกแยะทีมช่างในตารางงานติดตั้ง</p>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                    color === c.value ? "border-gray-900 ring-2 ring-offset-2 ring-gray-400 scale-110" : "border-gray-200"
                  }`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(color === c.value ? "" : c.value)}
                  title={c.label}
                />
              ))}
            </div>
            {color && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm text-muted-foreground">
                  {TEAM_COLORS.find(c => c.value === color)?.label || color}
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setColor("")}>
                  ล้าง
                </Button>
              </div>
            )}
          </div>
          <div>
            <Label>หมายเหตุ</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className="mt-1" rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
