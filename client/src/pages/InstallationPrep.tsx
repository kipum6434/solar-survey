import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Package, Calendar as CalendarIcon, MapPin, User, Zap, Sun,
  Battery, Cpu, ChevronLeft, ChevronRight, Layers, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useSearch } from "wouter";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const SYSTEM_TYPE_MAP: Record<string, string> = {
  string: "String",
  micro: "Micro",
  both: "String + Micro",
  hybrid: "Hybrid",
};

type FilterMode = "month" | "week" | "day" | "custom";
type SourceFilter = "all" | "tcs" | "gulf" | "mea";

const SOURCE_COLORS: Record<string, string> = {
  TCS: "bg-blue-100 text-blue-800 border-blue-200",
  Gulf: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEA: "bg-violet-100 text-violet-800 border-violet-200",
};

interface EquipmentSummary {
  inverters: Record<string, number>;
  panels: Record<string, { count: number; brand: string }>;
  batteries: Record<string, number>;
  optimizers: Record<string, number>;
  totalSystemKW: number;
  totalPanels: number;
}

// Helper: format date to YYYY-MM-DD in Asia/Bangkok timezone
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: get Monday of the week for a given date
function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

// Helper: get Sunday of the week for a given date
function getSunday(d: Date): Date {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

// Helper: format date range for display in Thai Buddhist Era
function formatDateThai(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear() + 543}`;
}

export default function InstallationPrep() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);

  // Parse filter mode from URL
  const initialMode = (params.get("mode") as FilterMode) || "month";
  const [filterMode, setFilterMode] = useState<FilterMode>(initialMode);

  // Source filter state
  const initialSource = (params.get("source") as SourceFilter) || "all";
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialSource);

  // Monthly filter state
  const now = new Date();
  const [month, setMonth] = useState(() => {
    const m = params.get("month");
    return m ? Number(m) : now.getMonth() + 1;
  });
  const [year, setYear] = useState(() => {
    const y = params.get("year");
    return y ? Number(y) : now.getFullYear();
  });

  // Week filter state
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const ws = params.get("weekStart");
    if (ws) return new Date(ws + "T00:00:00+07:00");
    return getMonday(now);
  });

  // Day filter state
  const [dayDate, setDayDate] = useState<Date>(() => {
    const dd = params.get("day");
    if (dd) return new Date(dd + "T00:00:00+07:00");
    return now;
  });

  // Custom range state
  const [customStart, setCustomStart] = useState<Date | undefined>(() => {
    const cs = params.get("startDate");
    if (cs) return new Date(cs + "T00:00:00+07:00");
    return undefined;
  });
  const [customEnd, setCustomEnd] = useState<Date | undefined>(() => {
    const ce = params.get("endDate");
    if (ce) return new Date(ce + "T00:00:00+07:00");
    return undefined;
  });

  // Compute query params based on filter mode
  const queryParams = useMemo(() => {
    const base: any = { page: 1, limit: 200, installationStatus: "all" as const };
    // Add sourceGroup filter if not "all"
    if (sourceFilter !== "all") {
      base.sourceGroup = sourceFilter;
    }

    if (filterMode === "month") {
      return { ...base, month, year };
    }

    if (filterMode === "week") {
      const endOfWeek = new Date(weekStart);
      endOfWeek.setDate(weekStart.getDate() + 6);
      return { ...base, startDate: toDateString(weekStart), endDate: toDateString(endOfWeek) };
    }

    if (filterMode === "day") {
      return { ...base, startDate: toDateString(dayDate), endDate: toDateString(dayDate) };
    }

    if (filterMode === "custom" && customStart && customEnd) {
      return { ...base, startDate: toDateString(customStart), endDate: toDateString(customEnd) };
    }

    // Fallback to current month
    return { ...base, month: now.getMonth() + 1, year: now.getFullYear() };
  }, [filterMode, month, year, weekStart, dayDate, customStart, customEnd, sourceFilter]);

  // Sync filter state to URL
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("mode", filterMode);
    p.set("source", sourceFilter);

    if (filterMode === "month") {
      p.set("month", String(month));
      p.set("year", String(year));
    } else if (filterMode === "week") {
      p.set("weekStart", toDateString(weekStart));
    } else if (filterMode === "day") {
      p.set("day", toDateString(dayDate));
    } else if (filterMode === "custom" && customStart && customEnd) {
      p.set("startDate", toDateString(customStart));
      p.set("endDate", toDateString(customEnd));
    }

    const newSearch = p.toString();
    const currentSearch = new URLSearchParams(searchString).toString();
    if (newSearch !== currentSearch) {
      setLocation(`/installation-prep?${newSearch}`, { replace: true });
    }
  }, [filterMode, month, year, weekStart, dayDate, customStart, customEnd, sourceFilter]);

  // Fetch installations
  const { data, isLoading } = trpc.installation.list.useQuery(queryParams);

  // Compute equipment summary
  const { installations, summary } = useMemo(() => {
    if (!data?.data) return { installations: [], summary: null };

    const items = data.data.map((d: any) => ({
      id: d.survey.id,
      customerName: d.customer.name,
      address: d.customer.fullAddress || d.customer.address || `${d.customer.district || ""} ${d.customer.province || ""}`.trim(),
      installationDate: d.survey.installationDate,
      installationStatus: d.survey.installationStatus,
      systemSize: d.survey.systemSize ? parseFloat(d.survey.systemSize) : null,
      panelCount: d.survey.panelCount,
      panelBrand: d.survey.panelBrand,
      inverterModel: d.survey.inverterModel,
      battery: d.survey.needBattery,
      optimizer: d.survey.needOptimizer,
      systemType: d.survey.systemType,
      installerTeam: d.installerTeam,
      sourceGroup: d.sourceGroup || null,
      phone: d.customer.phone,
    }));

    // Build summary
    const sum: EquipmentSummary = {
      inverters: {},
      panels: {},
      batteries: {},
      optimizers: {},
      totalSystemKW: 0,
      totalPanels: 0,
    };

    for (const item of items) {
      if (item.inverterModel) {
        const key = item.inverterModel.trim();
        sum.inverters[key] = (sum.inverters[key] || 0) + 1;
      }
      if (item.panelBrand) {
        const key = item.panelBrand.trim();
        if (!sum.panels[key]) sum.panels[key] = { count: 0, brand: key };
        sum.panels[key].count += item.panelCount || 0;
      }
      sum.totalPanels += item.panelCount || 0;
      if (item.battery && item.battery.trim() !== "" && item.battery.trim() !== "-") {
        const key = item.battery.trim();
        sum.batteries[key] = (sum.batteries[key] || 0) + 1;
      }
      if (item.optimizer && item.optimizer.trim() !== "" && item.optimizer.trim() !== "-") {
        const key = item.optimizer.trim();
        sum.optimizers[key] = (sum.optimizers[key] || 0) + 1;
      }
      if (item.systemSize) {
        sum.totalSystemKW += item.systemSize;
      }
    }

    return { installations: items, summary: sum };
  }, [data]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handlePrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };
  const handleNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const handlePrevDay = () => {
    const prev = new Date(dayDate);
    prev.setDate(prev.getDate() - 1);
    setDayDate(prev);
  };
  const handleNextDay = () => {
    const next = new Date(dayDate);
    next.setDate(next.getDate() + 1);
    setDayDate(next);
  };

  // Quick filter: this week
  const goThisWeek = () => {
    setFilterMode("week");
    setWeekStart(getMonday(now));
  };
  // Quick filter: next week
  const goNextWeek = () => {
    setFilterMode("week");
    const nextMonday = new Date(getMonday(now));
    nextMonday.setDate(nextMonday.getDate() + 7);
    setWeekStart(nextMonday);
  };
  // Quick filter: today
  const goToday = () => {
    setFilterMode("day");
    setDayDate(new Date());
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear() + 543}`;
  };

  const statusLabel = (s: string | null) => {
    switch (s) {
      case "waiting": return { text: "รอติดตั้ง", color: "bg-amber-100 text-amber-800" };
      case "in_progress": return { text: "กำลังติดตั้ง", color: "bg-blue-100 text-blue-800" };
      case "completed": return { text: "ติดตั้งเสร็จ", color: "bg-green-100 text-green-800" };
      case "delivered": return { text: "ส่งมอบแล้ว", color: "bg-purple-100 text-purple-800" };
      default: return { text: "รอติดตั้ง", color: "bg-gray-100 text-gray-700" };
    }
  };

  // Get display title for current filter
  const getFilterTitle = () => {
    if (filterMode === "month") {
      return `สรุปอุปกรณ์ประจำเดือน ${THAI_MONTHS[month - 1]} ${year + 543}`;
    }
    if (filterMode === "week") {
      const endOfWeek = getSunday(weekStart);
      return `สรุปอุปกรณ์ ${formatDateThai(weekStart)} - ${formatDateThai(endOfWeek)}`;
    }
    if (filterMode === "day") {
      return `สรุปอุปกรณ์วันที่ ${formatDateThai(dayDate)}`;
    }
    if (filterMode === "custom" && customStart && customEnd) {
      return `สรุปอุปกรณ์ ${formatDateThai(customStart)} - ${formatDateThai(customEnd)}`;
    }
    return "สรุปอุปกรณ์";
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-orange-600" />
                เตรียมสินค้าติดตั้ง
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                ดูรายการอุปกรณ์ที่ต้องเตรียมสำหรับงานติดตั้ง
              </p>
            </div>

            {/* Mode selector */}
            <div className="flex items-center gap-2">
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">รายเดือน</SelectItem>
                  <SelectItem value="week">รายสัปดาห์</SelectItem>
                  <SelectItem value="day">รายวัน</SelectItem>
                  <SelectItem value="custom">กำหนดเอง</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday} className="text-xs">
              วันนี้
            </Button>
            <Button variant="outline" size="sm" onClick={goThisWeek} className="text-xs">
              สัปดาห์นี้
            </Button>
            <Button variant="outline" size="sm" onClick={goNextWeek} className="text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
              สัปดาห์หน้า
            </Button>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Source filter */}
            <div className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              {(["all", "tcs", "gulf", "mea"] as SourceFilter[]).map((s) => {
                const labels: Record<SourceFilter, string> = { all: "ทั้งหมด", tcs: "TCS", gulf: "Gulf", mea: "MEA" };
                const isActive = sourceFilter === s;
                return (
                  <Button
                    key={s}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`text-xs h-7 px-2 ${isActive ? "" : ""}`}
                    onClick={() => setSourceFilter(s)}
                  >
                    {labels[s]}
                  </Button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Filter-specific controls */}
            {filterMode === "month" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THAI_MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                      <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {filterMode === "week" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {formatDateThai(weekStart)} - {formatDateThai(getSunday(weekStart))}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {filterMode === "day" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {formatDateThai(dayDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dayDate}
                      onSelect={(d) => d && setDayDate(d)}
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {filterMode === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {customStart ? formatDateThai(customStart) : "เริ่มต้น"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStart}
                      onSelect={(d) => d && setCustomStart(d)}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground">ถึง</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {customEnd ? formatDateThai(customEnd) : "สิ้นสุด"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEnd}
                      onSelect={(d) => d && setCustomEnd(d)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!isLoading && summary && (
          <>
            {/* Source counts */}
            {sourceFilter === "all" && (
              <div className="flex flex-wrap gap-2">
                {["TCS", "Gulf", "MEA"].map((src) => {
                  const count = installations.filter((i) => i.sourceGroup === src).length;
                  return (
                    <Badge key={src} variant="outline" className={`text-xs ${SOURCE_COLORS[src] || ""}`}>
                      {src}: {count} งาน
                    </Badge>
                  );
                })}
                {(() => {
                  const noGroup = installations.filter((i) => !i.sourceGroup).length;
                  return noGroup > 0 ? (
                    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700">
                      อื่นๆ: {noGroup} งาน
                    </Badge>
                  ) : null;
                })()}
              </div>
            )}

            {/* Equipment Summary */}
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-orange-600" />
                  {getFilterTitle()}
                  <Badge variant="secondary" className="ml-2">{installations.length} งาน</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total System */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      กำลังผลิตรวม
                    </div>
                    <p className="text-2xl font-bold text-yellow-700">{summary.totalSystemKW.toFixed(1)} kW</p>
                  </div>

                  {/* Total Panels */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Sun className="h-4 w-4 text-blue-600" />
                      แผงโซลาร์รวม
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{summary.totalPanels} แผง</p>
                    {Object.entries(summary.panels).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(summary.panels).map(([brand, info]) => (
                          <div key={brand} className="flex justify-between text-xs text-muted-foreground">
                            <span>{brand}</span>
                            <span className="font-medium">{info.count} แผง</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inverters */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Cpu className="h-4 w-4 text-green-600" />
                      อินเวอร์เตอร์
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {Object.values(summary.inverters).reduce((a, b) => a + b, 0)} ตัว
                    </p>
                    {Object.entries(summary.inverters).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(summary.inverters).map(([model, count]) => (
                          <div key={model} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[120px]">{model}</span>
                            <span className="font-medium">{count} ตัว</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Batteries */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Battery className="h-4 w-4 text-purple-600" />
                      แบตเตอรี่
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                      {Object.values(summary.batteries).reduce((a, b) => a + b, 0)} ชุด
                    </p>
                    {Object.entries(summary.batteries).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(summary.batteries).map(([model, count]) => (
                          <div key={model} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[120px]">{model}</span>
                            <span className="font-medium">{count} ชุด</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {Object.entries(summary.batteries).length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">ไม่มีแบตเตอรี่</p>
                    )}
                  </div>
                </div>

                {/* Optimizer summary */}
                {Object.entries(summary.optimizers).length > 0 && (
                  <div className="mt-4 bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Cpu className="h-4 w-4 text-indigo-600" />
                      Optimizer
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(summary.optimizers).map(([model, count]) => (
                        <Badge key={model} variant="secondary" className="text-xs">
                          {model} × {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Installation List - Compact Cards */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                รายการงานติดตั้ง ({installations.length} งาน)
              </h2>

              {installations.length === 0 && (
                <Card className="py-12">
                  <CardContent className="text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ไม่มีงานติดตั้งในช่วงเวลาที่เลือก</p>
                  </CardContent>
                </Card>
              )}

              {installations.map((item) => {
                const status = statusLabel(item.installationStatus);
                const sourceGroupLower = item.sourceGroup?.toLowerCase() || "tcs";
                const detailPath = `/${sourceGroupLower}/installations`;
                return (
                  <Card
                    key={item.id}
                    className="hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => setLocation(`/surveys/${item.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                        {/* Left: Date + Status + Source Badge */}
                        <div className="flex items-center gap-2 lg:w-[240px] shrink-0 flex-wrap">
                          <div className="text-center bg-orange-50 rounded-lg p-2 min-w-[60px]">
                            <CalendarIcon className="h-3.5 w-3.5 mx-auto text-orange-600 mb-0.5" />
                            <p className="text-xs font-bold text-orange-800">
                              {formatDate(item.installationDate)}
                            </p>
                          </div>
                          <Badge className={`text-xs ${status.color} border-0`}>
                            {status.text}
                          </Badge>
                          {item.sourceGroup && (
                            <Badge className={`text-xs border ${SOURCE_COLORS[item.sourceGroup] || "bg-gray-100 text-gray-700"}`}>
                              {item.sourceGroup}
                            </Badge>
                          )}
                        </div>

                        {/* Middle: Customer info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm truncate">{item.customerName}</span>
                            {item.installerTeam && (
                              <Badge variant="outline" className="text-xs shrink-0" style={{ borderColor: item.installerTeam.color || undefined }}>
                                {item.installerTeam.name}
                              </Badge>
                            )}
                          </div>
                          {item.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-xs text-muted-foreground line-clamp-1">{item.address}</span>
                            </div>
                          )}
                        </div>

                        {/* Right: Equipment */}
                        <div className="lg:w-[360px] shrink-0">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {item.systemSize && (
                              <div className="flex items-center gap-1.5">
                                <Zap className="h-3 w-3 text-yellow-600" />
                                <span className="text-muted-foreground">ขนาด:</span>
                                <span className="font-medium">{item.systemSize} kW</span>
                              </div>
                            )}
                            {item.systemType && (
                              <div className="flex items-center gap-1.5">
                                <Layers className="h-3 w-3 text-gray-600" />
                                <span className="text-muted-foreground">ระบบ:</span>
                                <span className="font-medium">{SYSTEM_TYPE_MAP[item.systemType] || item.systemType}</span>
                              </div>
                            )}
                            {item.inverterModel && (
                              <div className="flex items-center gap-1.5">
                                <Cpu className="h-3 w-3 text-green-600" />
                                <span className="text-muted-foreground">INV:</span>
                                <span className="font-medium truncate max-w-[140px]">{item.inverterModel}</span>
                              </div>
                            )}
                            {item.panelBrand && (
                              <div className="flex items-center gap-1.5">
                                <Sun className="h-3 w-3 text-blue-600" />
                                <span className="text-muted-foreground">แผง:</span>
                                <span className="font-medium">{item.panelBrand} × {item.panelCount || "?"}</span>
                              </div>
                            )}
                            {item.battery && item.battery.trim() !== "" && item.battery.trim() !== "-" && (
                              <div className="flex items-center gap-1.5 col-span-2">
                                <Battery className="h-3 w-3 text-purple-600" />
                                <span className="text-muted-foreground">แบต:</span>
                                <span className="font-medium truncate">{item.battery}</span>
                              </div>
                            )}
                            {item.optimizer && item.optimizer.trim() !== "" && item.optimizer.trim() !== "-" && (
                              <div className="flex items-center gap-1.5 col-span-2">
                                <Cpu className="h-3 w-3 text-indigo-600" />
                                <span className="text-muted-foreground">Optimizer:</span>
                                <span className="font-medium truncate">{item.optimizer}</span>
                              </div>
                            )}
                            {!item.inverterModel && !item.panelBrand && !item.systemSize && (
                              <div className="col-span-2 text-muted-foreground italic">
                                ยังไม่ได้ระบุอุปกรณ์
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
