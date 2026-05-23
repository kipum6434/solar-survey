import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, Wrench, Clock, CheckCircle2, Truck,
} from "lucide-react";

type ViewMode = "month" | "week";

const INSTALLATION_STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  waiting: { label: "รอติดตั้ง", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  in_progress: { label: "กำลังติดตั้ง", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Wrench },
  completed: { label: "ติดตั้งเสร็จ", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
  delivered: { label: "ส่งมอบแล้ว", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Truck },
};

export default function InstallationCalendar() {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const { startDate, endDate } = useMemo(() => {
    if (viewMode === "week") {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { startDate: start.getTime(), endDate: end.getTime() };
    }
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    return { startDate: start.getTime(), endDate: end.getTime() };
  }, [currentDate, viewMode]);

  const { data } = trpc.calendar.installationEvents.useQuery({ startDate, endDate });

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const monthDays = useMemo(() => {
    if (viewMode !== "month") return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentDate, viewMode]);

  const weekDays = useMemo(() => {
    if (viewMode !== "week") return [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate, viewMode]);

  const getEventsForDate = (date: Date) => {
    if (!data) return [];
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    return data.filter((e: any) => {
      const d = e.survey.installationDate;
      return d >= dayStart.getTime() && d <= dayEnd.getTime();
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  // Stats
  const stats = useMemo(() => {
    if (!data) return { total: 0, waiting: 0, inProgress: 0, completed: 0, delivered: 0 };
    let waiting = 0, inProgress = 0, completed = 0, delivered = 0;
    for (const item of data) {
      const s = (item as any).survey.installationStatus;
      if (s === "waiting") waiting++;
      else if (s === "in_progress") inProgress++;
      else if (s === "completed") completed++;
      else if (s === "delivered") delivered++;
    }
    return { total: data.length, waiting, inProgress, completed, delivered };
  }, [data]);

  const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  const getStatusBadge = (status: string) => {
    const info = INSTALLATION_STATUS_MAP[status];
    if (!info) return null;
    const Icon = info.icon;
    return (
      <Badge variant="outline" className={`text-[9px] ${info.color} ${info.bg} border gap-0.5`}>
        <Icon className="h-2.5 w-2.5" />
        {info.label}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ปฏิทินติดตั้ง</h1>
            <p className="text-sm text-muted-foreground mt-1">ตารางงานติดตั้งโซลาร์เซลล์ตามวันที่นัดหมาย</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-0.5">
              <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("month")}>เดือน</Button>
              <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("week")}>สัปดาห์</Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border-l-4 border-l-slate-400">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.total}</div>
              <div className="text-[11px] text-muted-foreground">ทั้งหมดเดือนนี้</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-400">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.waiting}</div>
              <div className="text-[11px] text-muted-foreground">รอติดตั้ง</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.inProgress}</div>
              <div className="text-[11px] text-muted-foreground">กำลังติดตั้ง</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.completed}</div>
              <div className="text-[11px] text-muted-foreground">ติดตั้งเสร็จ</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-400">
            <CardContent className="p-3">
              <div className="text-xl font-bold">{stats.delivered}</div>
              <div className="text-[11px] text-muted-foreground">ส่งมอบแล้ว</div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold min-w-[200px] text-center">
                  {viewMode === "month"
                    ? currentDate.toLocaleDateString("th-TH", { month: "long", year: "numeric" })
                    : `${weekDays[0]?.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} - ${weekDays[6]?.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`
                  }
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToday}>วันนี้</Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "month" ? (
              <div>
                <div className="grid grid-cols-7 mb-2">
                  {dayNames.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {monthDays.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} className="bg-background min-h-[80px] md:min-h-[100px]" />;
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const events = getEventsForDate(date);
                    return (
                      <div key={day} className={`bg-background min-h-[80px] md:min-h-[100px] p-1.5 ${isToday(date) ? "bg-primary/5" : ""}`}>
                        <div className={`text-xs font-medium mb-1 h-6 w-6 flex items-center justify-center rounded-full ${isToday(date) ? "bg-primary text-primary-foreground" : ""}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {events.slice(0, 3).map((e: any) => {
                            const statusInfo = INSTALLATION_STATUS_MAP[e.survey.installationStatus] || INSTALLATION_STATUS_MAP.waiting;
                            return (
                              <div
                                key={`inst-${e.survey.id}`}
                                className={`text-[9px] md:text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity ${statusInfo.bg} ${statusInfo.color}`}
                                onClick={() => setLocation(`/surveys/${e.survey.id}`)}
                              >
                                <Wrench className="h-2.5 w-2.5 inline mr-0.5" />
                                {e.customer.name}
                              </div>
                            );
                          })}
                          {events.length > 3 && (
                            <div className="text-[9px] text-muted-foreground text-center">+{events.length - 3} อื่นๆ</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-7 gap-4">
                  {weekDays.map((date) => {
                    const events = getEventsForDate(date);
                    return (
                      <div key={date.toISOString()} className={`min-h-[300px] rounded-lg p-3 ${isToday(date) ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"}`}>
                        <div className="text-center mb-3">
                          <div className="text-[10px] text-muted-foreground">{dayNames[date.getDay()]}</div>
                          <div className={`text-lg font-bold ${isToday(date) ? "text-primary" : ""}`}>{date.getDate()}</div>
                        </div>
                        <div className="space-y-1.5">
                          {events.map((e: any) => {
                            const statusInfo = INSTALLATION_STATUS_MAP[e.survey.installationStatus] || INSTALLATION_STATUS_MAP.waiting;
                            return (
                              <div
                                key={`inst-${e.survey.id}`}
                                className={`text-[10px] p-2 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${statusInfo.bg}`}
                                onClick={() => setLocation(`/surveys/${e.survey.id}`)}
                              >
                                <div className={`font-medium truncate ${statusInfo.color}`}>{e.customer.name}</div>
                                <div className="mt-0.5">{getStatusBadge(e.survey.installationStatus)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t flex-wrap">
              {Object.entries(INSTALLATION_STATUS_MAP).map(([key, info]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`h-3 w-3 rounded border ${info.bg}`} />
                  <span className="text-xs text-muted-foreground">{info.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
