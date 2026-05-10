import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users, ArrowLeft, Search, FolderOpen, GripVertical, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

// Droppable group column
function GroupColumn({ groupName, children, sourceCount, customerCount }: { groupName: string; children: React.ReactNode; sourceCount: number; customerCount: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${groupName}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border bg-card min-h-[300px] transition-colors ${isOver ? "ring-2 ring-primary border-primary" : ""}`}
    >
      <div className="p-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{groupName}</h3>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-xs">{sourceCount} แหล่ง</Badge>
            <Badge variant="secondary" className="text-xs"><Users className="h-3 w-3 mr-0.5" />{customerCount}</Badge>
          </div>
        </div>
      </div>
      <div className="p-2 flex-1 space-y-1.5 overflow-y-auto max-h-[500px]">
        {children}
      </div>
    </div>
  );
}

// Draggable source card
function DraggableSourceCard({ source, onEdit, onDelete, onDrillDown }: {
  source: any;
  onEdit: () => void;
  onDelete: () => void;
  onDrillDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `source-${source.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-accent/50 group"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        className="flex-1 text-left text-sm font-medium text-blue-600 hover:underline truncate"
        onClick={onDrillDown}
      >
        {source.name}
      </button>
      <Badge variant="secondary" className="text-xs shrink-0">
        <Users className="h-3 w-3 mr-0.5" />{source.customerCount}
      </Badge>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

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
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const createGroupMutation = trpc.source.createGroup.useMutation({
    onSuccess: () => {
      toast.success("สร้างกลุ่มใหม่สำเร็จ");
      utils.source.listGroups.invalidate();
      utils.source.listGroupsFull.invalidate();
      setShowNewGroupDialog(false);
      setNewGroupName("");
    },
    onError: (err) => toast.error(err.message),
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Filtered sources
  const filteredSources = useMemo(() => {
    return sourcesWithStats.filter((s: any) => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      const matchGroup = filterGroup === "all" ||
        (filterGroup === "none" ? !s.groupName : s.groupName === filterGroup);
      return matchSearch && matchGroup;
    });
  }, [sourcesWithStats, search, filterGroup]);

  // Group sources by groupName for Kanban view
  const sourcesByGroup = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const g of groups) {
      map[g] = [];
    }
    map["ไม่มีกลุ่ม"] = [];
    for (const s of filteredSources) {
      const group = s.groupName || "ไม่มีกลุ่ม";
      if (!map[group]) map[group] = [];
      map[group].push(s);
    }
    return map;
  }, [filteredSources, groups]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const sourceId = parseInt((active.id as string).replace("source-", ""));
    const overId = over.id as string;

    let targetGroup: string | null = null;
    if (overId.startsWith("group-")) {
      targetGroup = overId.replace("group-", "");
      if (targetGroup === "ไม่มีกลุ่ม") targetGroup = null;
    } else if (overId.startsWith("source-")) {
      // Dropped on another source - find its group
      const overSourceId = parseInt(overId.replace("source-", ""));
      const overSource = sourcesWithStats.find((s: any) => s.id === overSourceId);
      targetGroup = overSource?.groupName || null;
    }

    // Find current group of the dragged source
    const draggedSource = sourcesWithStats.find((s: any) => s.id === sourceId);
    if (!draggedSource) return;
    const currentGroup = draggedSource.groupName || null;

    // Only update if group changed
    if (currentGroup !== targetGroup) {
      updateMutation.mutate({ id: sourceId, groupName: targetGroup });
      toast.info(`ย้าย "${draggedSource.name}" ไปกลุ่ม "${targetGroup || "ไม่มีกลุ่ม"}"`);
    }
  };

  const handleGroupChange = (sourceId: number, newGroup: string) => {
    if (newGroup === "__new__") {
      setShowNewGroupDialog(true);
      return;
    }
    const groupValue = newGroup === "__none__" ? null : newGroup;
    updateMutation.mutate({ id: sourceId, groupName: groupValue });
  };

  const handleCreateNewGroup = () => {
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate({ name: newGroupName.trim() });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`ยืนยันลบแหล่งที่มา "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const activeSource = activeId ? sourcesWithStats.find((s: any) => `source-${s.id}` === activeId) : null;

  // Drill-down view
  if (selectedSourceId) {
    const selectedSource = sourcesWithStats.find((s: any) => s.id === selectedSourceId);
    return (
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">จัดการแหล่งที่มา</h1>
            <p className="text-muted-foreground">จัดการ source ทั้งหมดและจัดกลุ่ม — ลาก-วางเพื่อย้ายกลุ่ม</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewGroupDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> สร้างกลุ่มใหม่
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่มแหล่งที่มา
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">ทั้งหมด</div>
              <div className="text-xl font-bold">{sourcesWithStats.length}</div>
            </CardContent>
          </Card>
          {groups.map((g: string) => (
            <Card key={g}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{g}</div>
                <div className="text-xl font-bold">
                  {sourcesWithStats.filter((s: any) => s.groupName === g).length}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">ไม่มีกลุ่ม</div>
              <div className="text-xl font-bold">
                {sourcesWithStats.filter((s: any) => !s.groupName).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + View Toggle */}
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
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="กรองตามกลุ่ม" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="none">ไม่มีกลุ่ม</SelectItem>
              {groups.map((g: string) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
        ) : viewMode === "kanban" ? (
          /* Kanban View with Drag & Drop */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(sourcesByGroup).map(([groupName, groupSources]) => (
                <GroupColumn
                  key={groupName}
                  groupName={groupName}
                  sourceCount={groupSources.length}
                  customerCount={groupSources.reduce((sum: number, s: any) => sum + (Number(s.customerCount) || 0), 0)}
                >
                  <SortableContext
                    items={groupSources.map((s: any) => `source-${s.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {groupSources.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        ลาก source มาวางที่นี่
                      </div>
                    ) : (
                      groupSources.map((source: any) => (
                        <DraggableSourceCard
                          key={source.id}
                          source={source}
                          onEdit={() => {
                            setEditSource({ id: source.id, name: source.name, category: source.category || "", groupName: source.groupName });
                            setShowEditDialog(true);
                          }}
                          onDelete={() => handleDelete(source.id, source.name)}
                          onDrillDown={() => setSelectedSourceId(source.id)}
                        />
                      ))
                    )}
                  </SortableContext>
                </GroupColumn>
              ))}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeSource ? (
                <div className="flex items-center gap-2 p-2 rounded-md border bg-background shadow-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{activeSource.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-0.5" />{activeSource.customerCount}
                  </Badge>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-0">
              {filteredSources.length === 0 ? (
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
                              <SelectItem value="__none__">ไม่มีกลุ่ม</SelectItem>
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
        )}

        {/* Create Source Dialog */}
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

        {/* Edit Source Dialog */}
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
                      <SelectItem value="__none__">ไม่มีกลุ่ม</SelectItem>
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
              <Button variant="outline" onClick={() => setShowNewGroupDialog(false)}>ยกเลิก</Button>
              <Button onClick={handleCreateNewGroup} disabled={!newGroupName.trim() || createGroupMutation.isPending}>
                {createGroupMutation.isPending ? "กำลังสร้าง..." : "สร้างกลุ่ม"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
