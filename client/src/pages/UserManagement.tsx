import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, ShieldCheck, User, Mail, Clock } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "admin", label: "แอดมิน", color: "bg-amber-100 text-amber-800", icon: ShieldCheck },
  { value: "user", label: "ผู้ใช้ทั่วไป", color: "bg-blue-100 text-blue-800", icon: User },
] as const;

function getRoleLabel(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role)?.label || role;
}

function getRoleColor(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role)?.color || "bg-gray-100 text-gray-800";
}

export default function UserManagement() {
  const [filterRole, setFilterRole] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  const { data: usersList = [], isLoading } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setShowAddDialog(false);
      toast.success("เพิ่มผู้ใช้สำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setEditUser(null);
      toast.success("แก้ไขผู้ใช้สำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setDeleteConfirm(null);
      toast.success("ลบผู้ใช้สำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredUsers = filterRole === "all" ? usersList : usersList.filter((u: any) => u.role === filterRole);

  const adminCount = usersList.filter((u: any) => u.role === "admin").length;
  const userCount = usersList.filter((u: any) => u.role === "user").length;

  return (
    <DashboardLayout>
      <div className="container py-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">จัดการผู้ใช้งาน</h1>
            <p className="text-muted-foreground text-sm mt-1">เพิ่ม แก้ไข หรือลบบัญชีผู้ใช้และกำหนดสิทธิ์แอดมิน</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            เพิ่มผู้ใช้ใหม่
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole("all")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-slate-100 text-slate-800">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ผู้ใช้ทั้งหมด</p>
                  <p className="text-2xl font-bold">{usersList.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole(filterRole === "admin" ? "all" : "admin")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-amber-100 text-amber-800">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">แอดมิน</p>
                  <p className="text-2xl font-bold">{adminCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole(filterRole === "user" ? "all" : "user")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-blue-100 text-blue-800">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ผู้ใช้ทั่วไป</p>
                  <p className="text-2xl font-bold">{userCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button variant={filterRole === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterRole("all")}>
            ทั้งหมด ({usersList.length})
          </Button>
          {ROLE_OPTIONS.map(role => (
            <Button
              key={role.value}
              variant={filterRole === role.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterRole(role.value)}
            >
              {role.label} ({role.value === "admin" ? adminCount : userCount})
            </Button>
          ))}
        </div>

        {/* User List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">ยังไม่มีผู้ใช้</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4" />
                เพิ่มผู้ใช้คนแรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredUsers.map((user: any) => (
              <Card key={user.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`rounded-full p-2 shrink-0 ${getRoleColor(user.role)}`}>
                        {user.role === "admin" ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{user.name || "ไม่ระบุชื่อ"}</span>
                          <Badge variant="secondary" className={`text-xs ${getRoleColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          {user.loginMethod === "manual" && (
                            <Badge variant="outline" className="text-xs">สร้างด้วยมือ</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          {user.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </span>
                          )}
                          {user.lastSignedIn && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              เข้าใช้ล่าสุด: {new Date(user.lastSignedIn).toLocaleDateString("th-TH")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(user)}>
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
        <UserDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          title="เพิ่มผู้ใช้ใหม่"
        />

        {/* Edit Dialog */}
        {editUser && (
          <UserDialog
            open={!!editUser}
            onClose={() => setEditUser(null)}
            onSave={(data) => updateMutation.mutate({ id: editUser.id, ...data })}
            isLoading={updateMutation.isPending}
            title="แก้ไขผู้ใช้"
            defaultValues={editUser}
          />
        )}

        {/* Delete Confirm Dialog */}
        <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>ยืนยันการลบผู้ใช้</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              คุณต้องการลบผู้ใช้ <strong>{deleteConfirm?.name || "ไม่ระบุชื่อ"}</strong> ใช่หรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm.id })} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function UserDialog({ open, onClose, onSave, isLoading, title, defaultValues }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; email?: string; role: "user" | "admin" }) => void;
  isLoading: boolean;
  title: string;
  defaultValues?: { name?: string; email?: string; role?: string };
}) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [email, setEmail] = useState(defaultValues?.email || "");
  const [role, setRole] = useState(defaultValues?.role || "admin");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }
    onSave({
      name: name.trim(),
      email: email.trim() || undefined,
      role: role as "user" | "admin",
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
          <div>
            <Label>อีเมล</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1" type="email" />
          </div>
          <div>
            <Label>สิทธิ์การใช้งาน *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">แอดมิน (เข้าถึงทุกข้อมูล)</SelectItem>
                <SelectItem value="user">ผู้ใช้ทั่วไป (เห็นเฉพาะข้อมูลตัวเอง)</SelectItem>
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
