import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users2, UserCheck, Phone, Mail } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "admin_sender", label: "แอดมินผู้ส่งงาน", color: "bg-amber-100 text-amber-800" },
  { value: "surveyor", label: "ทีมสำรวจ", color: "bg-blue-100 text-blue-800" },
  { value: "closer", label: "ผู้ปิดการขาย", color: "bg-green-100 text-green-800" },
] as const;

function getRoleLabel(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role)?.label || role;
}

function getRoleColor(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role)?.color || "bg-gray-100 text-gray-800";
}

export default function TeamManagement() {
  const [filterRole, setFilterRole] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: members = [], isLoading } = trpc.teamMember.listAll.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.teamMember.create.useMutation({
    onSuccess: () => {
      utils.teamMember.listAll.invalidate();
      utils.teamMember.list.invalidate();
      setShowAddDialog(false);
      toast.success("เพิ่มสมาชิกทีมสำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.teamMember.update.useMutation({
    onSuccess: () => {
      utils.teamMember.listAll.invalidate();
      utils.teamMember.list.invalidate();
      setEditMember(null);
      toast.success("แก้ไขสมาชิกทีมสำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.teamMember.delete.useMutation({
    onSuccess: () => {
      utils.teamMember.listAll.invalidate();
      utils.teamMember.list.invalidate();
      setDeleteConfirm(null);
      toast.success("ลบสมาชิกทีมสำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredMembers = filterRole === "all" ? members : members.filter((m: any) => m.role === filterRole);

  const groupedByRole = ROLE_OPTIONS.map(role => ({
    ...role,
    members: members.filter((m: any) => m.role === role.value),
  }));

  return (
    <DashboardLayout>
      <div className="container py-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">จัดการทีมงาน</h1>
            <p className="text-muted-foreground text-sm mt-1">เพิ่ม แก้ไข หรือลบสมาชิกทีมสำหรับมอบหมายงานสำรวจ</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            เพิ่มสมาชิกทีม
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {groupedByRole.map(group => (
            <Card key={group.value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole(filterRole === group.value ? "all" : group.value)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${group.color}`}>
                    <Users2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{group.label}</p>
                    <p className="text-2xl font-bold">{group.members.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button variant={filterRole === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterRole("all")}>
            ทั้งหมด ({members.length})
          </Button>
          {ROLE_OPTIONS.map(role => (
            <Button
              key={role.value}
              variant={filterRole === role.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRole(role.value)}
            >
              {role.label}
            </Button>
          ))}
        </div>

        {/* Member List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
        ) : filteredMembers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">ยังไม่มีสมาชิกทีม</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4" />
                เพิ่มสมาชิกคนแรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredMembers.map((member: any) => (
              <Card key={member.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`rounded-full p-2 shrink-0 ${getRoleColor(member.role)}`}>
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{member.name}</span>
                          <Badge variant="secondary" className={`text-xs ${getRoleColor(member.role)}`}>
                            {getRoleLabel(member.role)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          {member.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </span>
                          )}
                          {member.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {member.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditMember(member)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(member.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Dialog */}
        <TeamMemberDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          title="เพิ่มสมาชิกทีมใหม่"
        />

        {/* Edit Dialog */}
        {editMember && (
          <TeamMemberDialog
            open={!!editMember}
            onClose={() => setEditMember(null)}
            onSave={(data) => updateMutation.mutate({ id: editMember.id, ...data })}
            isLoading={updateMutation.isPending}
            title="แก้ไขสมาชิกทีม"
            defaultValues={editMember}
          />
        )}

        {/* Delete Confirm Dialog */}
        <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>ยืนยันการลบ</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">คุณต้องการลบสมาชิกทีมคนนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
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

function TeamMemberDialog({ open, onClose, onSave, isLoading, title, defaultValues }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; phone?: string; email?: string; role: "admin_sender" | "surveyor" | "closer" }) => void;
  isLoading: boolean;
  title: string;
  defaultValues?: { name: string; phone?: string; email?: string; role: string };
}) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [phone, setPhone] = useState(defaultValues?.phone || "");
  const [email, setEmail] = useState(defaultValues?.email || "");
  const [role, setRole] = useState(defaultValues?.role || "surveyor");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }
    onSave({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      role: role as "admin_sender" | "surveyor" | "closer",
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
            <Label>ชื่อ-นามสกุล *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>เบอร์โทร</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0xx-xxx-xxxx" className="mt-1" />
            </div>
            <div>
              <Label>อีเมล</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>ตำแหน่ง/บทบาท *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
