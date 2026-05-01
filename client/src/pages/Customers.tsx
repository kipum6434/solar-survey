import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { SourceCombobox } from "@/components/SourceCombobox";
import { useState, useMemo, useCallback } from "react";
import { useSort } from "@/hooks/useSort";
import { formatPhone, formatPhoneInput } from "@/lib/formatPhone";
import { Pagination } from "@/components/Pagination";
import { SortableHeader } from "@/components/SortableHeader";
import { StatusDropdown } from "@/components/StatusDropdown";
import { useLocation } from "wouter";
import {
  Users, Plus, Search, Phone, MapPin, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, Eye,
  LayoutList, Table2, Zap, FileUp, Download, ExternalLink, X, MessageSquareText, Sparkles, Loader2, ClipboardPaste,
  ClipboardCopy, FileText, Check, AlertTriangle,
} from "lucide-react";
import { StickyScrollbar } from "@/components/StickyScrollbar";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export default function Customers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [showImport, setShowImport] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [importDuplicates, setImportDuplicates] = useState<{ phone: string; existingCustomer: string; existingId: number }[]>([]);
  const [pendingImportData, setPendingImportData] = useState<any[] | null>(null);

  const importMutation = trpc.customer.importBatch.useMutation({
    onSuccess: (result) => {
      if (result.hasDuplicates && result.duplicateWarnings.length > 0) {
        // Show duplicate warnings, don't close dialog
        setImportDuplicates(result.duplicateWarnings);
        toast.warning(`พบเบอร์โทรซ้ำ ${result.duplicateWarnings.length} รายการ`);
        return;
      }
      toast.success(`นำเข้าสำเร็จ ${result.successCount} รายการ` + (result.errorCount > 0 ? ` (ผิดพลาด ${result.errorCount})` : ""));
      if (result.errors.length > 0) {
        result.errors.forEach(e => toast.error(e));
      }
      setShowImport(false);
      setImportDuplicates([]);
      setPendingImportData(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Filters
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterByMonth, setFilterByMonth] = useState(false);
  const [districtFilter, setDistrictFilter] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: distinctValues } = trpc.customer.distinctValues.useQuery();
  const { data: teamMembersForImport } = trpc.teamMember.listAll.useQuery();
  // Cache team data for import mapping
  if (teamMembersForImport) (window as any).__teamSurveyorsCache = teamMembersForImport;

  const queryInput = useMemo(() => ({
    search,
    page,
    limit: 50,
    month: filterByMonth ? selectedMonth : undefined,
    year: filterByMonth ? selectedYear : undefined,
    district: districtFilter || undefined,
    province: provinceFilter || undefined,
    source: sourceFilter || undefined,
    surveyStatus: statusFilter || undefined,
  }), [search, page, filterByMonth, selectedMonth, selectedYear, districtFilter, provinceFilter, sourceFilter, statusFilter]);

  const { data, isLoading, refetch } = trpc.customer.list.useQuery(queryInput);
  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => { toast.success("เพิ่มลูกค้าสำเร็จ"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => { toast.success("ลบลูกค้าสำเร็จ"); setDeleteId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkDeleteMutation = trpc.customer.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`ลบลูกค้า ${result.deleted} รายการสำเร็จ`);
      setSelectedIds(new Set());
      setShowBulkDelete(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 50);

  // Export selected customers to Excel
  const handleExportSelected = useCallback(() => {
    if (!data?.data || selectedIds.size === 0) return;
    const selected = data.data.filter((c: any) => selectedIds.has(c.id));
    if (selected.length === 0) { toast.error("ไม่พบข้อมูลที่เลือก"); return; }
    const headers = ["ชื่อลูกค้า", "เบอร์โทร", "ที่อยู่", "โลเคชั่น", "ช่องทาง", "คนส่งสำรวจ", "เขต/อำเภอ", "จังหวัด", "ค่าไฟ/เดือน", "ประเภทหลังคา", "ระบบไฟ", "ชื่อ FB", "หมายเหตุ", "สถานะ", "วันที่สร้าง"];
    const rows = selected.map((c: any) => ({
      "ชื่อลูกค้า": c.name || "",
      "เบอร์โทร": c.phone || "",
      "ที่อยู่": c.fullAddress || "",
      "โลเคชั่น": c.address || "",
      "ช่องทาง": c.source || "",
      "คนส่งสำรวจ": c.surveyorName || "",
      "เขต/อำเภอ": c.district || "",
      "จังหวัด": c.province || "",
      "ค่าไฟ/เดือน": c.electricityBill || "",
      "ประเภทหลังคา": c.roofType || "",
      "ระบบไฟ": c.phaseType === "single" ? "1 เฟส" : c.phaseType === "three" ? "3 เฟส" : "",
      "ชื่อ FB": c.facebookName || "",
      "หมายเหตุ": c.notes || "",
      "สถานะ": c.surveyStatus === "no_survey" ? "ยังไม่นัดสำรวจ" : c.surveyStatus === "scheduled" ? "นัดสำรวจแล้ว" : c.surveyStatus === "surveyed" ? "สำรวจเสร็จ" : c.surveyStatus === "won" ? "ปิดการขาย" : c.surveyStatus || "",
      "วันที่สร้าง": c.createdAt ? new Date(c.createdAt).toLocaleDateString("th-TH") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ลูกค้า");
    XLSX.writeFile(wb, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Export สำเร็จ ${selected.length} รายการ`);
  }, [data, selectedIds]);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const handleMonthNav = (dir: -1 | 1) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
    setFilterByMonth(true);
    setPage(1);
  };

  // Bulk selection handlers
  const currentPageIds = useMemo(() => data?.data?.map((c: any) => c.id) || [], [data]);

  const allSelected = currentPageIds.length > 0 && currentPageIds.every((id: number) => selectedIds.has(id));
  const someSelected = currentPageIds.some((id: number) => selectedIds.has(id)) && !allSelected;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        currentPageIds.forEach((id: number) => next.delete(id));
      } else {
        currentPageIds.forEach((id: number) => next.add(id));
      }
      return next;
    });
  }, [allSelected, currentPageIds]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ลูกค้า</h1>
            <p className="text-sm text-muted-foreground mt-1">จัดการข้อมูลลูกค้าทั้งหมด</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowTemplate(true)} className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
              <FileText className="h-4 w-4" /> Template ขอข้อมูล
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
              <FileUp className="h-4 w-4" /> Import Excel
            </Button>
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="h-4 w-4" /> เพิ่มลูกค้า
            </Button>
          </div>
        </div>

        {/* Month Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            variant={!filterByMonth ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilterByMonth(false); setPage(1); }}
            className="shrink-0"
          >
            ทั้งหมด
          </Button>
          <div className="h-6 w-px bg-border shrink-0" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleMonthNav(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {THAI_MONTHS_SHORT.map((m, i) => (
            <Button
              key={i}
              variant={filterByMonth && selectedMonth === i + 1 ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectedMonth(i + 1); setFilterByMonth(true); setPage(1); }}
              className="shrink-0 text-xs px-2.5"
            >
              {m}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleMonthNav(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); if (filterByMonth) setPage(1); }}>
            <SelectTrigger className="w-[100px] h-8 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search + Filters + View Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ, เบอร์โทร..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter || "_all"} onValueChange={(v) => { setStatusFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">สถานะทั้งหมด</SelectItem>
              <SelectItem value="no_survey">ยังไม่นัดสำรวจ</SelectItem>
              <SelectItem value="pending">รอดำเนินการ</SelectItem>
              <SelectItem value="scheduled">นัดสำรวจแล้ว</SelectItem>
              <SelectItem value="surveyed">สำรวจเสร็จ</SelectItem>
              <SelectItem value="won">ปิดการขาย</SelectItem>
              <SelectItem value="lost">ไม่สำเร็จ</SelectItem>
            </SelectContent>
          </Select>
          <Select value={provinceFilter || "_all"} onValueChange={(v) => { setProvinceFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="จังหวัด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">จังหวัดทั้งหมด</SelectItem>
              {(distinctValues?.provinces ?? []).map((p: string) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={districtFilter || "_all"} onValueChange={(v) => { setDistrictFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="เขต/อำเภอ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">เขต/อำเภอทั้งหมด</SelectItem>
              {(distinctValues?.districts ?? []).map((d: string) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter || "_all"} onValueChange={(v) => { setSourceFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="แหล่งที่มา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">แหล่งที่มาทั้งหมด</SelectItem>
              {(distinctValues?.sources ?? []).map((s: string) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 flex-1">
              <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-destructive" />
              </div>
              <span className="text-sm font-medium">
                เลือกแล้ว <span className="text-destructive font-bold">{selectedIds.size}</span> รายการ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5" /> ยกเลิก
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportSelected} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> ลบ {selectedIds.size} รายการ
              </Button>
            </div>
          </div>
        )}

        {/* Filter info */}
        <div className="text-sm text-muted-foreground">
          {filterByMonth ? (
            <>
              แสดงลูกค้าที่สร้างในเดือน <span className="font-semibold text-foreground">{THAI_MONTHS[selectedMonth - 1]} {selectedYear + 543}</span>
              {data && <span className="ml-2">({data.total} ราย)</span>}
            </>
          ) : (
            <>
              ลูกค้าทั้งหมด
              {data && <span className="ml-1 font-semibold text-foreground">({data.total} ราย)</span>}
            </>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <>
            {viewMode === "table" ? (
              <CustomerTableView
                data={data.data}
                onRowClick={(id) => setLocation(`/customers/${id}`)}
                onEdit={(id) => setLocation(`/customers/${id}?edit=true`)}
                onDelete={(id) => setDeleteId(id)}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                allSelected={allSelected}
                someSelected={someSelected}
                onRefetch={refetch}
              />
            ) : (
              <CustomerGridView
                data={data.data}
                onRowClick={(id) => setLocation(`/customers/${id}`)}
                onEdit={(id) => setLocation(`/customers/${id}?edit=true`)}
                onDelete={(id) => setDeleteId(id)}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                allSelected={allSelected}
                someSelected={someSelected}
                onRefetch={refetch}
              />
            )}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={data?.total} />
          </>
        ) : (
          <div className="text-center py-16">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">{search || filterByMonth ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}</p>
            {!search && !filterByMonth && (
              <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> เพิ่มลูกค้าคนแรก
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Customer Dialog */}
      <AddCustomerDialog open={showAdd} onOpenChange={setShowAdd} onSubmit={(d) => createMutation.mutate(d)} loading={createMutation.isPending} />

      {/* Import Excel Dialog */}
      <ImportExcelDialog
        open={showImport}
        onOpenChange={(v) => { setShowImport(v); if (!v) { setImportDuplicates([]); setPendingImportData(null); } }}
        onImport={(customers) => {
              // Map surveyorName to surveyorId if team data available
              const teamData = (window as any).__teamSurveyorsCache;
              const mapped = customers.map(c => {
                if (c.surveyorName && teamData) {
                  const found = teamData.find((t: any) => t.name === c.surveyorName);
                  if (found) return { ...c, surveyorId: found.id, surveyorName: undefined };
                }
                const { surveyorName: _, ...rest } = c;
                return rest;
              });
              setPendingImportData(mapped);
              importMutation.mutate({ customers: mapped });
            }}
        onForceImport={() => { if (pendingImportData) importMutation.mutate({ customers: pendingImportData, skipDuplicateCheck: true }); }}
        loading={importMutation.isPending}
        duplicateWarnings={importDuplicates}
      />

      {/* Customer Info Template Dialog */}
      <CustomerTemplateDialog open={showTemplate} onOpenChange={setShowTemplate} />

      {/* Single Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>คุณต้องการลบลูกค้ารายนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบหลายรายการ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบลูกค้า <span className="font-bold text-destructive">{selectedIds.size} รายการ</span> หรือไม่?
              <br />
              <span className="text-xs mt-1 block">งานสำรวจ, รูปภาพ, เอกสาร และข้อมูลที่เกี่ยวข้องทั้งหมดจะถูกลบด้วย การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "กำลังลบ..." : `ลบ ${selectedIds.size} รายการ`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

/* ==================== TABLE VIEW ==================== */
interface TableViewProps {
  data: any[];
  onRowClick: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  onRefetch: () => void;
}

function CustomerTableView({ data, onRowClick, onEdit, onDelete, selectedIds, onToggleSelect, onToggleSelectAll, allSelected, someSelected, onRefetch }: TableViewProps) {
  const { sortedData, sortConfig, requestSort } = useSort(data);

  return (
    <div className="border rounded-lg overflow-hidden">
      <StickyScrollbar>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-3 py-2.5 w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={onToggleSelectAll}
                  aria-label="เลือกทั้งหมด"
                />
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="ชื่อลูกค้า" sortKey="name" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="เบอร์โทร" sortKey="phone" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell"><SortableHeader label="ที่อยู่" sortKey="fullAddress" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell"><SortableHeader label="โลเคชั่น" sortKey="address" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell"><SortableHeader label="ช่องทาง" sortKey="source" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell"><SortableHeader label="คนส่งสำรวจ" sortKey="surveyorName" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell"><SortableHeader label="เขต/อำเภอ" sortKey="district" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell"><SortableHeader label="จังหวัด" sortKey="province" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell"><SortableHeader label="ค่าไฟ/เดือน" sortKey="electricityBill" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell"><SortableHeader label="ประเภทหลังคา" sortKey="roofType" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell"><SortableHeader label="ระบบไฟ" sortKey="phaseType" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell"><SortableHeader label="หมายเหตุ" sortKey="notes" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell"><SortableHeader label="วันที่สร้าง" sortKey="createdAt" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="สถานะ" sortKey="surveyStatus" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((c: any) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <tr
                  key={c.id}
                  className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                  onClick={() => onRowClick(c.id)}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(c.id)}
                      aria-label={`เลือก ${c.name}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium max-w-[200px] truncate">
                    {c.name}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatPhone(c.phone)}
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px] truncate hidden md:table-cell text-muted-foreground">
                    {c.fullAddress || "-"}
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px] truncate hidden md:table-cell text-muted-foreground">
                    {c.address ? (
                      c.address.startsWith("http") ? (
                        <a href={c.address} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 active:bg-primary/30 touch-manipulation">
                          <ExternalLink className="h-3 w-3" /> เปิดแผนที่
                        </a>
                      ) : <span className="truncate">{c.address}</span>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
                    {c.source ? (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {c.source || "-"}
                      </Badge>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell text-muted-foreground text-xs">
                    {c.surveyorName || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground">
                    {c.district || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground">
                    {c.province || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell">
                    {c.electricityBill ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Zap className="h-3 w-3" />
                        {Number(c.electricityBill).toLocaleString()} ฿
                      </span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell text-muted-foreground text-xs">
                    {c.roofType || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell text-muted-foreground text-xs">
                    {c.phaseType === "single" ? "1 เฟส" : c.phaseType === "three" ? "3 เฟส" : "-"}
                  </td>
                  <td className="px-3 py-2.5 max-w-[150px] truncate hidden xl:table-cell text-muted-foreground text-xs">
                    {c.notes || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell text-muted-foreground text-xs">
                    {new Date(c.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <StatusDropdown
                      type="customer"
                      entityId={c.id}
                      currentStatusId={c.statusId || null}
                      currentCustomStatus={c.customStatus || null}
                      fallbackLabel={STATUS_CONFIG[c.surveyStatus]?.label || "ยังไม่นัดสำรวจ"}
                      fallbackColor={STATUS_FALLBACK_COLORS[c.surveyStatus]?.color}
                      fallbackBgColor={STATUS_FALLBACK_COLORS[c.surveyStatus]?.bg}
                      onStatusChanged={onRefetch}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onRowClick(c.id)}>
                          <Eye className="h-4 w-4 mr-2" /> ดูรายละเอียด
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(c.id)}>
                          <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(c.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> ลบ
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </StickyScrollbar>
    </div>
  );
}

/* ==================== STATUS CONFIG ==================== */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  no_survey: { label: "ยังไม่นัดสำรวจ", className: "bg-gray-100 text-gray-700 border-gray-200" },
  pending: { label: "รอดำเนินการ", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  scheduled: { label: "นัดสำรวจแล้ว", className: "bg-blue-50 text-blue-700 border-blue-200" },
  surveyed: { label: "สำรวจเสร็จ", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  won: { label: "ปิดการขาย", className: "bg-green-50 text-green-700 border-green-200" },
  lost: { label: "ไม่สำเร็จ", className: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_FALLBACK_COLORS: Record<string, { color: string; bg: string }> = {
  no_survey: { color: "#78716c", bg: "#f5f5f4" },
  pending: { color: "#d97706", bg: "#fffbeb" },
  scheduled: { color: "#1d4ed8", bg: "#eff6ff" },
  surveyed: { color: "#4338ca", bg: "#eef2ff" },
  won: { color: "#15803d", bg: "#dcfce7" },
  lost: { color: "#dc2626", bg: "#fef2f2" },
};

/* ==================== GRID VIEW ==================== */
function CustomerGridView({ data, onRowClick, onEdit, onDelete, selectedIds, onToggleSelect, onToggleSelectAll, allSelected, someSelected, onRefetch }: TableViewProps) {
  return (
    <div className="space-y-3">
      {/* Select all bar for grid view */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onToggleSelectAll}
          aria-label="เลือกทั้งหมด"
        />
        <span className="text-xs text-muted-foreground">เลือกทั้งหมด</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((customer: any) => {
          const isSelected = selectedIds.has(customer.id);
          return (
            <Card
              key={customer.id}
              className={`border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group ${isSelected ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
              onClick={() => onRowClick(customer.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(customer.id)}
                        aria-label={`เลือก ${customer.name}`}
                      />
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{customer.name}</p>
                      {customer.source && (
                        <Badge variant="secondary" className="text-[10px] mt-1 font-normal">
                          {customer.source || "-"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRowClick(customer.id); }}>
                        <Eye className="h-4 w-4 mr-2" /> ดูรายละเอียด
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(customer.id); }}>
                        <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(customer.id); }}>
                        <Trash2 className="h-4 w-4 mr-2" /> ลบ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {customer.phone && (
                    <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{formatPhone(customer.phone)}</div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {customer.address.startsWith("http") ? (
                        <a href={customer.address} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 active:bg-primary/30 touch-manipulation">
                          <ExternalLink className="h-3 w-3" /> เปิดแผนที่
                        </a>
                      ) : <span className="truncate">{customer.address}</span>}
                    </div>
                  )}
                </div>
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <StatusDropdown
                    type="customer"
                    entityId={customer.id}
                    currentStatusId={customer.statusId || null}
                    currentCustomStatus={customer.customStatus || null}
                    fallbackLabel={STATUS_CONFIG[customer.surveyStatus]?.label || "ยังไม่นัดสำรวจ"}
                    fallbackColor={STATUS_FALLBACK_COLORS[customer.surveyStatus]?.color}
                    fallbackBgColor={STATUS_FALLBACK_COLORS[customer.surveyStatus]?.bg}
                    onStatusChanged={onRefetch}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ==================== ADD CUSTOMER DIALOG ==================== */
function AddCustomerDialog({ open, onOpenChange, onSubmit, loading }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", district: "", province: "", source: "other" as string, notes: "", electricityBill: "", roofType: "", phaseType: "" as string, fullAddress: "", facebookName: "", surveyorId: null as number | null });
  const { data: teamSurveyors } = trpc.teamMember.listAll.useQuery();
  const [showLinePaste, setShowLinePaste] = useState(false);
  const [lineText, setLineText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: number; name: string; phone: string | null }[] | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const trpcUtils = trpc.useUtils();

  const handlePhoneBlur = async () => {
    const raw = form.phone.replace(/[\s\-\.]/g, "");
    if (raw.length < 3) { setDuplicateWarning(null); return; }
    setCheckingDuplicate(true);
    try {
      const result = await trpcUtils.customer.checkDuplicate.fetch({ phone: raw });
      if (result && result.duplicates.length > 0) {
        setDuplicateWarning(result.duplicates);
      } else {
        setDuplicateWarning(null);
      }
    } catch { setDuplicateWarning(null); }
    setCheckingDuplicate(false);
  };

  const parseMutation = trpc.lineParser.parse.useMutation({
    onSuccess: (data) => {
      setParsedPreview(data);
      toast.success("AI แยกข้อมูลสำเร็จ! ตรวจสอบแล้วกดยืนยัน");
    },
    onError: (e) => toast.error("ไม่สามารถแยกข้อมูลได้: " + e.message),
  });

  const handleParseLine = () => {
    if (!lineText.trim()) { toast.error("กรุณาวางข้อความจาก LINE"); return; }
    setParsedPreview(null);
    parseMutation.mutate({ text: lineText.trim() });
  };

  const handleApplyParsed = () => {
    if (!parsedPreview) return;
    setForm(prev => ({
      ...prev,
      name: parsedPreview.name || "",
      phone: parsedPreview.phone || "",
      address: parsedPreview.location || "",
      district: parsedPreview.district || "",
      province: parsedPreview.province || "",
      source: parsedPreview.source || "other",
      notes: parsedPreview.notes || "",
      electricityBill: parsedPreview.electricityBill || "",
      roofType: parsedPreview.roofType || "",
      phaseType: parsedPreview.phaseType === "single" || parsedPreview.phaseType === "three" ? parsedPreview.phaseType : "",
      fullAddress: parsedPreview.fullAddress || "",
      facebookName: parsedPreview.facebookName || "",
    }));
    setShowLinePaste(false);
    setLineText("");
    setParsedPreview(null);
    toast.success("กรอกข้อมูลอัตโนมัติแล้ว ตรวจสอบและกดบันทึก");
    // Trigger duplicate phone check for parsed phone
    if (parsedPreview.phone) {
      const rawPhone = parsedPreview.phone.replace(/[\s\-\.]/g, "");
      if (rawPhone.length >= 3) {
        setCheckingDuplicate(true);
        trpcUtils.customer.checkDuplicate.fetch({ phone: rawPhone }).then((res) => {
          if (res && res.duplicates.length > 0) setDuplicateWarning(res.duplicates);
          else setDuplicateWarning(null);
        }).catch(() => setDuplicateWarning(null)).finally(() => setCheckingDuplicate(false));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("กรุณาระบุชื่อลูกค้า"); return; }
    onSubmit({
      ...form,
      electricityBill: form.electricityBill || undefined,
      phaseType: form.phaseType || undefined,
      fullAddress: form.fullAddress || undefined,
      facebookName: form.facebookName || undefined,
      source: form.source as any,
      surveyorId: form.surveyorId || undefined,
    });
    setForm({ name: "", phone: "", address: "", district: "", province: "", source: "other", notes: "", electricityBill: "", roofType: "", phaseType: "", fullAddress: "", facebookName: "", surveyorId: null });
    setDuplicateWarning(null);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
          <DialogDescription>กรอกข้อมูลลูกค้าเพื่อเพิ่มเข้าสู่ระบบ</DialogDescription>
        </DialogHeader>

        {/* LINE Paste Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 border-dashed border-green-500 text-green-700 hover:bg-green-50 hover:text-green-800"
          onClick={() => setShowLinePaste(true)}
        >
          <MessageSquareText className="h-4 w-4" />
          วางข้อความจาก LINE (AI กรอกให้อัตโนมัติ)
        </Button>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>ชื่อลูกค้า *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div>
              <Label>เบอร์โทร</Label>
              <Input value={form.phone} onChange={(e) => { setForm({ ...form, phone: formatPhoneInput(e.target.value) }); setDuplicateWarning(null); }} onBlur={handlePhoneBlur} placeholder="0xx-xxx-xxxx" />
              {checkingDuplicate && <p className="text-xs text-muted-foreground mt-1">กำลังตรวจสอบ...</p>}
              {duplicateWarning && duplicateWarning.length > 0 && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    พบลูกค้าที่มีเบอร์นี้แล้ว!
                  </div>
                  {duplicateWarning.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-xs text-amber-800">
                      <span>{d.name} ({d.phone || '-'})</span>
                      <button type="button" className="text-primary underline" onClick={() => window.open(`/customers/${d.id}`, '_blank')}>ดูข้อมูล</button>
                    </div>
                  ))}
                  <p className="text-[10px] text-amber-600 mt-1">คุณยังสามารถกดบันทึกเพื่อเพิ่มซ้ำได้</p>
                </div>
              )}
            </div>
            <div>
              <Label>โลเคชั่น (Google Maps Link)</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="วางลิงก์ Google Maps หรือที่อยู่" />
            </div>
            <div className="col-span-2">
              <Label>ที่อยู่</Label>
              <Input value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน" />
            </div>
            <div>
              <Label>เขต/อำเภอ</Label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="เขต/อำเภอ" />
            </div>
            <div>
              <Label>จังหวัด</Label>
              <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="จังหวัด" />
            </div>
            <div>
              <Label>แหล่งที่มา</Label>
              <SourceCombobox value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
            </div>
            <div>
              <Label>ค่าไฟ/เดือน (บาท)</Label>
              <Input value={form.electricityBill} onChange={(e) => setForm({ ...form, electricityBill: e.target.value })} placeholder="เช่น 3000" type="number" />
            </div>
            <div>
              <Label>ประเภทหลังคา</Label>
              <Input value={form.roofType} onChange={(e) => setForm({ ...form, roofType: e.target.value })} placeholder="เช่น เมทัลชีท" />
            </div>
            <div>
              <Label>ระบบไฟฟ้า</Label>
              <Select value={form.phaseType} onValueChange={(v) => setForm({ ...form, phaseType: v })}>
                <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">1 เฟส</SelectItem>
                  <SelectItem value="three">3 เฟส</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>คนส่งสำรวจ</Label>
              <Select value={form.surveyorId ? String(form.surveyorId) : "_none"} onValueChange={(v) => setForm({ ...form, surveyorId: v === "_none" ? null : Number(v) })}>
                <SelectTrigger><SelectValue placeholder="เลือกคนส่งสำรวจ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">ยังไม่ระบุ</SelectItem>
                  {(teamSurveyors || []).map((m: any) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name} {m.role === "admin_sender" ? "(แอดมิน)" : m.role === "surveyor" ? "(ช่างสำรวจ)" : `(${m.role})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>ชื่อ Facebook</Label>
              <Input value={form.facebookName} onChange={(e) => setForm({ ...form, facebookName: e.target.value })} placeholder="ชื่อ FB ลูกค้า" />
            </div>
            <div className="col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="หมายเหตุเพิ่มเติม" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* LINE Paste Dialog */}
    <Dialog open={showLinePaste} onOpenChange={(v) => { setShowLinePaste(v); if (!v) { setParsedPreview(null); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-green-600" />
            วางข้อความจาก LINE
          </DialogTitle>
          <DialogDescription>
            Copy ข้อความจากแชท LINE แล้ววางที่นี่ AI จะแยกข้อมูลลูกค้าให้อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input Area */}
          <div>
            <Label className="text-sm font-medium">ข้อความจาก LINE</Label>
            <Textarea
              value={lineText}
              onChange={(e) => setLineText(e.target.value)}
              placeholder={`ตัวอย่าง:\nsave\n!26/03/2026\n!li\n!set\n!Tan\n\n!25/04/2026\n!12:00\n\n!คุณเอนธรรม\n!0816158109\n!85 จรัญสนิทวงศ์ 69 แขวงบางพลัด บางพลัด กรุงเทพมหานคร 10700\n!https://maps.app.goo.gl/...`}
              rows={8}
              className="font-mono text-sm mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              วาง (Ctrl+V / Cmd+V) ข้อความจาก LINE ได้เลย ไม่ต้องจัดรูปแบบ
            </p>
          </div>

          {/* Parse Button */}
          <Button
            onClick={handleParseLine}
            disabled={parseMutation.isPending || !lineText.trim()}
            className="w-full gap-2"
          >
            {parseMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> AI กำลังวิเคราะห์...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> วิเคราะห์ข้อความด้วย AI</>
            )}
          </Button>

          {/* Preview Results */}
          {parsedPreview && (
            <div className="rounded-lg border bg-green-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                <Sparkles className="h-4 w-4" />
                ผลการวิเคราะห์ — ตรวจสอบแล้วกดยืนยัน
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {[
                  { label: "ชื่อลูกค้า", value: parsedPreview.name },
                  { label: "เบอร์โทร", value: parsedPreview.phone },
                  { label: "ที่อยู่", value: parsedPreview.fullAddress },
                  { label: "เขต/อำเภอ", value: parsedPreview.district },
                  { label: "จังหวัด", value: parsedPreview.province },
                  { label: "รหัสไปรษณีย์", value: parsedPreview.postalCode },
                  { label: "โลเคชั่น", value: parsedPreview.location },
                  { label: "วันนัดสำรวจ", value: parsedPreview.scheduledDate },
                  { label: "เวลา", value: parsedPreview.scheduledTime },
                  { label: "แหล่งที่มา", value: parsedPreview.source },
                  { label: "ค่าไฟ/เดือน", value: parsedPreview.electricityBill },
                  { label: "ประเภทหลังคา", value: parsedPreview.roofType },
                  { label: "ระบบไฟ", value: parsedPreview.phaseType === "single" ? "1 เฟส" : parsedPreview.phaseType === "three" ? "3 เฟส" : parsedPreview.phaseType },
                  { label: "ชื่อ Facebook", value: parsedPreview.facebookName },
                  { label: "หมายเหตุ", value: parsedPreview.notes },
                ].map((item, i) => (
                  <div key={i} className={item.label === "ที่อยู่" || item.label === "โลเคชั่น" || item.label === "หมายเหตุ" ? "col-span-1 sm:col-span-2" : ""}>
                    <span className="text-muted-foreground">{item.label}: </span>
                    <span className={item.value ? "font-medium" : "text-muted-foreground italic"}>
                      {item.value || "ไม่พบข้อมูล"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setShowLinePaste(false); setParsedPreview(null); }}>
            ยกเลิก
          </Button>
          {parsedPreview && (
            <Button onClick={handleApplyParsed} className="gap-2">
              <ClipboardPaste className="h-4 w-4" /> ใช้ข้อมูลนี้
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}


/* ==================== IMPORT EXCEL DIALOG ==================== */
const COLUMN_MAP: Record<string, string> = {
  "ชื่อลูกค้า": "name", "ชื่อ": "name", "name": "name", "ชื่อ-นามสกุล": "name",
  "เบอร์โทร": "phone", "โทร": "phone", "phone": "phone", "เบอร์": "phone", "เบอร์โทรศัพท์": "phone",
  "อีเมล": "email", "email": "email", "e-mail": "email",
  "โลเคชั่น": "address", "location": "address", "address": "address",
  "ที่อยู่": "fullAddress", "full_address": "fullAddress", "บ้านเลขที่": "fullAddress",
  "จังหวัด": "province", "province": "province",
  "เขต": "district", "อำเภอ": "district", "เขต/อำเภอ": "district", "district": "district",
  "แหล่งที่มา": "source", "ช่องทาง": "source", "source": "source",
  "ค่าไฟ": "electricityBill", "ค่าไฟ/เดือน": "electricityBill", "electricity": "electricityBill", "bill": "electricityBill",
  "ประเภทหลังคา": "roofType", "หลังคา": "roofType", "roof": "roofType",
  "ระบบไฟฟ้า": "phaseType", "เฟส": "phaseType", "phase": "phaseType",
  "ขนาดมิเตอร์": "meterSize", "มิเตอร์": "meterSize", "meter": "meterSize",
  "ชื่อ FB": "facebookName", "ชื่อ Facebook": "facebookName", "facebook": "facebookName", "facebookName": "facebookName", "ชื่อเฟส": "facebookName", "fb": "facebookName",
  "คนส่งสำรวจ": "surveyorName", "surveyor": "surveyorName", "ผู้สำรวจ": "surveyorName", "Admin": "surveyorName",
  "หมายเหตุ": "notes", "notes": "notes", "note": "notes",
};

function normalizePhaseType(val: string): "single" | "three" | undefined {
  if (!val) return undefined;
  const v = val.toLowerCase().trim();
  if (v.includes("3") || v.includes("three") || v.includes("สาม")) return "three";
  if (v.includes("1") || v.includes("single") || v.includes("เดียว")) return "single";
  return undefined;
}

function ImportExcelDialog({ open, onOpenChange, onImport, onForceImport, loading, duplicateWarnings }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (customers: any[]) => void;
  onForceImport: () => void;
  loading: boolean;
  duplicateWarnings: { phone: string; existingCustomer: string; existingId: number }[];
}) {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setParsedData([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

        if (jsonData.length === 0) {
          setError("ไฟล์ไม่มีข้อมูล");
          return;
        }

        // Map columns
        const headers = Object.keys(jsonData[0]);
        const mapping: Record<string, string> = {};
        headers.forEach(h => {
          const normalized = h.trim().toLowerCase();
          for (const [key, val] of Object.entries(COLUMN_MAP)) {
            if (key.toLowerCase() === normalized) {
              mapping[h] = val;
              break;
            }
          }
        });

        const customers = jsonData
          .map(row => {
            const mapped: Record<string, any> = {};
            for (const [origCol, fieldName] of Object.entries(mapping)) {
              const val = String(row[origCol] ?? "").trim();
              if (val) {
                if (fieldName === "phaseType") {
                  mapped[fieldName] = normalizePhaseType(val);
                } else {
                  mapped[fieldName] = val;
                }
              }
            }
            return mapped;
          })
          .filter(c => c.name);

        if (customers.length === 0) {
          setError("ไม่พบคอลัมน์ \"ชื่อลูกค้า\" หรือ \"name\" ในไฟล์ กรุณาตรวจสอบหัวคอลัมน์");
          return;
        }

        setParsedData(customers);
      } catch {
        setError("ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel (.xlsx, .xls)");
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["ชื่อลูกค้า", "เบอร์โทร", "ที่อยู่", "โลเคชั่น", "เขต/อำเภอ", "จังหวัด", "แหล่งที่มา", "ค่าไฟ/เดือน", "ประเภทหลังคา", "ระบบไฟฟ้า", "คนส่งสำรวจ", "ชื่อ FB", "หมายเหตุ"],
      ["สมชาย ใจดี", "0812345678", "48/22 มบ.เมืองประชา ถนนหทัยราษฎร์", "https://maps.google.com/...", "คลองสามวา", "กรุงเทพ", "FB เพจ SET", "3500", "เมทัลชีท", "3 เฟส", "กุลธิดา บุนนาค", "Somchai Jaidi", "สนใจติดตั้ง 10kW"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ลูกค้า");
    XLSX.writeFile(wb, "template_import_customers.xlsx");
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            นำเข้าข้อมูลลูกค้าจาก Excel
          </DialogTitle>
          <DialogDescription>
            อัพโหลดไฟล์ Excel (.xlsx, .xls) ที่มีข้อมูลลูกค้า ระบบจะจับคู่คอลัมน์อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Download className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">ดาวน์โหลดไฟล์ตัวอย่าง</p>
              <p className="text-xs text-blue-700">ใช้เป็นแม่แบบสำหรับเตรียมข้อมูล</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
              <Download className="h-4 w-4 mr-1" /> ดาวน์โหลด
            </Button>
          </div>

          {/* File Upload */}
          <div>
            <Label>เลือกไฟล์ Excel</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="mt-1"
            />
            {fileName && <p className="text-xs text-muted-foreground mt-1">ไฟล์: {fileName}</p>}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">ตัวอย่างข้อมูล ({parsedData.length} รายการ)</p>
                <Badge variant="secondary">{parsedData.length} รายการ</Badge>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-2 py-1.5 font-medium">#</th>
                        <th className="text-left px-2 py-1.5 font-medium">ชื่อ</th>
                        <th className="text-left px-2 py-1.5 font-medium">เบอร์โทร</th>
                        <th className="text-left px-2 py-1.5 font-medium">โลเคชั่น</th>
                        <th className="text-left px-2 py-1.5 font-medium">จังหวัด</th>
                        <th className="text-left px-2 py-1.5 font-medium">แหล่งที่มา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1.5 font-medium">{row.name}</td>
                          <td className="px-2 py-1.5">{formatPhone(row.phone)}</td>
                          <td className="px-2 py-1.5 max-w-[150px] truncate">{row.address || "-"}</td>
                          <td className="px-2 py-1.5">{row.province || "-"}</td>
                          <td className="px-2 py-1.5">{row.source || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 10 && (
                  <div className="text-center py-1.5 text-xs text-muted-foreground bg-muted/30 border-t">
                    ...และอีก {parsedData.length - 10} รายการ
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Duplicate Warnings */}
        {duplicateWarnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-amber-700 text-sm font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              พบเบอร์โทรซ้ำกับลูกค้าที่มีอยู่แล้ว {duplicateWarnings.length} รายการ
            </div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {duplicateWarnings.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-800">
                  <span>เบอร์ {d.phone} → {d.existingCustomer}</span>
                  <button type="button" className="text-primary underline" onClick={() => window.open(`/customers/${d.existingId}`, '_blank')}>ดูข้อมูล</button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-amber-600 mt-2">กด "นำเข้าทั้งหมด" เพื่อ import ต่อโดยข้ามการตรวจซ้ำ</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>ยกเลิก</Button>
          {duplicateWarnings.length > 0 ? (
            <Button
              onClick={onForceImport}
              disabled={loading}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {loading ? "กำลังนำเข้า..." : `นำเข้าทั้งหมด ${parsedData.length} รายการ`}
            </Button>
          ) : (
            <Button
              onClick={() => onImport(parsedData)}
              disabled={parsedData.length === 0 || loading}
              className="gap-2"
            >
              {loading ? "กำลังนำเข้า..." : `นำเข้า ${parsedData.length} รายการ`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ─── Customer Info Template Dialog ─── */
function CustomerTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [copied, setCopied] = useState(false);

  const TEMPLATE_TEXT = `📋 ข้อมูลลูกค้าใหม่
ชื่อ : 
เบอร์ : 
ที่อยู่ : 
เขต/อำเภอ : 
จังหวัด : 
โลเคชั่น : (วาง Google Maps link)
ค่าไฟ/เดือน : 
ประเภทหลังคา : 
ระบบไฟ : 1 เฟส / 3 เฟส
แหล่งที่มา : FB เพจ ___ / LINE / แนะนำ
คนส่งสำรวจ : 
ชื่อ FB : 
หมายเหตุ : `;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE_TEXT);
      setCopied(true);
      toast.success("คัดลอก Template แล้ว วางในไลน์/FB ได้เลย!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = TEMPLATE_TEXT;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success("คัดลอก Template แล้ว วางในไลน์/FB ได้เลย!");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Template ขอข้อมูลลูกค้า
          </DialogTitle>
          <DialogDescription>
            Copy ข้อความนี้ไปส่งให้แอดมิน/ทีมงาน เพื่อขอข้อมูลลูกค้าให้ครบถ้วน
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Preview */}
          <div className="relative">
            <div className="bg-muted/50 border rounded-lg p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
              {TEMPLATE_TEXT}
            </div>
          </div>

          {/* Info */}
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-800 dark:text-green-300 font-medium mb-1">วิธีใช้</p>
            <ol className="text-xs text-green-700 dark:text-green-400 space-y-1 list-decimal list-inside">
              <li>กดปุ่ม <strong>"คัดลอก Template"</strong> ด้านล่าง</li>
              <li>วาง (Paste) ในแชท LINE หรือ Facebook Messenger</li>
              <li>ให้แอดมินกรอกข้อมูลลูกค้าตาม Template</li>
              <li>เมื่อได้ข้อมูลกลับมา ใช้ปุ่ม <strong>"วางข้อความจาก LINE"</strong> ในหน้าเพิ่มลูกค้า เพื่อให้ AI กรอกให้อัตโนมัติ</li>
            </ol>
          </div>

          {/* Required fields info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>ข้อมูลที่ต้องมี:</strong> ชื่อ, เบอร์, ที่อยู่, โลเคชั่น</p>
            <p><strong>ข้อมูลที่ควรมี:</strong> เขต/อำเภอ, จังหวัด, ค่าไฟ/เดือน, ประเภทหลังคา, ระบบไฟ</p>
            <p><strong>ถ้ามี:</strong> แหล่งที่มา, ชื่อ FB, หมายเหตุ</p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ปิด
          </Button>
          <Button
            onClick={handleCopy}
            className={`gap-2 min-w-[160px] transition-all ${copied ? "bg-green-600 hover:bg-green-600" : "bg-green-600 hover:bg-green-700"}`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> คัดลอกแล้ว!
              </>
            ) : (
              <>
                <ClipboardCopy className="h-4 w-4" /> คัดลอก Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
