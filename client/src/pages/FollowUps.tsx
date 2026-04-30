import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { FOLLOW_UP_METHOD_MAP } from "@/lib/constants";
import { formatPhone } from "@/lib/formatPhone";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Search, PhoneCall, ChevronLeft, ChevronRight, Calendar, Clock, User,
  CheckCircle2, AlertCircle, XCircle, Timer, MapPin, FileText,
  LayoutList, Table2, Phone, MessageSquare,
} from "lucide-react";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const FOLLOW_UP_STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "รอดำเนินการ", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Timer },
  completed: { label: "เสร็จสิ้น", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  overdue: { label: "เลยกำหนด", color: "bg-red-100 text-red-800 border-red-200", icon: AlertCircle },
  cancelled: { label: "ยกเลิก", color: "bg-gray-100 text-gray-800 border-gray-200", icon: XCircle },
};

const METHOD_ICON_MAP: Record<string, any> = {
  phone: Phone,
  line: MessageSquare,
  visit: MapPin,
  email: FileText,
  other: PhoneCall,
};

export default function FollowUps() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "table">("table");

  // Date filter state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterByMonth, setFilterByMonth] = useState(false);

  // Year options for dropdown
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
      status: statusFilter === "all" ? undefined : statusFilter,
      method: methodFilter === "all" ? undefined : methodFilter,
      startDate,
      endDate,
      search: search || undefined,
    };
  }, [statusFilter, methodFilter, filterByMonth, selectedMonth, selectedYear, search]);

  const { data, isLoading } = trpc.followUp.listWithDetails.useQuery(queryInput);
  const updateFollowUp = trpc.followUp.update.useMutation({
    onSuccess: () => { toast.success("อัพเดทสถานะสำเร็จ"); },
  });
  const utils = trpc.useUtils();

  // Stats
  const stats = useMemo(() => {
    if (!data) return { total: 0, pending: 0, completed: 0, overdue: 0 };
    return {
      total: data.length,
      pending: data.filter((d: any) => d.followUp.status === "pending").length,
      completed: data.filter((d: any) => d.followUp.status === "completed").length,
      overdue: data.filter((d: any) => d.followUp.status === "overdue" || (d.followUp.status === "pending" && d.followUp.dueDate < Date.now())).length,
    };
  }, [data]);

  const handleStatusChange = useCallback((id: number, newStatus: string) => {
    updateFollowUp.mutate({ id, status: newStatus as any }, {
      onSuccess: () => utils.followUp.listWithDetails.invalidate(),
    });
  }, [updateFollowUp, utils]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  };

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const isOverdue = (fu: any) => fu.status === "pending" && fu.dueDate < Date.now();

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">งานติดตาม</h1>
          <p className="text-sm text-muted-foreground mt-1">ติดตามลูกค้าหลังจากสำรวจ</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">ทั้งหมด</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">รอดำเนินการ</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.overdue}</div>
              <div className="text-xs text-muted-foreground">เลยกำหนด</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">เสร็จสิ้น</div>
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            variant={!filterByMonth ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilterByMonth(false); }}
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
              onClick={() => { setSelectedMonth(i + 1); setFilterByMonth(true); }}
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
              placeholder="ค้นหาชื่อ, เบอร์โทร, หมายเหตุ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สถานะทั้งหมด</SelectItem>
              {Object.entries(FOLLOW_UP_STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="วิธีติดตาม" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">วิธีทั้งหมด</SelectItem>
              {Object.entries(FOLLOW_UP_METHOD_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!data || data.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <PhoneCall className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium">ไม่พบงานติดตาม</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {filterByMonth ? "ไม่มีงานติดตามในช่วงเวลาที่เลือก" : "ยังไม่มีงานติดตามในระบบ"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* List View */}
        {!isLoading && data && data.length > 0 && viewMode === "list" && (
          <div className="space-y-2">
            {data.map((item: any) => {
              const fu = item.followUp;
              const cust = item.customer;
              const survey = item.survey;
              const statusInfo = FOLLOW_UP_STATUS_MAP[isOverdue(fu) ? "overdue" : fu.status] || FOLLOW_UP_STATUS_MAP.pending;
              const StatusIcon = statusInfo.icon;
              const MethodIcon = METHOD_ICON_MAP[fu.method || "other"] || PhoneCall;

              return (
                <Card
                  key={fu.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue(fu) ? "border-red-300 bg-red-50/30" : ""}`}
                  onClick={() => setLocation(`/surveys/${fu.surveyId}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{cust.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            กำหนด: {formatDate(fu.dueDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MethodIcon className="h-3 w-3" />
                            {FOLLOW_UP_METHOD_MAP[fu.method || "other"] || "อื่นๆ"}
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
                        </div>
                        {fu.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            <FileText className="h-3 w-3 inline mr-1" />
                            {fu.notes}
                          </p>
                        )}
                        {fu.result && (
                          <p className="text-xs text-green-700 mt-1 line-clamp-1">
                            <CheckCircle2 className="h-3 w-3 inline mr-1" />
                            ผล: {fu.result}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {fu.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(fu.id, "completed"); }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            เสร็จสิ้น
                          </Button>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          งาน #{fu.surveyId}
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
        {!isLoading && data && data.length > 0 && viewMode === "table" && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">กำหนดวันที่</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ลูกค้า</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">เบอร์โทร</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">วิธีติดตาม</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">สถานะ</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">หมายเหตุ</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ผลติดตาม</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">จังหวัด</th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item: any) => {
                    const fu = item.followUp;
                    const cust = item.customer;
                    const statusInfo = FOLLOW_UP_STATUS_MAP[isOverdue(fu) ? "overdue" : fu.status] || FOLLOW_UP_STATUS_MAP.pending;
                    const StatusIcon = statusInfo.icon;

                    return (
                      <tr
                        key={fu.id}
                        className={`border-b hover:bg-muted/30 cursor-pointer transition-colors ${isOverdue(fu) ? "bg-red-50/50" : ""}`}
                        onClick={() => setLocation(`/surveys/${fu.surveyId}`)}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs">{formatDate(fu.dueDate)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-xs">{cust.name}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs">{cust.phone ? formatPhone(cust.phone) : "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs">{FOLLOW_UP_METHOD_MAP[fu.method || "other"] || "อื่นๆ"}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <span className="text-xs text-muted-foreground truncate block">{fu.notes || "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <span className="text-xs text-muted-foreground truncate block">{fu.result || "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs">{cust.province || "-"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {fu.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(fu.id, "completed"); }}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              เสร็จ
                            </Button>
                          )}
                          {fu.status === "completed" && (
                            <span className="text-[10px] text-green-600">
                              {fu.completedAt ? formatDate(fu.completedAt) : "เสร็จสิ้น"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
