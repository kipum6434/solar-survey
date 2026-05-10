import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users, ArrowLeft, Search, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export default function SourceManagement() {
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [editSource, setEditSource] = useState<{ id: number; name: string; category: string; groupName: string | null } | null>(null);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceCategory, setNewSourceCategory] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [pendingGroupSourceId, setPendingGroupSourceId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: sourcesWithStats = [], isLoading } = trpc.source.listWithStats.useQuery();
  const { data: groups = [] } = trpc.source.listGroups.useQuery();
  const { data: drillDownCustomers = [], isLoading: loadingCustomers } = trpc.source.getCustomersBySource.useQuery(
    { sourceId: selectedSourceId! },
    { enabled: !!selectedSourceId }
  );

  const createMutation = trpc.source.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มแหล่งที่มาสำเร็จ");
      utils.source.listWithStats.invalidate();
      utils.source.listGroups.invalidate();
      setShowCreateDialog(false);
      setNewSourceName("");
      setNewSourceCategory("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.source.update.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตสำเร็จ");
      utils.source.listWithStats.invalidate();
      utils.source.listGroups.invalidate();
      setShowEditDialog(false);
      setEditSource(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.source.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      utils.source.listWithStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredSources = sourcesWithStats.filter((s: any) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    const matchGroup = filterGroup === "all" ||
      (filterGroup === "none" ? !s.groupName : s.groupName === filterGroup);
    return matchSearch && matchGroup;
  });

  const handleGroupChange = (sourceId: number, newGroup: string) => {
    if (newGroup === "__new__") {
      setPendingGroupSourceId(sourceId);
      setShowNewGroupDialog(true);
      return;
    }
    const groupValue = newGroup === "__none__" ? null : newGroup;
    updateMutation.mutate({ id: sourceId, groupName: groupValue });
  };

  const handleCreateNewGroup = () => {
    if (!newGroupName.trim()) return;
    if (pendingGroupSourceId) {
      updateMutation.mutate({ id: pendingGroupSourceId, groupName: newGroupName.trim() });
    }
    setShowNewGroupDialog(false);
    setNewGroupName("");
    setPendingGroupSourceId(null);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`ยืนยันลบแหล่งที่มา "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  // Drill-down view
  if (selectedSourceId) {
    const selectedSource = sourcesWithStats.find((s: any) => s.id === selectedSourceId);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSourceId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <h2 className="text-xl font-bold">
            ลูกค้าจากแหล่งที่มา: {selectedSource?.name}
          </h2>
          <Badge variant="secondary">{drillDownCustomers.length} ราย</Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {loadingCustomers ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : drillDownCustomers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">ไม่พบลูกค้า</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>เบอร์โทร</TableHead>
                    <TableHead>จังหวัด</TableHead>
                    <TableHead>อำเภอ</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillDownCustomers.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || "-"}</TableCell>
                      <TableCell>{c.province || "-"}</TableCell>
                      <TableCell>{c.district || "-"}</TableCell>
                      <TableCell>{c.createdAt ? new Date(c.createdAt).toLocaleDateString("th-TH") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการแหล่งที่มา</h1>
          <p className="text-muted-foreground">จัดการ source ทั้งหมดและจัดกลุ่ม (TCS/Gulf/MEA)</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่มแหล่งที่มา
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">ทั้งหมด</div>
            <div className="text-2xl font-bold">{sourcesWithStats.length}</div>
          </CardContent>
        </Card>
        {groups.map((g: string) => (
          <Card key={g}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{g}</div>
              <div className="text-2xl font-bold">
                {sourcesWithStats.filter((s: any) => s.groupName === g).length}
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">ไม่มีกลุ่ม (TCS)</div>
            <div className="text-2xl font-bold">
              {sourcesWithStats.filter((s: any) => !s.groupName).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาแหล่งที่มา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="กรองตามกลุ่ม" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="none">ไม่มีกลุ่ม (TCS)</SelectItem>
            {groups.map((g: string) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
          ) : filteredSources.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">ไม่พบแหล่งที่มา</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อแหล่งที่มา</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>กลุ่ม</TableHead>
                  <TableHead className="text-center">จำนวนลูกค้า</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSources.map((source: any) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <button
                        className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                        onClick={() => setSelectedSourceId(source.id)}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        {source.name}
                      </button>
                    </TableCell>
                    <TableCell>{source.category || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={source.groupName || "__none__"}
                        onValueChange={(val) => handleGroupChange(source.id, val)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">TCS (ไม่มีกลุ่ม)</SelectItem>
                          {groups.map((g: string) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                          <SelectItem value="__new__">+ สร้างกลุ่มใหม่</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedSourceId(source.id)}>
                        <Users className="h-3 w-3 mr-1" />
                        {source.customerCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditSource({ id: source.id, name: source.name, category: source.category || "", groupName: source.groupName });
                            setShowEditDialog(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(source.id, source.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มแหล่งที่มาใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">ชื่อ</label>
              <Input value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} placeholder="เช่น Facebook Ads, Line OA" />
            </div>
            <div>
              <label className="text-sm font-medium">หมวดหมู่</label>
              <Input value={newSourceCategory} onChange={(e) => setNewSourceCategory(e.target.value)} placeholder="เช่น online, offline" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>ยกเลิก</Button>
            <Button
              onClick={() => createMutation.mutate({ name: newSourceName, category: newSourceCategory || undefined })}
              disabled={!newSourceName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขแหล่งที่มา</DialogTitle>
          </DialogHeader>
          {editSource && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ชื่อ</label>
                <Input value={editSource.name} onChange={(e) => setEditSource({ ...editSource, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">หมวดหมู่</label>
                <Input value={editSource.category} onChange={(e) => setEditSource({ ...editSource, category: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">กลุ่ม</label>
                <Select
                  value={editSource.groupName || "__none__"}
                  onValueChange={(val) => setEditSource({ ...editSource, groupName: val === "__none__" ? null : val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">TCS (ไม่มีกลุ่ม)</SelectItem>
                    {groups.map((g: string) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>ยกเลิก</Button>
            <Button
              onClick={() => editSource && updateMutation.mutate({ id: editSource.id, name: editSource.name, category: editSource.category || undefined, groupName: editSource.groupName })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้างกลุ่มใหม่</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">ชื่อกลุ่ม</label>
            <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="เช่น PEA, EGAT" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewGroupDialog(false); setPendingGroupSourceId(null); }}>ยกเลิก</Button>
            <Button onClick={handleCreateNewGroup} disabled={!newGroupName.trim()}>
              สร้างและกำหนดกลุ่ม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
