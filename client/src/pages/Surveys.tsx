import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP, SOURCE_MAP } from "@/lib/constants";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search, ClipboardList, Calendar, User, ChevronLeft, ChevronRight, Filter,
  LayoutList, Table2, Phone, MapPin,
} from "lucide-react";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export default function Surveys() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "table">("table");

  // Month/Year filter - default to current month
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterByMonth, setFilterByMonth] = useState(false);

  const queryInput = useMemo(() => ({
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 50,
    month: filterByMonth ? selectedMonth : undefined,
    year: filterByMonth ? selectedYear : undefined,
  }), [search, statusFilter, page, filterByMonth, selectedMonth, selectedYear]);

  const { data, isLoading } = trpc.survey.list.useQuery(queryInput);
  const totalPages = Math.ceil((data?.total ?? 0) / 50);

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">งานสำรวจ</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการงานสำรวจทั้งหมด</p>
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
            <SelectTrigger className="w-[180px]">
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
        {filterByMonth && (
          <div className="text-sm text-muted-foreground">
            แสดงงานสำรวจเดือน <span className="font-semibold text-foreground">{THAI_MONTHS[selectedMonth - 1]} {selectedYear + 543}</span>
            {data && <span className="ml-2">({data.total} รายการ)</span>}
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
              <SurveyTableView data={data.data} onRowClick={(id) => setLocation(`/surveys/${id}`)} />
            ) : (
              <SurveyListView data={data.data} onRowClick={(id) => setLocation(`/surveys/${id}`)} />
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">หน้า {page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">{search || statusFilter !== "all" || filterByMonth ? "ไม่พบงานสำรวจที่ค้นหา" : "ยังไม่มีงานสำรวจ"}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ==================== TABLE VIEW ==================== */
function SurveyTableView({ data, onRowClick }: { data: any[]; onRowClick: (id: number) => void }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">วันที่</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">เวลา</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ชื่อลูกค้า</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">เบอร์โทร</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">ช่องทาง</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">เขต/จังหวัด</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">เจ้าหน้าที่</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">สถานะ</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item: any) => {
              const s = item.survey;
              const c = item.customer;
              const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;
              return (
                <tr
                  key={s.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onRowClick(s.id)}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {s.scheduledDate
                      ? new Date(s.scheduledDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })
                      : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {s.scheduledTime || <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 font-medium max-w-[200px] truncate">
                    {c.name}
                    <span className="text-muted-foreground text-xs ml-1">#{s.id}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {c.phone || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
                    {c.source ? (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {SOURCE_MAP[c.source] || c.source}
                      </Badge>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground">
                    {[c.district, c.province].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground text-xs">
                    {item.assignedUser?.name || "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-[10px] font-medium border-0`}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate hidden xl:table-cell text-muted-foreground text-xs">
                    {s.surveyNotes || "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== LIST VIEW (original) ==================== */
function SurveyListView({ data, onRowClick }: { data: any[]; onRowClick: (id: number) => void }) {
  return (
    <div className="space-y-3">
      {data.map((item: any) => {
        const s = item.survey;
        const c = item.customer;
        const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;
        return (
          <Card
            key={s.id}
            className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => onRowClick(s.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">#{s.id}</span>
                    <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-[10px] font-medium border-0`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    {s.scheduledDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(s.scheduledDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                        {s.scheduledTime ? ` ${s.scheduledTime} น.` : ""}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
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
