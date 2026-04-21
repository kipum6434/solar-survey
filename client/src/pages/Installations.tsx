import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Search, Wrench, Calendar, ChevronLeft, ChevronRight,
  MapPin, Phone, ClipboardCheck, Clock, AlertTriangle, CheckCircle2,
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

export default function Installations() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [filterProvince, setFilterProvince] = useState("all");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterSurveyor, setFilterSurveyor] = useState("all");
  const [filterCloser, setFilterCloser] = useState("all");

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear() + 543);
  const [filterByMonth, setFilterByMonth] = useState(false);

  const years = useMemo(() => {
    const currentBE = now.getFullYear() + 543;
    return Array.from({ length: 5 }, (_, i) => currentBE - i);
  }, []);

  // Fetch filter data
  const { data: distinctValues } = trpc.customer.distinctValues.useQuery();
  const { data: surveyors } = trpc.teamMember.list.useQuery({ role: "surveyor" });
  const { data: closers } = trpc.teamMember.list.useQuery({ role: "closer" });

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
          <div className="text-sm text-muted-foreground">
            ทั้งหมด <span className="font-semibold text-foreground">{total}</span> รายการ
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
              {items.map((item: any) => {
                const surveyor = item.assignments?.find((a: any) => a.role === "surveyor");
                const closer = item.assignments?.find((a: any) => a.role === "closer");
                const daysUntil = getDaysUntil(item.survey.installationDate);
                return (
                  <Card
                    key={item.survey.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setLocation(`/surveys/${item.survey.id}`)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{item.customer.name}</p>
                          {item.customer.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />{item.customer.phone}
                            </p>
                          )}
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

                      {item.customStatus && (
                        <Badge variant="secondary" className="text-xs border-0" style={{ backgroundColor: item.customStatus.bgColor, color: item.customStatus.color }}>
                          {item.customStatus.label}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">วันนัดติดตั้ง</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">ชื่อลูกค้า</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">เบอร์โทร</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">เขต/จังหวัด</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">ขนาดระบบ</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">คนสำรวจ</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">คนปิดงาน</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">สถานะ</th>
                        <th className="py-3 px-4 text-left font-medium text-muted-foreground">สถานะติดตั้ง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => {
                        const surveyor = item.assignments?.find((a: any) => a.role === "surveyor");
                        const closer = item.assignments?.find((a: any) => a.role === "closer");
                        const daysUntil = getDaysUntil(item.survey.installationDate);
                        return (
                          <tr
                            key={item.survey.id}
                            className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => setLocation(`/surveys/${item.survey.id}`)}
                          >
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
                              {[item.customer.district, item.customer.province].filter(Boolean).join(", ") || "-"}
                            </td>
                            <td className="py-3 px-4">
                              {item.survey.systemSize ? (
                                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">{item.survey.systemSize} kW</span>
                              ) : "-"}
                            </td>
                            <td className="py-3 px-4 text-xs">{surveyor?.userName || "-"}</td>
                            <td className="py-3 px-4 text-xs">{closer?.userName || "-"}</td>
                            <td className="py-3 px-4">
                              {item.customStatus ? (
                                <Badge variant="secondary" className="text-xs border-0" style={{ backgroundColor: item.customStatus.bgColor, color: item.customStatus.color }}>
                                  {item.customStatus.label}
                                </Badge>
                              ) : "-"}
                            </td>
                            <td className="py-3 px-4">
                              {getInstallationBadge(item.survey.installationDate, item.survey.completedAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

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
      </div>
    </DashboardLayout>
  );
}
