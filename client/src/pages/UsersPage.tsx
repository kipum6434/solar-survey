import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, Shield, ShieldCheck, User, Key, Trash2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function getRoleBadge(role: string) {
  switch (role) {
    case "superadmin":
      return <Badge className="bg-red-100 text-red-700 border-red-200"><ShieldCheck className="h-3 w-3 mr-1" />Superadmin</Badge>;
    case "admin":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    default:
      return <Badge variant="outline" className="text-stone-600"><User className="h-3 w-3 mr-1" />ทีมสำรวจ</Badge>;
  }
}

function UsersContent() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const createUser = trpc.users.create.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("สร้างผู้ใช้สำเร็จ"); },
    onError: (err) => toast.error(err.message),
  });
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("เปลี่ยน Role สำเร็จ"); },
    onError: (err) => toast.error(err.message),
  });
  const resetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => toast.success("รีเซ็ตรหัสผ่านสำเร็จ"),
    onError: (err) => toast.error(err.message),
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("ลบผู้ใช้สำเร็จ"); },
    onError: (err) => toast.error(err.message),
  });

  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", role: "user" as string });
  const [resetPwUser, setResetPwUser] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const isAdminOrSuper = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const isSuperadmin = currentUser?.role === "superadmin";

  if (!isAdminOrSuper) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.name.trim()) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    await createUser.mutateAsync({
      username: newUser.username.trim(),
      password: newUser.password,
      name: newUser.name.trim(),
      role: newUser.role as any,
    });
    setNewUser({ username: "", password: "", name: "", role: "user" });
    setCreateDialogOpen(false);
  };

  const handleResetPassword = async () => {
    if (!resetPwUser || !newPassword.trim() || newPassword.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    await resetPassword.mutateAsync({ userId: resetPwUser.id, newPassword });
    setResetPwUser(null);
    setNewPassword("");
    setResetDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการผู้ใช้</h1>
          <p className="text-sm text-muted-foreground mt-1">สร้างและจัดการบัญชีผู้ใช้ในระบบ</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              <UserPlus className="h-4 w-4 mr-2" />
              เพิ่มผู้ใช้
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ชื่อ-นามสกุล</Label>
                <Input
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>
              <div className="space-y-2">
                <Label>ชื่อผู้ใช้ (Username)</Label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="กรอกชื่อผู้ใช้"
                />
              </div>
              <div className="space-y-2">
                <Label>รหัสผ่าน</Label>
                <div className="relative">
                  <Input
                    type={showCreatePassword ? "text" : "password"}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>สิทธิ์การใช้งาน</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">ทีมสำรวจ (เห็นเฉพาะงานตัวเอง)</SelectItem>
                    {isSuperadmin && <SelectItem value="admin">Admin (เห็นทุกงาน)</SelectItem>}
                    {isSuperadmin && <SelectItem value="superadmin">Superadmin (จัดการทั้งหมด)</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">ยกเลิก</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={createUser.isPending} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                {createUser.isPending ? "กำลังสร้าง..." : "สร้างผู้ใช้"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) { setResetPwUser(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รีเซ็ตรหัสผ่าน - {resetPwUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>รหัสผ่านใหม่</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DialogClose>
            <Button onClick={handleResetPassword} disabled={resetPassword.isPending} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
              {resetPassword.isPending ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายชื่อผู้ใช้ ({users?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>สิทธิ์</TableHead>
                    <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.username || u.openId?.substring(0, 10) || "-"}</TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Change Role */}
                          {u.id !== currentUser?.id && (
                            <Select
                              value={u.role}
                              onValueChange={(newRole) => {
                                updateRole.mutate({ userId: u.id, role: newRole as any });
                              }}
                            >
                              <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">ทีมสำรวจ</SelectItem>
                                {isSuperadmin && <SelectItem value="admin">Admin</SelectItem>}
                                {isSuperadmin && <SelectItem value="superadmin">Superadmin</SelectItem>}
                              </SelectContent>
                            </Select>
                          )}
                          {/* Reset Password */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setResetPwUser({ id: u.id, name: u.name || u.username || "User" }); setResetDialogOpen(true); }}
                            title="รีเซ็ตรหัสผ่าน"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {/* Delete */}
                          {isSuperadmin && u.id !== currentUser?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="ลบผู้ใช้">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>ยืนยันการลบผู้ใช้</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ต้องการลบผู้ใช้ "{u.name || u.username}" ออกจากระบบหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser.mutate({ userId: u.id })}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    ลบผู้ใช้
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50/50 border-blue-100">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-[#1e3a5f]">คำอธิบายสิทธิ์การใช้งาน</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex items-start gap-3">
                {getRoleBadge("superadmin")}
                <span className="text-stone-600">เข้าถึงข้อมูลทั้งหมด, สร้าง/ลบผู้ใช้, เปลี่ยน Role ทุกระดับ</span>
              </div>
              <div className="flex items-start gap-3">
                {getRoleBadge("admin")}
                <span className="text-stone-600">เข้าถึงข้อมูลทั้งหมด, สร้างผู้ใช้ระดับทีมสำรวจ</span>
              </div>
              <div className="flex items-start gap-3">
                {getRoleBadge("user")}
                <span className="text-stone-600">เห็นเฉพาะลูกค้าและงานสำรวจที่ตัวเองสร้างหรือได้รับมอบหมาย</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UsersPage() {
  return (
    <DashboardLayout>
      <UsersContent />
    </DashboardLayout>
  );
}
