import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Pagination } from "@/components/Pagination";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Search, ChevronLeft, ChevronRight, Clock, CheckCircle2,
  XCircle, FileCheck, Phone, MapPin, Camera, HardHat, Calendar,
  UserCheck, Send, AlertCircle, FileX,
} from "lucide-react";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const STATUS_TABS = [
  { value: "submitted", label: "รออนุมัติ", icon: Clock, color: "text-amber-700", bg: "bg-amber-50" },
  { value: "approved", label: "อนุมัติแล้ว", icon: CheckCircle2, color: "text-green-700", bg: "bg-green-50" },
  { value: "rejected", label: "ปฏิเสธ", icon: XCircle, color: "text-red-700", bg: "bg-red-50" },
  { value: "all", label: "ทั้งหมด", icon: FileCheck, color: "text-gray-700", bg: "bg-gray-50" },
] as const;

export default function Approvals() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [installerTeamId, setInstallerTeamId] = useState<number | undefined>();

  // Month/year navigation
  const now = new Date();
  const [filterByMonth, setFilterByMonth] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const handleMonthNav = (dir: number) => {
    let m = currentMonth + dir;
    let y = currentYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setCurrentMonth(m);
    setCurrentYear(y);
    setFilterByMonth(true);
    setPage(1);
  };

  const queryInput = useMemo(() => ({
    page,
    limit: 50,
    search: search || undefined,
    month: filterByMonth ? currentMonth : undefined,
    year: filterByMonth ? currentYear : undefined,
    installerTeamId,
    deliveryStatus: statusFilter,
  }), [page, search, filterByMonth, currentMonth, currentYear, installerTeamId, statusFilter]);

  const { data, isLoading } = trpc.delivery.list.useQuery(queryInput);
  const installerTeams = trpc.installerTeam.list.useQuery();

  const formatDate = (ts: number | null) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  };

  const formatDateTime = (ts: number | null) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) + " " +
      d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />รออนุมัติ</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />อนุมัติแล้ว</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />ปฏิเสธ</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const totalPages = data ? Math.ceil(data.total / 50) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header with stats */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">รออนุมัติ</h1>
            <p className="text-muted-foreground text-sm">ตรวจสอบและอนุมัติงานติดตั้งที่ส่งมอบแล้ว</p>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className="gap-1"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Month navigation */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthNav(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={filterByMonth ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setFilterByMonth(true); setPage(1); }}
                  className="min-w-[120px]"
                >
                  {THAI_MONTHS_SHORT[currentMonth - 1]} {currentYear + 543}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthNav(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {filterByMonth && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilterByMonth(false); setPage(1); }}>
                    ทั้งหมด
                  </Button>
                )}
              </div>

              {/* Installer team filter */}
              <Select
                value={installerTeamId?.toString() || "all"}
                onValueChange={(v) => { setInstallerTeamId(v === "all" ? undefined : Number(v)); setPage(1); }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="ทีมช่าง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทีมช่างทั้งหมด</SelectItem>
                  {installerTeams.data?.map((team: any) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, เบอร์โทร..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          พบ {data?.total || 0} รายการ
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-24" />
              </Card>
            ))}
          </div>
        ) : !data?.data?.length ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>ไม่พบรายการ{statusFilter === "submitted" ? "รออนุมัติ" : ""}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.data.map((item: any) => (
              <Card
                key={item.survey.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/surveys/${item.survey.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold truncate">{item.customer.name}</span>
                        {getStatusBadge(item.survey.deliveryStatus)}
                        {/* Signature Status Badge */}
                        {(() => {
                          const sig = item.deliverySignature;
                          if (!sig) return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px]"><FileX className="w-3 h-3 mr-0.5" />ไม่มีใบส่งมอบ</Badge>;
                          if (sig.customerSignatureUrl && sig.signedAt) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]"><UserCheck className="w-3 h-3 mr-0.5" />ลูกค้าเซ็นแล้ว</Badge>;
                          if (sig.technicianSignatureUrl && !sig.customerSignatureUrl) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><Send className="w-3 h-3 mr-0.5" />รอลูกค้าเซ็น</Badge>;
                          if (sig.handoverToken && !sig.technicianSignatureUrl) return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]"><AlertCircle className="w-3 h-3 mr-0.5" />รอช่างเซ็น</Badge>;
                          return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px]"><Clock className="w-3 h-3 mr-0.5" />ยังไม่ส่งลิงก์</Badge>;
                        })()}
                        <span className="text-xs text-muted-foreground">#{item.survey.id}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {item.customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />{item.customer.phone}
                          </span>
                        )}
                        {(item.customer.district || item.customer.province) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{[item.customer.district, item.customer.province].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {item.installerTeam && (
                          <span className="flex items-center gap-1">
                            <HardHat className="w-3 h-3" />
                            <span style={{ color: item.installerTeam.color || undefined }}>{item.installerTeam.name}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />{item.photoCount} รูป
                        </span>
                      </div>
                      {/* Assignments */}
                      {item.assignments?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.assignments.map((a: any, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {a.role === "surveyor" ? "สำรวจ" : a.role === "closer" ? "ปิดงาน" : a.role}: {a.userName || "-"}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>ส่งมอบ: {formatDateTime(item.survey.deliverySubmittedAt)}</span>
                      </div>
                      {item.survey.installationDate && (
                        <div className="mt-1">
                          นัดติดตั้ง: {formatDate(item.survey.installationDate)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
