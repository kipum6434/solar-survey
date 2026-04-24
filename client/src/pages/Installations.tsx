import { useState, useMemo, useCallback } from "react";
import { useSort } from "@/hooks/useSort";
import { SortableHeader } from "@/components/SortableHeader";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Search, Wrench, Calendar, ChevronLeft, ChevronRight,
  MapPin, Phone, Clock, AlertTriangle, CheckCircle2, Trash2,
  Download, Package, Truck,
} from "lucide-react";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const STATUS_TABS = [
  { value: "all", label: "ทั้งหมด", icon: Wrench },
  { value: "upcoming", label: "กำลังจะถึง", icon: Clock },
  { value: "today", label: "วันนี้", icon: Calendar },
  { value: "overdue", label: "เลยกำหนด", icon: AlertTriangle },
  { value: "completed", label: "ติดตั้งแล้ว", icon: CheckCircle2 },
] as const;

// Installation status options
const INSTALL_STATUS_OPTIONS = [
  { value: "waiting", label: "รอติดตั้ง", color: "text-amber-700", bg: "bg-amber-50", icon: Clock },
  { value: "in_progress", label: "กำลังติดตั้ง", color: "text-blue-700", bg: "bg-blue-50", icon: Wrench },
  { value: "completed", label: "ติดตั้งเสร็จ", color: "text-green-700", bg: "bg-green-50", icon: CheckCircle2 },
  { value: "delivered", label: "ส่งมอบแล้ว", color: "text-purple-700", bg: "bg-purple-50", icon: Truck },
] as const;

