import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import { formatPhone } from "@/lib/formatPhone";
import { Pagination } from "@/components/Pagination";
import { StatusDropdown } from "@/components/StatusDropdown";
import { useState, useMemo, useCallback } from "react";
import { SortableHeader } from "@/components/SortableHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";
import { useSourceGroup } from "@/hooks/useSourceGroup";
import { toast } from "sonner";
import {
  Search, ClipboardList, Calendar as CalendarIcon, User, ChevronLeft, ChevronRight, Filter,
  LayoutList, Table2, Phone, MapPin, Download, Trash2, X, CalendarDays,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { StickyScrollbar } from "@/components/StickyScrollbar";
import type { DateRange } from "react-day-picker";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const SYSTEM_TYPE_MAP: Record<string, string> = {
  string: "String Inverter",
  micro: "Micro Inverter",
  both: "ทั้งสอง",
  hybrid: "Hybrid",
};

const BATTERY_MAP: Record<string, string> = {
  yes: "ต้องการ",
  no: "ไม่ต้องการ",
  undecided: "ยังไม่ตัดสินใจ",
};

export default function Surveys() {
  const [, setLocation] = useLocation();
  const sourceGroup = useSourceGroup();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [surveyorFilter, setSurveyorFilter] = useState("");
  const [adminSenderFilter, setAdminSenderFilter] = useState("");
  const [closerFilter, setCloserFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "table">("table");

  // Date filter state
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Server-side sort state
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  // Month/Year filter - default to current month
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterByMonth, setFilterByMonth] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // Fetch sources and team members for filter dropdowns
  const { data: sourcesData } = trpc.source.list.useQuery();
  const { data: teamSurveyorsData } = trpc.teamMember.list.useQuery({ role: "surveyor" });
  const { data: teamAdminSendersData } = trpc.teamMember.list.useQuery({ role: "admin_sender" });
  const { data: teamClosersData } = trpc.teamMember.list.useQuery({ role: "closer" });
  const { data: distinctValues } = trpc.customer.distinctValues.useQuery();
  const utils = trpc.useUtils();

  const queryInput = useMemo(() => ({
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    source: sourceFilter || undefined,
    sourceGroup,
    assignedTo: surveyorFilter ? Number(surveyorFilter) : undefined,
    adminSenderId: adminSenderFilter ? Number(adminSenderFilter) : undefined,
    closerId: closerFilter ? Number(closerFilter) : undefined,
    district: districtFilter || undefined,
    province: provinceFilter || undefined,
    page,
    limit: 50,
    month: filterByMonth && !filterDate ? selectedMonth : undefined,
    year: filterByMonth && !filterDate ? selectedYear : undefined,
    filterDate: filterDate ? filterDate.getTime() : undefined,
    filterDateEnd: filterDateEnd ? filterDateEnd.getTime() : undefined,
    sortBy: sortBy || undefined,
    sortDirection: sortDirection || undefined,
  }), [search, statusFilter, sourceFilter, surveyorFilter, adminSenderFilter, closerFilter, districtFilter, provinceFilter, page, filterByMonth, selectedMonth, selectedYear, filterDate, filterDateEnd, sortBy, sortDirection, sourceGroup]);

  const { data, isLoading, refetch } = trpc.survey.list.useQuery(queryInput);

  // Installation date mutation
  const updateInstallationDate = trpc.customStatus.updateInstallationDate.useMutation({
    onSuccess: () => { toast.success("บันทึกวันที่นัดติดตั้งสำเร็จ"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  // Scheduled date mutation (inline edit from table)
  const updateSurveyMutation = trpc.survey.update.useMutation({
    onSuccess: () => { toast.success("บันทึกวันที่สำรวจสำเร็จ"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const handleUpdateScheduledDate = useCallback((surveyId: number, date: number | null, time: string | null) => {
    updateSurveyMutation.mutate({ id: surveyId, scheduledDate: date ?? undefined, scheduledTime: time ?? undefined });
  }, [updateSurveyMutation]);

  const bulkDeleteMutation = trpc.survey.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`ลบงานสำรวจ ${result.deleted} รายการสำเร็จ`);
      setSelectedIds(new Set());
      setShowBulkDelete(false);
      utils.survey.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 50);

  // Server-side sort handler - cycles: asc -> desc -> null
  const handleServerSort = useCallback((key: string) => {
    if (sortBy === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortBy("");
        setSortDirection(null);
      }
    } else {
      setSortBy(key);
      setSortDirection("asc");
    }
    setPage(1);
  }, [sortBy, sortDirection]);

  const sortConfig = useMemo(() => ({ key: sortBy, direction: sortDirection }), [sortBy, sortDirection]);

  // Current page survey IDs for select-all
  const currentPageIds = useMemo(() => data?.data?.map((item: any) => item.survey.id) || [], [data]);
  const allSelected = currentPageIds.length > 0 && currentPageIds.every((id: number) => selectedIds.has(id));
  const someSelected = currentPageIds.some((id: number) => selectedIds.has(id)) && !allSelected;

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (currentPageIds.every((id: number) => prev.has(id))) {
        currentPageIds.forEach((id: number) => next.delete(id));
      } else {
        currentPageIds.forEach((id: number) => next.add(id));
      }
      return next;
    });
  }, [currentPageIds]);

  // Export Excel query
  const exportInput = useMemo(() => ({
    status: statusFilter === "all" ? undefined : statusFilter,
    source: sourceFilter || undefined,
    month: filterByMonth ? selectedMonth : undefined,
    year: filterByMonth ? selectedYear : undefined,
  }), [statusFilter, sourceFilter, filterByMonth, selectedMonth, selectedYear]);

  const { data: exportData, refetch: refetchExport } = trpc.survey.exportExcel.useQuery(exportInput, { enabled: false });

  const handleExport = useCallback(async () => {
    toast.info("กำลังเตรียมข้อมูล...");
    const result = await refetchExport();
    const rows = result.data;
    if (!rows || rows.length === 0) {
      toast.error("ไม่พบข้อมูลสำหรับ Export");
      return;
    }
    // Build XLSX with xlsx library
    const XLSX = await import("xlsx");
    const headers = [
      "ID", "วันที่นัด", "เวลา", "ชื่อลูกค้า", "เบอร์โทร", "อีเมล", "ที่อยู่", "เขต/อำเภอ", "จังหวัด",
      "ช่องทาง", "ค่าไฟ/เดือน", "ประเภทหลังคา", "ระบบไฟฟ้า", "ขนาดระบบ (kW)", "จำนวนแผง",
      "ยี่ห้อแผง", "รุ่นอินเวอร์เตอร์", "ประเภทระบบ", "แบตเตอรี่", "Optimizer",
      "ราคาประเมิน", "ราคาเสนอ", "เซลล์", "คนส่งสำรวจ", "คนปิดการขาย", "สถานะ", "หมายเหตุ",
    ];
    const xlsxRows = rows.map((item: any) => {
      const s = item.survey;
      const c = item.customer;
      const assigns = item.assignments || [];
      const surveyors = assigns.filter((a: any) => a.role === "surveyor").map((a: any) => a.userName).join(", ");
      const senders = assigns.filter((a: any) => a.role === "admin_sender").map((a: any) => a.userName).join(", ");
      const closers = assigns.filter((a: any) => a.role === "closer").map((a: any) => a.userName).join(", ");
      const statusLabel = (SURVEY_STATUS_MAP as any)[s.status]?.label || s.status;
      return {
        "ID": s.id,
        "วันที่นัด": s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString("th-TH") : "",
        "เวลา": s.scheduledTime || "",
        "ชื่อลูกค้า": c.name,
        "เบอร์โทร": c.phone || "",
        "อีเมล": c.email || "",
        "ที่อยู่": c.address || "",
        "เขต/อำเภอ": c.district || "",
        "จังหวัด": c.province || "",
        "ช่องทาง": c.source || "",
        "ค่าไฟ/เดือน": c.electricityBill || "",
        "ประเภทหลังคา": c.roofType || "",
        "ระบบไฟฟ้า": c.phaseType === "single" ? "1 เฟส" : c.phaseType === "three" ? "3 เฟส" : "",
        "ขนาดระบบ (kW)": s.systemSize || "",
        "จำนวนแผง": s.panelCount || "",
        "ยี่ห้อแผง": s.panelBrand || "",
        "รุ่นอินเวอร์เตอร์": s.inverterModel || "",
        "ประเภทระบบ": s.systemType ? (SYSTEM_TYPE_MAP as any)[s.systemType] || s.systemType : "",
        "แบตเตอรี่": s.needBattery ? (BATTERY_MAP as any)[s.needBattery] || s.needBattery : "",
        "Optimizer": s.needOptimizer ? (BATTERY_MAP as any)[s.needOptimizer] || s.needOptimizer : "",
        "ราคาเสนอ": s.quotedPrice || "",
        "เซลล์": surveyors,
        "คนส่งสำรวจ": senders,
        "คนปิดการขาย": closers,
        "สถานะ": statusLabel,
        "หมายเหตุ": s.surveyNotes || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(xlsxRows, { header: headers });
    // Set column widths
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานสำรวจ");
    XLSX.writeFile(wb, `survey-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Export สำเร็จ ${rows.length} รายการ`);
  }, [refetchExport, toast]);

  // Generate year options (current year +/- 3)
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

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">งานสำรวจ</h1>
            <p className="text-sm text-muted-foreground mt-1">จัดการงานสำรวจทั้งหมด</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </Button>
        </div>

        {/* Month Navigation Bar - like Excel tabs */}
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
              placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              {Object.entries(SURVEY_STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="แหล่งที่มา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">ทุกแหล่งที่มา</SelectItem>
              {(sourcesData || []).map((s: any) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Role filters */}
          <Select value={surveyorFilter} onValueChange={(v) => { setSurveyorFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="เซลล์" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">เซลล์ทั้งหมด</SelectItem>
              {(teamSurveyorsData || []).map((m: any) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={adminSenderFilter || "_all"} onValueChange={(v) => { setAdminSenderFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="คนส่งสำรวจ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">คนส่งทั้งหมด</SelectItem>
              {(teamAdminSendersData || []).map((m: any) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={closerFilter || "_all"} onValueChange={(v) => { setCloserFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="คนปิดการขาย" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">คนปิดทั้งหมด</SelectItem>
              {(teamClosersData || []).map((m: any) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={provinceFilter || "_all"} onValueChange={(v) => { setProvinceFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="จังหวัด" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">จังหวัดทั้งหมด</SelectItem>
              {(distinctValues?.provinces ?? []).map((p: string) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={districtFilter || "_all"} onValueChange={(v) => { setDistrictFilter(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="เขต/อำเภอ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">เขต/อำเภอทั้งหมด</SelectItem>
              {(distinctValues?.districts ?? []).map((d: string) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Date Picker */}
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button
                variant={filterDate ? "default" : "outline"}
                size="sm"
                className="h-9 text-xs gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {filterDate ? (
                  filterDateEnd ? (
                    <span>{format(filterDate, "d MMM", { locale: th })} - {format(filterDateEnd, "d MMM yy", { locale: th })}</span>
                  ) : (
                    <span>{format(filterDate, "d MMM yy", { locale: th })}</span>
                  )
                ) : (
                  <span>เลือกวันที่</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={filterDate ? { from: filterDate, to: filterDateEnd || filterDate } : undefined}
                onSelect={(range: DateRange | undefined) => {
                  if (range?.from) {
                    // Set start of day for from
                    const startOfDay = new Date(range.from);
                    startOfDay.setHours(0, 0, 0, 0);
                    setFilterDate(startOfDay);
                    if (range.to && range.to.getTime() !== range.from.getTime()) {
                      const endOfDay = new Date(range.to);
                      endOfDay.setHours(23, 59, 59, 999);
                      setFilterDateEnd(endOfDay);
                    } else {
                      setFilterDateEnd(undefined);
                    }
                    setFilterByMonth(false);
                    setPage(1);
                  } else {
                    setFilterDate(undefined);
                    setFilterDateEnd(undefined);
                  }
                }}
                locale={th}
                numberOfMonths={1}
              />
              {filterDate && (
                <div className="p-2 border-t flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      setFilterDate(undefined);
                      setFilterDateEnd(undefined);
                      setShowDatePicker(false);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    ล้างตัวกรองวันที่
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {filterDate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => { setFilterDate(undefined); setFilterDateEnd(undefined); }}
              title="ล้างตัวกรองวันที่"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode("list")}
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

        {/* Title bar showing current filter */}
        <div className="text-sm text-muted-foreground">
          {filterDate ? (
            <>
              แสดงงานสำรวจวันที่{" "}
              <span className="font-semibold text-foreground">
                {format(filterDate, "d MMMM yyyy", { locale: th })}
                {filterDateEnd && ` - ${format(filterDateEnd, "d MMMM yyyy", { locale: th })}`}
              </span>
              {data && <span className="ml-2">({data.total} รายการ)</span>}
            </>
          ) : filterByMonth ? (
            <>
              แสดงงานสำรวจเดือน <span className="font-semibold text-foreground">{THAI_MONTHS[selectedMonth - 1]} {selectedYear + 543}</span>
              {data && <span className="ml-2">({data.total} รายการ)</span>}
            </>
          ) : (
            <>
              งานสำรวจทั้งหมด
              {data && <span className="ml-1 font-semibold text-foreground">({data.total} รายการ)</span>}
            </>
          )}
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
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                ยกเลิก
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> ลบ {selectedIds.size} รายการ
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <>
            {viewMode === "table" ? (
              <SurveyTableView
                data={data.data}
                onRowClick={(id) => setLocation(`/surveys/${id}`)}
                onRefetch={refetch}
                onUpdateInstallationDate={(surveyId, date) => updateInstallationDate.mutate({ surveyId, installationDate: date })}
                onUpdateScheduledDate={handleUpdateScheduledDate}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                allSelected={allSelected}
                someSelected={someSelected}
                sortConfig={sortConfig}
                onSort={handleServerSort}
              />
            ) : (
              <SurveyListView
                data={data.data}
                onRowClick={(id) => setLocation(`/surveys/${id}`)}
                onRefetch={refetch}
                onUpdateInstallationDate={(surveyId, date) => updateInstallationDate.mutate({ surveyId, installationDate: date })}
                onUpdateScheduledDate={handleUpdateScheduledDate}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                allSelected={allSelected}
                someSelected={someSelected}
                sortConfig={sortConfig}
                onSort={handleServerSort}
              />
            )}
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={data?.total} />
          </>
        ) : (
          <div className="text-center py-16">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">{search || statusFilter !== "all" || filterByMonth ? "ไม่พบงานสำรวจที่ค้นหา" : "ยังไม่มีงานสำรวจ"}</p>
          </div>
        )}

        {/* Bulk Delete Confirm Dialog */}
        <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบหลายรายการ</AlertDialogTitle>
              <AlertDialogDescription>
                คุณต้องการลบงานสำรวจ <span className="font-bold text-destructive">{selectedIds.size} รายการ</span> หรือไม่?
                <br />
                <span className="text-xs mt-1 block">รูปภาพ, เอกสาร, การมอบหมาย และข้อมูลที่เกี่ยวข้องทั้งหมดจะถูกลบด้วย การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
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
      </div>
    </DashboardLayout>
  );
}

/* ==================== SURVEY STATUS FALLBACK COLORS ==================== */
const SURVEY_STATUS_FALLBACK: Record<string, { color: string; bg: string }> = {
  pending: { color: "#78716c", bg: "#f5f5f4" },
  scheduled: { color: "#1d4ed8", bg: "#eff6ff" },
  in_progress: { color: "#d97706", bg: "#fffbeb" },
  surveyed: { color: "#059669", bg: "#ecfdf5" },
  follow_up: { color: "#0891b2", bg: "#ecfeff" },
  quoted: { color: "#7c3aed", bg: "#f5f3ff" },
  negotiating: { color: "#ea580c", bg: "#fff7ed" },
  won: { color: "#15803d", bg: "#dcfce7" },
  lost: { color: "#dc2626", bg: "#fef2f2" },
  cancelled: { color: "#6b7280", bg: "#f3f4f6" },
};

/* ==================== SCHEDULED DATE CELL (inline edit) ==================== */
function ScheduledDateCell({ surveyId, currentDate, currentTime, onUpdate }: { surveyId: number; currentDate: number | null; currentTime: string | null; onUpdate: (surveyId: number, date: number | null, time: string | null) => void }) {
  const [dateStr, setDateStr] = useState(currentDate ? new Date(currentDate).toISOString().split("T")[0] : "");
  const [timeStr, setTimeStr] = useState(currentTime || "");
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onUpdate(surveyId, dateStr ? new Date(dateStr).getTime() : null, timeStr || null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-xs hover:text-primary transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {currentDate
            ? new Date(currentDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })
            : <span className="text-muted-foreground">-</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <p className="text-xs font-medium">วันที่สำรวจ</p>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="border rounded px-2 py-1 text-xs w-full"
          />
          <p className="text-xs font-medium">เวลา</p>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className="border rounded px-2 py-1 text-xs w-full"
          />
          <div className="flex gap-2">
            <button
              className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90"
              onClick={handleSave}
            >
              บันทึก
            </button>
            {currentDate && (
              <button
                className="text-xs text-destructive hover:underline"
                onClick={() => { onUpdate(surveyId, null, null); setOpen(false); }}
              >
                ลบ
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ==================== INSTALLATION DATE CELL ==================== */
function InstallationDateCell({ surveyId, currentDate, onUpdate }: { surveyId: number; currentDate: number | null; onUpdate: (surveyId: number, date: number | null) => void }) {
  const [dateStr, setDateStr] = useState(currentDate ? new Date(currentDate).toISOString().split("T")[0] : "");
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    if (dateStr) {
      onUpdate(surveyId, new Date(dateStr).getTime());
    } else {
      onUpdate(surveyId, null);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {currentDate
            ? new Date(currentDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })
            : <span className="text-muted-foreground/50">-</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <p className="text-xs font-medium">วันที่นัดติดตั้ง</p>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="border rounded px-2 py-1 text-xs w-full"
          />
          <div className="flex gap-2">
            <button
              className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90"
              onClick={handleSave}
            >
              บันทึก
            </button>
            {currentDate && (
              <button
                className="text-xs text-destructive hover:underline"
                onClick={() => { onUpdate(surveyId, null); setOpen(false); }}
              >
                ลบ
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ==================== SHARED PROPS TYPE ==================== */
interface SurveyViewProps {
  data: any[];
  onRowClick: (id: number) => void;
  onRefetch: () => void;
  onUpdateInstallationDate: (surveyId: number, date: number | null) => void;
  onUpdateScheduledDate: (surveyId: number, date: number | null, time: string | null) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  sortConfig: { key: string; direction: "asc" | "desc" | null };
  onSort: (key: string) => void;
}

/* ==================== TABLE VIEW ==================== */
function SurveyTableView({ data, onRowClick, onRefetch, onUpdateInstallationDate, onUpdateScheduledDate, selectedIds, onToggleSelect, onToggleSelectAll, allSelected, someSelected, sortConfig, onSort }: SurveyViewProps) {
  // Flatten data for display (no client-side sorting - server handles it)
  const flatData = useMemo(() => data.map((item: any) => ({
    ...item,
    _scheduledDate: item.survey.scheduledDate,
    _scheduledTime: item.survey.scheduledTime,
    _scheduledDateTime: (() => {
      const d = item.survey.scheduledDate;
      if (!d) return null;
      const t = item.survey.scheduledTime;
      if (t) {
        const [h, m] = t.split(":").map(Number);
        return d + ((h || 0) * 60 + (m || 0)) * 60 * 1000;
      }
      return d;
    })(),
    _customerName: item.customer.name,
    _phone: item.customer.phone,
    _source: item.customer.source,
    _districtProvince: [item.customer.district, item.customer.province].filter(Boolean).join(", "),
    _surveyors: (item.assignments || []).filter((a: any) => a.role === "surveyor").map((a: any) => a.userName).filter(Boolean).join(", ") || item.assignedUser?.name || "",
    _senders: (item.assignments || []).filter((a: any) => a.role === "admin_sender").map((a: any) => a.userName).filter(Boolean).join(", "),
    _closers: (item.assignments || []).filter((a: any) => a.role === "closer").map((a: any) => a.userName).filter(Boolean).join(", "),
    _status: item.survey.status,
    _installationDate: item.survey.installationDate,
    _surveyNotes: item.survey.surveyNotes,
  })), [data]);
  // Use server-sorted data directly (no local re-sort)
  const sortedData = flatData;
  const requestSort = onSort;

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
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="วันที่" sortKey="_scheduledDateTime" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="เวลา" sortKey="_scheduledTime" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="ชื่อลูกค้า" sortKey="_customerName" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="เบอร์โทร" sortKey="_phone" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell"><SortableHeader label="ช่องทาง" sortKey="_source" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell"><SortableHeader label="เขต/จังหวัด" sortKey="_districtProvince" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell"><SortableHeader label="เซลล์" sortKey="_surveyors" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell"><SortableHeader label="คนส่งสำรวจ" sortKey="_senders" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell"><SortableHeader label="คนปิดการขาย" sortKey="_closers" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap"><SortableHeader label="สถานะ" sortKey="_status" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell"><SortableHeader label="วันนัดติดตั้ง" sortKey="_installationDate" sortConfig={sortConfig} onSort={requestSort} /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell"><SortableHeader label="หมายเหตุ" sortKey="_surveyNotes" sortConfig={sortConfig} onSort={requestSort} /></th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item: any) => {
              const s = item.survey;
              const c = item.customer;
              const assigns = item.assignments || [];
              const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;
              const surveyors = item._surveyors;
              const senders = item._senders;
              const closers = item._closers;
              const isSelected = selectedIds.has(s.id);
              return (
                <tr
                  key={s.id}
                  className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${isSelected ? "bg-destructive/5" : ""}`}
                  onClick={() => onRowClick(s.id)}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(s.id)}
                      aria-label={`เลือก ${c.name}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <ScheduledDateCell
                      surveyId={s.id}
                      currentDate={s.scheduledDate || null}
                      currentTime={s.scheduledTime || null}
                      onUpdate={onUpdateScheduledDate}
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {s.scheduledTime || <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 font-medium max-w-[200px] truncate">
                    {c.name}
                    <span className="text-muted-foreground text-xs ml-1">#{s.id}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatPhone(c.phone)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
                    {c.source ? (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {c.source}
                      </Badge>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground">
                    {[c.district, c.province].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground text-xs">
                    {surveyors || item.assignedUser?.name || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground text-xs">
                    {senders || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell text-muted-foreground text-xs">
                    {closers || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <StatusDropdown
                      type="survey"
                      entityId={s.id}
                      currentStatusId={s.statusId || null}
                      currentCustomStatus={item.customStatus || null}
                      fallbackLabel={statusInfo.label}
                      fallbackColor={SURVEY_STATUS_FALLBACK[s.status]?.color}
                      fallbackBgColor={SURVEY_STATUS_FALLBACK[s.status]?.bg}
                      onStatusChanged={onRefetch}
                      navigateOnInstallation
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell" onClick={(e) => e.stopPropagation()}>
                    <InstallationDateCell
                      surveyId={s.id}
                      currentDate={s.installationDate || null}
                      onUpdate={onUpdateInstallationDate}
                    />
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate hidden xl:table-cell text-muted-foreground text-xs">
                    {s.surveyNotes || "-"}
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

/* ==================== LIST VIEW (original) ==================== */
function SurveyListView({ data, onRowClick, onRefetch, onUpdateInstallationDate, onUpdateScheduledDate, selectedIds, onToggleSelect, onToggleSelectAll, allSelected, someSelected, sortConfig: _sortConfig, onSort: _onSort }: SurveyViewProps) {
  return (
    <div className="space-y-3">
      {/* Select all bar for list view */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onToggleSelectAll}
          aria-label="เลือกทั้งหมด"
        />
        <span className="text-xs text-muted-foreground">เลือกทั้งหมด</span>
      </div>
      {data.map((item: any) => {
        const s = item.survey;
        const c = item.customer;
        const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;
        const isSelected = selectedIds.has(s.id);
        return (
          <Card
            key={s.id}
            className={`border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${isSelected ? "ring-2 ring-destructive/30 bg-destructive/5" : ""}`}
            onClick={() => onRowClick(s.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(s.id)}
                    aria-label={`เลือก ${c.name}`}
                  />
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">#{s.id}</span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <StatusDropdown
                        type="survey"
                        entityId={s.id}
                        currentStatusId={s.statusId || null}
                        currentCustomStatus={item.customStatus || null}
                        fallbackLabel={statusInfo.label}
                        fallbackColor={SURVEY_STATUS_FALLBACK[s.status]?.color}
                        fallbackBgColor={SURVEY_STATUS_FALLBACK[s.status]?.bg}
                        onStatusChanged={onRefetch}
                        navigateOnInstallation
                      />
                    </span>
                    {s.installationDate && (
                      <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                        นัดติดตั้ง: {new Date(s.installationDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <CalendarIcon className="h-3 w-3" />
                      <ScheduledDateCell
                        surveyId={s.id}
                        currentDate={s.scheduledDate || null}
                        currentTime={s.scheduledTime || null}
                        onUpdate={onUpdateScheduledDate}
                      />
                      {s.scheduledTime ? <span className="ml-0.5">{s.scheduledTime} น.</span> : null}
                    </span>
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhone(c.phone)}
                      </span>
                    )}
                    {(c.province || c.address) && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {c.province || c.address}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
