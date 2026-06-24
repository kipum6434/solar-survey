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
import { Plus, Pencil, Trash2, Shield, ShieldCheck, User, Mail, Clock, KeyRound, AtSign, ShieldAlert, Package } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";

const ROLE_OPTIONS = [
  { value: "admin", label: "แอดมิน", color: "bg-amber-100 text-amber-800", icon: ShieldCheck },
  { value: "user", label: "ผู้ใช้ทั่วไป", color: "bg-blue-100 text-blue-800", icon: User },
  { value: "warehouse", label: "คลังสินค้า", color: "bg-teal-100 text-teal-800", icon: Package },
] as const;

const ALL_ROLE_DISPLAY: Record<string, { label: string; color: string; icon: any }> = {
  superadmin: { label: "Super Admin", color: "bg-purple-100 text-purple-800", icon: ShieldAlert },
  admin: { label: "แอดมิน", color: "bg-amber-100 text-amber-800", icon: ShieldCheck },
  user: { label: "ผู้ใช้ทั่วไป", color: "bg-blue-100 text-blue-800", icon: User },
  warehouse: { label: "คลังสินค้า", color: "bg-teal-100 text-teal-800", icon: Package },
};

function getRoleLabel(role: string) {
  return ALL_ROLE_DISPLAY[role]?.label || role;
}

function getRoleColor(role: string) {
  return ALL_ROLE_DISPLAY[role]?.color || "bg-gray-100 text-gray-800";
}

export default function UserManagement() {
  const { user: currentUser, loading: authLoading } = useAuth();

  // Only superadmin can access this page
  if (!authLoading && currentUser && currentUser.role !== "superadmin") {
    return <Redirect to="/" />;
  }

  const [filterRole, setFilterRole] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);

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

  const resetPasswordMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      setResetPasswordUser(null);
      toast.success("รีเซ็ตรหัสผ่านสำเร็จ");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredUsers = filterRole === "all" ? usersList : usersList.filter((u: any) => u.role === filterRole);

  const superadminCount = usersList.filter((u: any) => u.role === "superadmin").length;
  const adminCount = usersList.filter((u: any) => u.role === "admin").length;
  const userCount = usersList.filter((u: any) => u.role === "user").length;
  const warehouseCount = usersList.filter((u: any) => u.role === "warehouse").length;

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole("all")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-slate-100 text-slate-800">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ทั้งหมด</p>
                  <p className="text-2xl font-bold">{usersList.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole(filterRole === "superadmin" ? "all" : "superadmin")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-purple-100 text-purple-800">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Super Admin</p>
                  <p className="text-2xl font-bold">{superadminCount}</p>
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
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterRole(filterRole === "warehouse" ? "all" : "warehouse")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-teal-100 text-teal-800">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">คลังสินค้า</p>
                  <p className="text-2xl font-bold">{warehouseCount}</p>
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
          <Button variant={filterRole === "superadmin" ? "default" : "outline"} size="sm" onClick={() => setFilterRole("superadmin")}>
            Super Admin ({superadminCount})
          </Button>
          <Button variant={filterRole === "admin" ? "default" : "outline"} size="sm" onClick={() => setFilterRole("admin")}>
            แอดมิน ({adminCount})
          </Button>
          <Button variant={filterRole === "user" ? "default" : "outline"} size="sm" onClick={() => setFilterRole("user")}>
            ผู้ใช้ทั่วไป ({userCount})
          </Button>
          <Button variant={filterRole === "warehouse" ? "default" : "outline"} size="sm" onClick={() => setFilterRole("warehouse")}>
            คลังสินค้า ({warehouseCount})
          </Button>
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
                        {user.role === "superadmin" ? <ShieldAlert className="h-4 w-4" /> : user.role === "admin" ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
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
                          {user.username && (
                            <span className="flex items-center gap-1">
                              <AtSign className="h-3 w-3" />
                              {user.username}
                            </span>
                          )}
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
                      {user.loginMethod === "manual" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="รีเซ็ตรหัสผ่าน" onClick={() => setResetPasswordUser(user)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      )}
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
        <AddUserDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSave={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />

        {/* Edit Dialog */}
        {editUser && (
          <EditUserDialog
            open={!!editUser}
            onClose={() => setEditUser(null)}
            onSave={(data) => updateMutation.mutate({ id: editUser.id, ...data })}
            isLoading={updateMutation.isPending}
            defaultValues={editUser}
          />
        )}

        {/* Reset Password Dialog */}
        <ResetPasswordDialog
          open={resetPasswordUser !== null}
          onClose={() => setResetPasswordUser(null)}
          onSave={(newPassword) => resetPasswordUser && resetPasswordMutation.mutate({ id: resetPasswordUser.id, newPassword })}
          isLoading={resetPasswordMutation.isPending}
          userName={resetPasswordUser?.name || ""}
        />

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

// ==================== ADD USER DIALOG ====================
function AddUserDialog({ open, onClose, onSave, isLoading }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; username: string; password: string; email?: string; role: "user" | "admin" }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      toast.error("ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (!password || password.length < 4) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร");
      return;
    }
    onSave({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password,
      email: email.trim() || undefined,
      role: role as "user" | "admin",
    });
  };

  const handleClose = () => {
    setName("");
    setUsername("");
    setPassword("");
    setEmail("");
    setRole("admin");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ชื่อ-นามสกุล *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="mt-1" />
          </div>
          <div>
            <Label>ชื่อผู้ใช้ (Username) *</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" className="mt-1" autoComplete="off" />
            <p className="text-xs text-muted-foreground mt-1">ใช้สำหรับเข้าสู่ระบบ (อย่างน้อย 3 ตัวอักษร)</p>
          </div>
          <div>
            <Label>รหัสผ่าน *</Label>
            <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="รหัสผ่าน" className="mt-1" type="password" autoComplete="new-password" />
            <p className="text-xs text-muted-foreground mt-1">อย่างน้อย 4 ตัวอักษร</p>
          </div>
          <div>
            <Label>อีเมล (ไม่บังคับ)</Label>
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
            <Button type="button" variant="outline" onClick={handleClose}>ยกเลิก</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== EDIT USER DIALOG ====================
function EditUserDialog({ open, onClose, onSave, isLoading, defaultValues }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; email?: string; role: "user" | "admin" }) => void;
  isLoading: boolean;
  defaultValues: { name?: string; email?: string; role?: string };
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
          <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
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

// ==================== RESET PASSWORD DIALOG ====================
function ResetPasswordDialog({ open, onClose, onSave, isLoading, userName }: {
  open: boolean;
  onClose: () => void;
  onSave: (newPassword: string) => void;
  isLoading: boolean;
  userName: string;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    onSave(newPassword);
  };

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>รีเซ็ตรหัสผ่าน</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          ตั้งรหัสผ่านใหม่ให้ <strong>{userName}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>รหัสผ่านใหม่ *</Label>
            <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="รหัสผ่านใหม่" className="mt-1" type="password" autoComplete="new-password" />
          </div>
          <div>
            <Label>ยืนยันรหัสผ่าน *</Label>
            <Input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="ยืนยันรหัสผ่าน" className="mt-1" type="password" autoComplete="new-password" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>ยกเลิก</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "กำลังบันทึก..." : "รีเซ็ตรหัสผ่าน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