function InstallationStatusBadge({ status, surveyId, onChanged }: { status: string | null; surveyId: number; onChanged: () => void }) {
  const utils = trpc.useUtils();
  const updateStatus = trpc.installation.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนสถานะติดตั้งสำเร็จ");
      utils.installation.list.invalidate();
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  const current = INSTALL_STATUS_OPTIONS.find(o => o.value === status) || INSTALL_STATUS_OPTIONS[0];
  const Icon = current.icon;

  return (
    <Select
      value={status || "waiting"}
      onValueChange={(v) => {
        updateStatus.mutate({ surveyId, installationStatus: v as any });
      }}
    >
      <SelectTrigger
        className={`h-7 w-auto min-w-[120px] border-0 ${current.bg} ${current.color} text-xs font-medium px-2 gap-1`}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {INSTALL_STATUS_OPTIONS.map(opt => {
          const OptIcon = opt.icon;
          return (
            <SelectItem key={opt.value} value={opt.value}>
              <span className={`flex items-center gap-1.5 ${opt.color}`}>
                <OptIcon className="h-3 w-3" />
                {opt.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default function Installations() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [filterProvince, setFilterProvince] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterSurveyor, setFilterSurveyor] = useState("all");
  const [filterCloser, setFilterCloser] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear() + 543);
  const [filterByMonth, setFilterByMonth] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const years = useMemo(() => {
    const currentBE = now.getFullYear() + 543;
    return Array.from({ length: 5 }, (_, i) => currentBE - i);
  }, []);

  // Fetch filter data
  const { data: distinctValues } = trpc.customer.distinctValues.useQuery();
  const { data: surveyors } = trpc.teamMember.list.useQuery({ role: "surveyor" });
  const { data: closers } = trpc.teamMember.list.useQuery({ role: "closer" });
  const utils = trpc.useUtils();

  const provinces = distinctValues?.provinces ?? [];
  const districts = distinctValues?.districts ?? [];

  const queryInput = useMemo(() => ({
    page,
    limit: 20,
    search: search || undefined,
    month: filterByMonth ? selectedMonth : undefined,
    year: filterByMonth ? selectedYear - 543 : undefined,
    province: filterProvince !== "all" ? filterProvince : undefined,
    district: filterDistrict !== "all" ? filterDistrict : undefined,
    surveyorId: filterSurveyor !== "all" ? Number(filterSurveyor) : undefined,
    closerId: filterCloser !== "all" ? Number(filterCloser) : undefined,
    installationStatus: statusTab as any,
  }), [page, search, filterByMonth, selectedMonth, selectedYear, statusTab, filterProvince, filterDistrict, filterSurveyor, filterCloser]);

  const { data, isLoading } = trpc.installation.list.useQuery(queryInput);
  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const bulkDeleteMutation = trpc.installation.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`ลบงานติดตั้ง ${result.deleted} รายการสำเร็จ`);
      setSelectedIds(new Set());
      setShowBulkDelete(false);
      utils.installation.list.invalidate();
      utils.survey.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Current page IDs for select-all
  const currentPageIds = useMemo(() => items.map((item: any) => item.survey.id), [items]);
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

  const getInstallationBadge = (installationDate: number | null, completedAt: number | null) => {
    if (completedAt) {
      return <Badge className="bg-green-100 text-green-700 border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />ติดตั้งแล้ว</Badge>;
    }
    if (!installationDate) return null;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    if (installationDate >= todayStart.getTime() && installationDate <= todayEnd.getTime()) {
      return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs"><Calendar className="h-3 w-3 mr-1" />วันนี้</Badge>;
    }
    if (installationDate > todayEnd.getTime()) {
      return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs"><Clock className="h-3 w-3 mr-1" />กำลังจะถึง</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700 border-0 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />เลยกำหนด</Badge>;
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  };

  const getDaysUntil = (ts: number | null) => {
    if (!ts) return null;
    const diff = Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "วันนี้";
    if (diff === 1) return "พรุ่งนี้";
    if (diff > 0) return `อีก ${diff} วัน`;
    return `เลย ${Math.abs(diff)} วัน`;
  };

  const getInstallStatusLabel = (status: string | null) => {
    return INSTALL_STATUS_OPTIONS.find(o => o.value === status)?.label || "รอติดตั้ง";
  };

  // Export Excel
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const exportData = await utils.installation.exportExcel.fetch({
        search: search || undefined,
        month: filterByMonth ? selectedMonth : undefined,
        year: filterByMonth ? selectedYear - 543 : undefined,
        province: filterProvince !== "all" ? filterProvince : undefined,
        district: filterDistrict !== "all" ? filterDistrict : undefined,
        installationStatus: statusTab as any,
      });

      if (!exportData || exportData.length === 0) {
        toast.error("ไม่มีข้อมูลสำหรับส่งออก");
        return;
      }

      // Build CSV with BOM for Excel Thai support
      const headers = [
        "ลำดับ", "วันนัดติดตั้ง", "ชื่อลูกค้า", "เบอร์โทร", "เขต/อำเภอ", "จังหวัด",
        "ขนาดระบบ (kW)", "ประเภทระบบ", "คนสำรวจ", "คนปิดงาน", "สถานะ", "สถานะติดตั้ง",
        "หมายเหตุ", "ที่อยู่",
      ];

      const rows = exportData.map((item: any, idx: number) => {
        const surveyor = item.assignments?.find((a: any) => a.role === "surveyor");
        const closer = item.assignments?.find((a: any) => a.role === "closer");
        return [
          idx + 1,
          item.survey.installationDate ? new Date(item.survey.installationDate).toLocaleDateString("th-TH") : "-",
          item.customer.name || "-",
          item.customer.phone || "-",
          item.customer.district || "-",
          item.customer.province || "-",
          item.survey.systemSize || "-",
          item.survey.systemType || "-",
          surveyor?.userName || "-",
          closer?.userName || "-",
          item.customStatus?.label || "-",
          getInstallStatusLabel(item.survey.installationStatus),
          item.survey.notes || "-",
          item.customer.address || "-",
        ];
      });

      const csvContent = "\uFEFF" + [
        headers.join(","),
        ...rows.map(row =>
          row.map(cell => {
            const str = String(cell).replace(/"/g, '""');
            return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
          }).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toLocaleDateString("th-TH").replace(/\//g, "-");
      a.download = `งานติดตั้ง_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`ส่งออกข้อมูล ${exportData.length} รายการสำเร็จ`);
    } catch (e: any) {
      toast.error("เกิดข้อผิดพลาดในการส่งออก: " + (e.message || ""));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-6 w-6 text-primary" />
              งานติดตั้ง
            </h1>
            <p className="text-muted-foreground text-sm">จัดการงานติดตั้งที่ปิดการขายแล้ว</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              ทั้งหมด <span className="font-semibold text-foreground">{total}</span> รายการ
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting || total === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "กำลังส่งออก..." : "Export Excel"}
            </Button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = statusTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => { setStatusTab(tab.value); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            variant={!filterByMonth ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilterByMonth(false); setPage(1); }}
            className="whitespace-nowrap"
          >
            ทั้งหมด
          </Button>
          {filterByMonth && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
              if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
              else setSelectedMonth(m => m - 1);
              setPage(1);
            }}><ChevronLeft className="h-4 w-4" /></Button>
          )}
          <div className="flex gap-1 overflow-x-auto">
            {THAI_MONTHS_SHORT.map((m, i) => (
              <Button
                key={i}
                variant={filterByMonth && selectedMonth === i + 1 ? "default" : "outline"}
                size="sm"
                className="min-w-[48px] text-xs"
                onClick={() => { setFilterByMonth(true); setSelectedMonth(i + 1); setPage(1); }}
              >
                {m}
              </Button>
            ))}
          </div>
          {filterByMonth && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
              if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
              else setSelectedMonth(m => m + 1);
              setPage(1);
            }}><ChevronRight className="h-4 w-4" /></Button>
          )}
          <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-[90px] h-8 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={filterProvince} onValueChange={(v) => { setFilterProvince(v); setFilterDistrict("all"); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="จังหวัดทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">จังหวัดทั้งหมด</SelectItem>
                {provinces.map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterDistrict} onValueChange={(v) => { setFilterDistrict(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="เขต/อำเภอทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">เขต/อำเภอทั้งหมด</SelectItem>
                {districts.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterSurveyor} onValueChange={(v) => { setFilterSurveyor(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="คนสำรวจทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">คนสำรวจทั้งหมด</SelectItem>
                {(surveyors ?? []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterCloser} onValueChange={(v) => { setFilterCloser(v); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="คนปิดงานทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">คนปิดงานทั้งหมด</SelectItem>
                {(closers ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                ยกเลิก
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> ลบ {selectedIds.size} รายการ
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Wrench className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">ไม่พบงานติดตั้ง</p>
              <p className="text-sm mt-1">งานที่มีวันนัดติดตั้งจะแสดงที่นี่</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3">
              {/* Select all bar for mobile */}
              <div className="flex items-center gap-2 px-1">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleSelectAll}
                  aria-label="เลือกทั้งหมด"
                />
                <span className="text-xs text-muted-foreground">เลือกทั้งหมด</span>
              </div>
              {items.map((item: any) => {
                const surveyor = item.assignments?.find((a: any) => a.role === "surveyor");
                const closer = item.assignments?.find((a: any) => a.role === "closer");
                const daysUntil = getDaysUntil(item.survey.installationDate);
                const isSelected = selectedIds.has(item.survey.id);
                return (
                  <Card
                    key={item.survey.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-destructive/30 bg-destructive/5" : ""}`}
                    onClick={() => setLocation(`/surveys/${item.survey.id}`)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(item.survey.id)}
                              aria-label={`เลือก ${item.customer.name}`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{item.customer.name}</p>
                            {item.customer.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />{item.customer.phone}
                              </p>
                            )}
                          </div>
                        </div>
                        {getInstallationBadge(item.survey.installationDate, item.survey.completedAt)}
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-primary font-medium">
                          <Wrench className="h-4 w-4" />
                          {formatDate(item.survey.installationDate)}
                        </div>
                        {daysUntil && !item.survey.completedAt && (
                          <span className="text-xs text-muted-foreground">({daysUntil})</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {item.customer.district && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[item.customer.district, item.customer.province].filter(Boolean).join(", ")}</span>
                        )}
                        {item.survey.systemSize && (
                          <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{item.survey.systemSize} kW</span>
                        )}
                      </div>

                      {(surveyor || closer) && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {surveyor && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">สำรวจ: {surveyor.userName}</span>}
                          {closer && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">ปิดงาน: {closer.userName}</span>}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {item.customStatus && (
                          <Badge variant="secondary" className="text-xs border-0" style={{ backgroundColor: item.customStatus.bgColor, color: item.customStatus.color }}>
                            {item.customStatus.label}
                          </Badge>
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                          <InstallationStatusBadge
                            status={item.survey.installationStatus}
                            surveyId={item.survey.id}
                            onChanged={() => {}}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <InstallationDesktopTable
              items={items}
              allSelected={allSelected}
              someSelected={someSelected}
              toggleSelectAll={toggleSelectAll}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              formatDate={formatDate}
              getDaysUntil={getDaysUntil}
              onRowClick={(id: number) => setLocation(`/surveys/${id}`)}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  หน้า {page} จาก {totalPages} ({total} รายการ)
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Bulk Delete Confirm Dialog */}
        <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบหลายรายการ</AlertDialogTitle>
              <AlertDialogDescription>
                คุณต้องการลบงานติดตั้ง <span className="font-bold text-destructive">{selectedIds.size} รายการ</span> หรือไม่?
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

/* ==================== DESKTOP TABLE VIEW (with sortable headers) ==================== */
interface InstallationDesktopTableProps {
  items: any[];
  allSelected: boolean;
  someSelected: boolean;
  toggleSelectAll: () => void;
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
  formatDate: (ts: number | null) => string;
  getDaysUntil: (ts: number | null) => string | null;
  onRowClick: (id: number) => void;
}

function InstallationDesktopTable({
  items, allSelected, someSelected, toggleSelectAll, selectedIds, toggleSelect,
  formatDate, getDaysUntil, onRowClick,
}: InstallationDesktopTableProps) {
  // Flatten data for sorting
  const flatData = useMemo(() => items.map((item: any) => ({
    ...item,
    _installationDate: item.survey.installationDate,
    _customerName: item.customer.name,
    _phone: item.customer.phone,
    _districtProvince: [item.customer.district, item.customer.province].filter(Boolean).join(", "),
    _systemSize: item.survey.systemSize ? Number(item.survey.systemSize) : null,
    _surveyor: item.assignments?.find((a: any) => a.role === "surveyor")?.userName || "",
    _closer: item.assignments?.find((a: any) => a.role === "closer")?.userName || "",
    _statusLabel: item.customStatus?.label || "",
    _installationStatus: item.survey.installationStatus || "waiting",
  })), [items]);

  const { sortedData, sortConfig, requestSort } = useSort(flatData);

  return (
    <Card className="hidden sm:block">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="py-3 px-4 w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="เลือกทั้งหมด"
                  />
                </th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="วันนัดติดตั้ง" sortKey="_installationDate" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="ชื่อลูกค้า" sortKey="_customerName" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="เบอร์โทร" sortKey="_phone" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="เขต/จังหวัด" sortKey="_districtProvince" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="ขนาดระบบ" sortKey="_systemSize" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="คนสำรวจ" sortKey="_surveyor" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="คนปิดงาน" sortKey="_closer" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="สถานะ" sortKey="_statusLabel" sortConfig={sortConfig} onSort={requestSort} /></th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground"><SortableHeader label="สถานะติดตั้ง" sortKey="_installationStatus" sortConfig={sortConfig} onSort={requestSort} /></th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item: any) => {
                const daysUntil = getDaysUntil(item.survey.installationDate);
                const isSelected = selectedIds.has(item.survey.id);
                return (
                  <tr
                    key={item.survey.id}
                    className={`border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${isSelected ? "bg-destructive/5" : ""}`}
                    onClick={() => onRowClick(item.survey.id)}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.survey.id)}
                        aria-label={`เลือก ${item.customer.name}`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-primary">{formatDate(item.survey.installationDate)}</span>
                        {daysUntil && !item.survey.completedAt && (
                          <span className="text-xs text-muted-foreground">{daysUntil}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium max-w-[180px] truncate">{item.customer.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{item.customer.phone || "-"}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {item._districtProvince || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {item.survey.systemSize ? (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">{item.survey.systemSize} kW</span>
                      ) : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs">{item._surveyor || "-"}</td>
                    <td className="py-3 px-4 text-xs">{item._closer || "-"}</td>
                    <td className="py-3 px-4">
                      {item.customStatus ? (
                        <Badge variant="secondary" className="text-xs border-0" style={{ backgroundColor: item.customStatus.bgColor, color: item.customStatus.color }}>
                          {item.customStatus.label}
                        </Badge>
                      ) : "-"}
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <InstallationStatusBadge
                        status={item.survey.installationStatus}
                        surveyId={item.survey.id}
                        onChanged={() => {}}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
