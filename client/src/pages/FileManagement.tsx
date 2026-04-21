import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Search,
  Trash2,
  Image as ImageIcon,
  FileText,
  HardDrive,
  Eye,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  AlertTriangle,
  X,
} from "lucide-react";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  roof_overview: "ภาพรวมหลังคา",
  roof_detail: "รายละเอียดหลังคา",
  electrical_panel: "ตู้ไฟ",
  meter: "มิเตอร์",
  inverter_location: "ตำแหน่งอินเวอร์เตอร์",
  surroundings: "บริเวณรอบบ้าน",
  other: "อื่นๆ",
  quotation: "ใบเสนอราคา",
  simulation: "Simulation",
  contract: "สัญญา",
};

export default function FileManagement() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fileType, setFileType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: string; fileName: string | null } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const limit = 20;

  // Debounce search
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
    setSearchTimer(timer);
  };

  const { data: stats } = trpc.storage.stats.useQuery();
  const { data: filesData, isLoading, refetch } = trpc.storage.listFiles.useQuery({
    page,
    limit,
    search: debouncedSearch || undefined,
    fileType: fileType as any,
  });

  const deleteMutation = trpc.storage.deleteFile.useMutation({
    onSuccess: () => {
      toast.success("ลบไฟล์สำเร็จ");
      refetch();
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const files = filesData?.data ?? [];
  const total = filesData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map(f => `${f.type}-${f.id}`)));
    }
  };

  const handleBulkDelete = async () => {
    const items = Array.from(selectedIds).map(key => {
      const [type, idStr] = key.split("-");
      return { id: parseInt(idStr), type: type as "photo" | "document" };
    });
    for (const item of items) {
      try {
        await deleteMutation.mutateAsync(item);
      } catch {}
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    refetch();
  };

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">จัดการไฟล์</h1>
        <p className="text-muted-foreground mt-1">จัดการรูปภาพและเอกสารทั้งหมดในระบบ</p>
      </div>

      {/* Storage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalPhotos ?? 0}</div>
              <div className="text-sm text-muted-foreground">รูปภาพ</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalDocuments ?? 0}</div>
              <div className="text-sm text-muted-foreground">เอกสาร</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatFileSize((stats?.totalPhotoSize ?? 0) + (stats?.totalDocumentSize ?? 0))}</div>
              <div className="text-sm text-muted-foreground">ขนาดรวม</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อลูกค้า, ชื่อไฟล์..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={fileType} onValueChange={(v) => { setFileType(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="ประเภทไฟล์" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="photo">รูปภาพ</SelectItem>
            <SelectItem value="document">เอกสาร</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm text-red-700">เลือก {selectedIds.size} ไฟล์</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            ลบที่เลือก
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            ยกเลิก
          </Button>
        </div>
      )}

      {/* File List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">ไม่พบไฟล์</p>
        </div>
      ) : (
        <>
          {/* Select All */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={selectedIds.size === files.length && files.length > 0}
              onChange={selectAll}
              className="rounded"
            />
            <span>เลือกทั้งหมด ({total} ไฟล์)</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left w-10"></th>
                      <th className="p-3 text-left">ตัวอย่าง</th>
                      <th className="p-3 text-left">ชื่อไฟล์</th>
                      <th className="p-3 text-left">ประเภท</th>
                      <th className="p-3 text-left">หมวดหมู่</th>
                      <th className="p-3 text-left">ลูกค้า</th>
                      <th className="p-3 text-left">ขนาด</th>
                      <th className="p-3 text-left">วันที่อัพโหลด</th>
                      <th className="p-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => {
                      const key = `${file.type}-${file.id}`;
                      return (
                        <tr key={key} className="border-b hover:bg-muted/30">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(key)}
                              onChange={() => toggleSelect(key)}
                              className="rounded"
                            />
                          </td>
                          <td className="p-3">
                            {file.type === "photo" ? (
                              <img
                                src={file.url}
                                alt={file.fileName || ""}
                                className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                                onClick={() => setPreviewUrl(file.url)}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                <FileText className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="max-w-[200px] truncate" title={file.fileName || ""}>
                              {file.fileName || "-"}
                            </div>
                            {file.caption && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{file.caption}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              file.type === "photo"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {file.type === "photo" ? "รูปภาพ" : "เอกสาร"}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {CATEGORY_LABELS[file.category || ""] || file.category || "-"}
                          </td>
                          <td className="p-3">
                            <div>{file.customerName}</div>
                            {file.customerPhone && (
                              <div className="text-xs text-muted-foreground">{file.customerPhone}</div>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">{formatFileSize(file.fileSize)}</td>
                          <td className="p-3 text-muted-foreground">{formatDate(file.createdAt)}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              {file.type === "photo" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPreviewUrl(file.url)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(file.url, "_blank")}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteTarget({ id: file.id, type: file.type, fileName: file.fileName })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {files.map((file) => {
              const key = `${file.type}-${file.id}`;
              return (
                <Card key={key}>
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(key)}
                          onChange={() => toggleSelect(key)}
                          className="rounded mt-1"
                        />
                        {file.type === "photo" ? (
                          <img
                            src={file.url}
                            alt={file.fileName || ""}
                            className="w-16 h-16 object-cover rounded cursor-pointer"
                            onClick={() => setPreviewUrl(file.url)}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{file.fileName || "-"}</div>
                        <div className="text-sm text-muted-foreground">{file.customerName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            file.type === "photo"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {file.type === "photo" ? "รูปภาพ" : "เอกสาร"}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(file.createdAt)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => setDeleteTarget({ id: file.id, type: file.type, fileName: file.fileName })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                หน้า {page} จาก {totalPages} ({total} ไฟล์)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              ยืนยันการลบไฟล์
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบ "{deleteTarget?.fileName || "ไฟล์นี้"}" หรือไม่? การลบจะไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ id: deleteTarget.id, type: deleteTarget.type as "photo" | "document" });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "กำลังลบ..." : "ลบไฟล์"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              ยืนยันการลบหลายไฟล์
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบ {selectedIds.size} ไฟล์ที่เลือกหรือไม่? การลบจะไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>ยกเลิก</Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "กำลังลบ..." : `ลบ ${selectedIds.size} ไฟล์`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
