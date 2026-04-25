import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2, Send, Users, User, Bot, RefreshCw, Loader2 } from "lucide-react";

export default function LineSettings() {
  const utils = trpc.useUtils();
  const botInfo = trpc.lineSettings.botInfo.useQuery();
  const targets = trpc.lineSettings.targets.useQuery();
  const groups = trpc.lineSettings.groups.useQuery();

  const addTarget = trpc.lineSettings.addTarget.useMutation({
    onSuccess: () => {
      utils.lineSettings.targets.invalidate();
      toast.success("เพิ่มเป้าหมายแจ้งเตือนสำเร็จ");
      setNewTargetType("user");
      setNewTargetId("");
      setNewTargetLabel("");
      setShowAddForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTarget = trpc.lineSettings.updateTarget.useMutation({
    onSuccess: () => {
      utils.lineSettings.targets.invalidate();
      toast.success("อัปเดตสำเร็จ");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTarget = trpc.lineSettings.deleteTarget.useMutation({
    onSuccess: () => {
      utils.lineSettings.targets.invalidate();
      toast.success("ลบเป้าหมายแจ้งเตือนสำเร็จ");
    },
    onError: (e) => toast.error(e.message),
  });

  const testSend = trpc.lineSettings.testSend.useMutation({
    onSuccess: (data) => {
      if (data.success) toast.success("ส่งข้อความทดสอบสำเร็จ");
      else toast.error("ส่งข้อความทดสอบไม่สำเร็จ");
    },
    onError: (e) => toast.error(e.message),
  });

  const testNotifyAll = trpc.lineSettings.testNotifyAll.useMutation({
    onSuccess: (data) => {
      toast.success(`ส่งแจ้งเตือนทดสอบ: สำเร็จ ${data.sent} / ล้มเหลว ${data.failed}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTargetType, setNewTargetType] = useState<"user" | "group">("user");
  const [newTargetId, setNewTargetId] = useState("");
  const [newTargetLabel, setNewTargetLabel] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ตั้งค่า LINE</h1>
        <p className="text-muted-foreground mt-1">
          จัดการการแจ้งเตือนผ่าน LINE Messaging API
        </p>
      </div>

      {/* Bot Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            ข้อมูล LINE Bot
          </CardTitle>
          <CardDescription>สถานะการเชื่อมต่อ LINE Messaging API</CardDescription>
        </CardHeader>
        <CardContent>
          {botInfo.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : botInfo.data ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">{botInfo.data.displayName}</p>
                  <p className="text-sm text-muted-foreground">{botInfo.data.basicId}</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 w-fit">
                เชื่อมต่อแล้ว
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <Badge variant="destructive">ไม่ได้เชื่อมต่อ</Badge>
              <span className="text-sm">กรุณาตรวจสอบ Channel Access Token</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Targets */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                เป้าหมายแจ้งเตือน
              </CardTitle>
              <CardDescription className="mt-1">
                กำหนดว่าจะส่งแจ้งเตือน LINE ไปที่ไหนบ้าง
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testNotifyAll.mutate()}
                disabled={testNotifyAll.isPending}
              >
                {testNotifyAll.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                ทดสอบส่งทั้งหมด
              </Button>
              <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="h-4 w-4 mr-1" />
                เพิ่ม
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          {showAddForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h4 className="font-medium text-sm">เพิ่มเป้าหมายใหม่</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">ประเภท</Label>
                  <Select value={newTargetType} onValueChange={(v) => setNewTargetType(v as "user" | "group")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User (ส่วนตัว)</SelectItem>
                      <SelectItem value="group">Group (กลุ่ม)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">
                    {newTargetType === "user" ? "User ID" : "Group ID"}
                  </Label>
                  {newTargetType === "group" && groups.data && groups.data.length > 0 ? (
                    <Select value={newTargetId} onValueChange={setNewTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกกลุ่ม..." />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.data.map((g) => (
                          <SelectItem key={g.groupId} value={g.groupId}>
                            {g.groupName || g.groupId.substring(0, 16) + "..."}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={newTargetType === "user" ? "Uxxxxxxxxx..." : "Cxxxxxxxxx..."}
                      value={newTargetId}
                      onChange={(e) => setNewTargetId(e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <Label className="text-xs">ชื่อ (ไม่บังคับ)</Label>
                  <Input
                    placeholder="เช่น กลุ่มทีมงาน"
                    value={newTargetLabel}
                    onChange={(e) => setNewTargetLabel(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  ยกเลิก
                </Button>
                <Button
                  size="sm"
                  disabled={!newTargetId || addTarget.isPending}
                  onClick={() =>
                    addTarget.mutate({
                      targetType: newTargetType,
                      targetId: newTargetId,
                      label: newTargetLabel || undefined,
                    })
                  }
                >
                  {addTarget.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  เพิ่ม
                </Button>
              </div>
            </div>
          )}

          {/* Target list */}
          {targets.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : targets.data && targets.data.length > 0 ? (
            <div className="space-y-2">
              {targets.data.map((target) => (
                <div
                  key={target.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      target.targetType === "user" ? "bg-blue-100" : "bg-purple-100"
                    }`}>
                      {target.targetType === "user" ? (
                        <User className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Users className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {target.label || (target.targetType === "user" ? "User" : "Group")}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {target.targetId.substring(0, 20)}...
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {target.targetType === "user" ? "ส่วนตัว" : "กลุ่ม"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={target.isEnabled}
                      onCheckedChange={(checked) =>
                        updateTarget.mutate({ id: target.id, isEnabled: checked })
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testSend.mutate({ targetId: target.targetId })}
                      disabled={testSend.isPending}
                    >
                      {testSend.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>ลบเป้าหมายแจ้งเตือน?</AlertDialogTitle>
                          <AlertDialogDescription>
                            ต้องการลบ "{target.label || target.targetId}" ออกจากรายการแจ้งเตือนหรือไม่?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteTarget.mutate({ id: target.id })}
                          >
                            ลบ
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีเป้าหมายแจ้งเตือน</p>
              <p className="text-sm">กดปุ่ม "เพิ่ม" เพื่อเพิ่มเป้าหมาย</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Groups detected */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                กลุ่ม LINE ที่ Bot เข้าร่วม
              </CardTitle>
              <CardDescription className="mt-1">
                กลุ่มที่ Bot ถูกเพิ่มเข้าไป (จับอัตโนมัติผ่าน Webhook)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => utils.lineSettings.groups.invalidate()}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              รีเฟรช
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {groups.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : groups.data && groups.data.length > 0 ? (
            <div className="space-y-2">
              {groups.data.map((group) => (
                <div
                  key={group.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {group.groupName || "กลุ่มไม่ระบุชื่อ"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {group.groupId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={group.isActive ? "default" : "secondary"}>
                      {group.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // เพิ่มเป็น notification target
                        addTarget.mutate({
                          targetType: "group",
                          targetId: group.groupId,
                          label: group.groupName || `กลุ่ม ${group.groupId.substring(0, 8)}`,
                        });
                      }}
                      disabled={addTarget.isPending}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      เพิ่มเป็นเป้าหมาย
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีกลุ่มที่ Bot เข้าร่วม</p>
              <p className="text-sm mt-1">
                เพิ่ม Bot เข้ากลุ่ม LINE แล้วระบบจะจับ Group ID ให้อัตโนมัติ
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                หมายเหตุ: ต้อง Deploy และตั้ง Webhook URL ที่ LINE Developers Console ก่อน
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูล Webhook</CardTitle>
          <CardDescription>
            ตั้งค่า Webhook URL ที่ LINE Developers Console เพื่อจับ Group ID อัตโนมัติ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-sm">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/api/line/webhook`}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/line/webhook`);
                  toast.success("คัดลอก Webhook URL แล้ว");
                }}
              >
                คัดลอก
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ไปที่ LINE Developers Console → Messaging API → Webhook settings → วาง URL นี้
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
