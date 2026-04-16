import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search, ClipboardList, Calendar, User, ChevronLeft, ChevronRight, Filter,
} from "lucide-react";

export default function Surveys() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const queryInput = useMemo(() => ({
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 15,
  }), [search, statusFilter, page]);

  const { data, isLoading } = trpc.survey.list.useQuery(queryInput);
  const totalPages = Math.ceil((data?.total ?? 0) / 15);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">งานสำรวจ</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการงานสำรวจทั้งหมด</p>
        </div>

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
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <>
            <div className="space-y-3">
              {data.data.map((item: any) => {
                const s = item.survey;
                const c = item.customer;
                const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;
                return (
                  <Card
                    key={s.id}
                    className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setLocation(`/surveys/${s.id}`)}
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
                                <User className="h-3 w-3" />
                                {c.phone}
                              </span>
                            )}
                            {c.address && (
                              <span className="truncate max-w-[200px]">{c.province || c.address}</span>
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
            <p className="text-muted-foreground">{search || statusFilter !== "all" ? "ไม่พบงานสำรวจที่ค้นหา" : "ยังไม่มีงานสำรวจ"}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
