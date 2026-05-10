import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft, Users, Search } from "lucide-react";

const GROUP_OPTIONS = [
  { value: "TCS", label: "TCS", color: "bg-blue-100 text-blue-800" },
  { value: "Gulf", label: "Gulf", color: "bg-green-100 text-green-800" },
  { value: "MEA", label: "MEA", color: "bg-purple-100 text-purple-800" },
];

function getGroupBadge(groupName: string | null | undefined) {
  const group = GROUP_OPTIONS.find((g) => g.value === groupName);
  if (group) {
    return <Badge className={group.color}>{group.label}</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-800">TCS</Badge>;
}

export default function SourceManagement() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<{
    id: number;
    name: string;
    groupName: string | null;
  } | null>(null);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceGroup, setNewSourceGroup] = useState<string>("TCS");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerPage, setCustomerPage] = useState(1);

  const utils = trpc.useUtils();
  const { data: sourcesData, isLoading } = trpc.source.listWithStats.useQuery();
  const { data: customersData, isLoading: customersLoading } =
    trpc.source.customersBySource.useQuery(
      { sourceName: selectedSource!, page: customerPage, limit: 20 },
      { enabled: !!selectedSource }
    );

  const createMutation = trpc.source.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มแหล่งที่มาสำเร็จ");
      utils.source.listWithStats.invalidate();
      setShowCreateDialog(false);
      setNewSourceName("");
      setNewSourceGroup("TCS");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.source.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขแหล่งที่มาสำเร็จ");
      utils.source.listWithStats.invalidate();
      setShowEditDialog(false);
      setEditingSource(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateGroupMutation = trpc.source.updateGroup.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนกลุ่มสำเร็จ");
      utils.source.listWithStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.source.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบแหล่งที่มาสำเร็จ");
      utils.source.listWithStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredSources = sourcesData?.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Drill-down view: show customers for selected source
  if (selectedSource) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedSource(null);
              setCustomerPage(1);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ
          </Button>
          <h2 className="text-xl font-bold">
            ลูกค้าจากแหล่งที่มา: {selectedSource}
          </h2>
          {customersData && (
            <Badge variant="secondary">{customersData.total} ราย</Badge>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {customersLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                กำลังโหลด...
              </div>
            ) : customersData?.data.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                ไม่พบลูกค้าในแหล่งที่มานี้
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>โทรศัพท์</TableHead>
                    <TableHead>ที่อยู่</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customersData?.data.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>
                        {[customer.district, customer.province]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </TableCell>
                      <TableCell>
                        {customer.createdAt
                          ? new Date(customer.createdAt).toLocaleDateString(
                              "th-TH"
                            )
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {customersData && customersData.total > 20 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={customerPage <= 1}
              onClick={() => setCustomerPage((p) => p - 1)}
            >
              ก่อนหน้า
            </Button>
            <span className="flex items-center text-sm text-muted-foreground">
              หน้า {customerPage} / {Math.ceil(customersData.total / 20)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={customerPage >= Math.ceil(customersData.total / 20)}
              onClick={() => setCustomerPage((p) => p + 1)}
            >
              ถัดไป
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Main view: source list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">จัดการแหล่งที่มา</h2>
          <p className="text-muted-foreground text-sm mt-1">
            ดูรายชื่อแหล่งที่มาทั้งหมด กำหนดกลุ่ม (TCS/Gulf/MEA) และดูลูกค้าในแต่ละแหล่ง
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          เพิ่มแหล่งที่มา
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาแหล่งที่มา..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROUP_OPTIONS.map((group) => {
          const count =
            sourcesData?.filter((s) =>
              group.value === "TCS"
                ? !s.groupName || s.groupName === "TCS"
                : s.groupName === group.value
            ).length || 0;
          const customerTotal =
            sourcesData
              ?.filter((s) =>
                group.value === "TCS"
                  ? !s.groupName || s.groupName === "TCS"
                  : s.groupName === group.value
              )
              .reduce((sum, s) => sum + s.customerCount, 0) || 0;
          return (
            <Card key={group.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge className={group.color}>{group.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count} แหล่ง</div>
                <p className="text-xs text-muted-foreground">
                  {customerTotal} ลูกค้า
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Source table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              กำลังโหลด...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อแหล่งที่มา</TableHead>
                  <TableHead>กลุ่ม</TableHead>
                  <TableHead className="text-center">จำนวนลูกค้า</TableHead>
                  <TableHead className="text-center">จำนวนใช้งาน</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSources?.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <button
                        className="font-medium text-primary hover:underline cursor-pointer"
                        onClick={() => setSelectedSource(source.name)}
                      >
                        {source.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={source.groupName || "TCS"}
                        onValueChange={(val) => {
                          updateGroupMutation.mutate({
                            id: source.id,
                            groupName: val === "TCS" ? null : val,
                          });
                        }}
                      >
                        <SelectTrigger className="w-[100px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GROUP_OPTIONS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        className="inline-flex items-center gap-1 text-sm hover:text-primary cursor-pointer"
                        onClick={() => setSelectedSource(source.name)}
                      >
                        <Users className="h-3 w-3" />
                        {source.customerCount}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      {source.usageCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingSource({
                              id: source.id,
                              name: source.name,
                              groupName: source.groupName,
                            });
                            setShowEditDialog(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `ต้องการลบแหล่งที่มา "${source.name}" ใช่หรือไม่?`
                              )
                            ) {
                              deleteMutation.mutate({ id: source.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">ชื่อแหล่งที่มา</label>
              <Input
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="เช่น FB เพจ ABC"
              />
            </div>
            <div>
              <label className="text-sm font-medium">กลุ่ม</label>
              <Select value={newSourceGroup} onValueChange={setNewSourceGroup}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (!newSourceName.trim()) {
                  toast.error("กรุณากรอกชื่อแหล่งที่มา");
                  return;
                }
                createMutation.mutate({
                  name: newSourceName.trim(),
                  groupName: newSourceGroup === "TCS" ? null : newSourceGroup,
                });
              }}
              disabled={createMutation.isPending}
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
          {editingSource && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">ชื่อแหล่งที่มา</label>
                <Input
                  value={editingSource.name}
                  onChange={(e) =>
                    setEditingSource({ ...editingSource, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">กลุ่ม</label>
                <Select
                  value={editingSource.groupName || "TCS"}
                  onValueChange={(val) =>
                    setEditingSource({
                      ...editingSource,
                      groupName: val === "TCS" ? null : val,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (!editingSource) return;
                updateMutation.mutate({
                  id: editingSource.id,
                  name: editingSource.name,
                  groupName: editingSource.groupName,
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
