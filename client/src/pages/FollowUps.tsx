import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import { formatPhone } from "@/lib/formatPhone";
import DashboardLayout from "@/components/DashboardLayout";
import { Pagination } from "@/components/Pagination";
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useSourceGroup } from "@/hooks/useSourceGroup";
import {
  Search, PhoneCall, ChevronLeft, ChevronRight, Calendar, Clock, User,
  CheckCircle2, AlertCircle, Timer, MapPin, FileText, Zap,
  LayoutList, Table2, Phone, MessageSquare,
} from "lucide-react";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// Statuses we show on this page
const FOLLOW_UP_STATUSES = ["follow_up", "quoted", "negotiating"] as const;

export default function FollowUps() {
  const [, setLocation] = useLocation();
  const sourceGroup = useSourceGroup();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Fetch team members for assignee filter
  const { data: teamMembers } = trpc.teamMember.listAll.useQuery();

  // Date filter state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterByMonth, setFilterByMonth] = useState(false);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 2; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const handleMonthNav = useCallback((dir: number) => {
    setSelectedYear((prev) => {
      const newMonth = selectedMonth + dir;
      if (newMonth < 1) { setSelectedMonth(12); return prev - 1; }
      if (newMonth > 12) { setSelectedMonth(1); return prev + 1; }
      setSelectedMonth(newMonth);
      return prev;
    });
    setFilterByMonth(true);
    setPage(1);
  }, [selectedMonth]);

  // Calculate date range for query
  const queryInput = useMemo(() => {
    let startDate: number | undefined;
    let endDate: number | undefined;
    if (filterByMonth) {
      const start = new Date(selectedYear, selectedMonth - 1, 1);
      const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      startDate = start.getTime();
      endDate = end.getTime();
    }
    return {
      startDate,
      endDate,
      search: search || undefined,
      page,
      limit: 50,
      sourceGroup,
      assigneeId: assigneeFilter !== "all" ? Number(assigneeFilter) : undefined,
      statusFilter: statusFilter !== "all" ? statusFilter : undefined,
    };
  }, [filterByMonth, selectedMonth, selectedYear, search, page, sourceGroup, assigneeFilter, statusFilter]);

  const { data, isLoading } = trpc.followUp.surveysForFollowUp.useQuery(queryInput);
  // Filter overdue on client side (surveys in follow_up status for > 2 days)
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    let result = data.data;
    if (overdueOnly) {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      result = result.filter((d: any) => d.survey.status === "follow_up" && new Date(d.survey.updatedAt).getTime() < twoDaysAgo);
    }
    return result;
  }, [data, overdueOnly]);
  // Pagination
  const totalPages = Math.ceil((data?.total ?? 0) / 50);
  // Stats
  const stats = useMemo(() => {
    if (!data) return { total: 0, follow_up: 0, quoted: 0, negotiating: 0 };
    return {
      total: data.total,
      follow_up: (data as any).stats?.follow_up ?? 0,
      quoted: (data as any).stats?.quoted ?? 0,
      negotiating: (data as any).stats?.negotiating ?? 0,
    };
  }, [data]);

  const formatDate = (ts: number | Date | string) => {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  };

  const getStatusBadge = (item: any) => {
    const survey = item.survey;
    // Prefer custom status if available
    if (item.customStatus) {
      return (
        <Badge
          variant="outline"
          className="text-[10px] border"
          style={{
            color: item.customStatus.color,
            backgroundColor: item.customStatus.bgColor,
            borderColor: item.customStatus.color + "40",
          }}
        >
          {item.customStatus.label}
        </Badge>
      );
    }
    // Fallback to default status
    const statusInfo = SURVEY_STATUS_MAP[survey.status as keyof typeof SURVEY_STATUS_MAP];
    if (!statusInfo) return null;
    return (
      <Badge variant="outline" className={`text-[10px] ${statusInfo.color} ${statusInfo.bg}`}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getAssigneeNames = (item: any) => {
    if (!item.assignments || item.assignments.length === 0) return "-";
    return item.assignments.map((a: any) => a.name).filter(Boolean).join(", ");
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">งานติดตาม</h1>
          <p className="text-sm text-muted-foreground mt-1">ติดตามลูกค้าหลังจากสำรวจ — แสดงงานที่สถานะ รอติดตาม, เสนอราคาแล้ว, เจรจาต่อรอง</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setStatusFilter("all"); setPage(1); }}>
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">ทั้งหมด</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setStatusFilter("follow_up"); setPage(1); }}>
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.follow_up}</div>
              <div className="text-xs text-muted-foreground">รอติดตาม</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setStatusFilter("quoted"); setPage(1); }}>
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.quoted}</div>
              <div className="text-xs text-muted-foreground">เสนอราคาแล้ว</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setStatusFilter("negotiating"); setPage(1); }}>
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.negotiating}</div>
              <div className="text-xs text-muted-foreground">เจรจาต่อรอง</div>
            </CardContent>
          </Card>
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
          <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); }}>
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

        {/* Search + Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ, เบอร์โทร..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สถานะทั้งหมด</SelectItem>
              <SelectItem value="follow_up">รอติดตาม</SelectItem>
              <SelectItem value="quoted">เสนอราคาแล้ว</SelectItem>
              <SelectItem value="negotiating">เจรจาต่อรอง</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="ผู้รับผิดชอบ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ผู้รับผิดชอบทั้งหมด</SelectItem>
              {teamMembers?.map((m: any) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={overdueOnly ? "destructive" : "outline"}
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => { setOverdueOnly(!overdueOnly); setPage(1); }}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            เคสค้าง
          </Button>
          <div className="flex items-center border rounded-md overflow-hidden ml-auto">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter info */}
        <div className="text-sm text-muted-foreground">
          {filterByMonth ? (
            <>
              แสดงงานติดตามเดือน <span className="font-semibold text-foreground">{THAI_MONTHS_SHORT[selectedMonth - 1]} {selectedYear + 543}</span>
              <span className="ml-2">({data?.total ?? 0} รายการ)</span>
            </>
          ) : (
            <>
              งานติดตามทั้งหมด
              <span className="ml-1 font-semibold text-foreground">({data?.total ?? 0} รายการ)</span>
            </>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredData.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <PhoneCall className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium">ไม่พบงานติดตาม</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {filterByMonth ? "ไม่มีงานติดตามในช่วงเวลาที่เลือก" : "ยังไม่มีงานที่ต้องติดตามในระบบ"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                เปลี่ยนสถานะงานสำรวจเป็น "รอติดตาม", "เสนอราคาแล้ว" หรือ "เจรจาต่อรอง" เพื่อให้แสดงที่นี่
              </p>
            </CardContent>
          </Card>
        )}

        {/* List View */}
        {!isLoading && filteredData.length > 0 && viewMode === "list" && (
          <div className="space-y-2">
            {filteredData.map((item: any) => {
              const survey = item.survey;
              const cust = item.customer;

              return (
                <Card
                  key={survey.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/surveys/${survey.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{cust.name}</span>
                          {getStatusBadge(item)}
                          {survey.systemSize && (
                            <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50">
                              <Zap className="h-3 w-3 mr-0.5" />
                              {survey.systemSize} kW
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            อัพเดท: {formatDate(survey.updatedAt)}
                          </span>
                          {cust.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {formatPhone(cust.phone)}
                            </span>
                          )}
                          {cust.province && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {cust.district ? `${cust.district}, ` : ""}{cust.province}
                            </span>
                          )}
                          {item.assignments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {getAssigneeNames(item)}
                            </span>
                          )}
                        </div>
                        {item.latestFollowUp && (
                          <p className="text-xs text-cyan-700 mt-1 line-clamp-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {item.followUpCount > 0 && (
                              <span className={`inline-flex items-center mr-1.5 px-1.5 py-0 rounded text-[9px] font-medium ${item.followUpCount >= 3 ? 'bg-red-50 text-red-700' : item.followUpCount >= 2 ? 'bg-orange-50 text-orange-700' : 'bg-cyan-50 text-cyan-700'}`}>
                                ติดตามครั้งที่ {item.followUpCount}
                              </span>
                            )}
                            กำหนด: {formatDate(item.latestFollowUp.dueDate)}
                            {item.latestFollowUp.notes ? ` — ${item.latestFollowUp.notes}` : ""}
                          </p>
                        )}
                        {survey.quotedPrice && (
                          <p className="text-xs text-purple-700 mt-1">
                            <FileText className="h-3 w-3 inline mr-1" />
                            ราคาเสนอ: {Number(survey.quotedPrice).toLocaleString()} บาท
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          งาน #{survey.id}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Table View */}
        {!isLoading && filteredData.length > 0 && viewMode === "table" && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">#</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ลูกค้า</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">เบอร์โทร</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">สถานะ</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ขนาดระบบ</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ราคาเสนอ</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ผู้รับผิดชอบ</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Follow-up</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">จังหวัด</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">อัพเดทล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item: any) => {
                    const survey = item.survey;
                    const cust = item.customer;
                    const isOverdue = survey.status === "follow_up" && (Date.now() - new Date(survey.updatedAt).getTime()) > 2 * 24 * 60 * 60 * 1000;

                    return (
                      <tr
                        key={survey.id}
                        className={`border-b hover:bg-muted/30 cursor-pointer transition-colors ${isOverdue ? 'bg-orange-50/70 dark:bg-orange-950/20' : ''}`}
                        onClick={() => setLocation(`/surveys/${survey.id}`)}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-muted-foreground">#{survey.id}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-xs">{cust.name}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs">{cust.phone ? formatPhone(cust.phone) : "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {getStatusBadge(item)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs">{survey.systemSize ? `${survey.systemSize} kW` : "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs">{survey.quotedPrice ? `${Number(survey.quotedPrice).toLocaleString()} ฿` : "-"}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs">{getAssigneeNames(item)}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {item.followUpCount > 0 && (
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${item.followUpCount >= 3 ? 'border-red-300 text-red-700 bg-red-50' : item.followUpCount >= 2 ? 'border-orange-300 text-orange-700 bg-orange-50' : 'border-cyan-300 text-cyan-700 bg-cyan-50'}`}>
                                ครั้งที่ {item.followUpCount}
                              </Badge>
                            )}
                            {item.latestFollowUp ? (
                              <span className="text-xs text-cyan-700">
                                <Clock className="h-3 w-3 inline mr-0.5" />
                                {formatDate(item.latestFollowUp.dueDate)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs">{cust.province || "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-muted-foreground">{formatDate(survey.updatedAt)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={data?.total} />
        )}
      </div>
    </DashboardLayout>
  );
}
