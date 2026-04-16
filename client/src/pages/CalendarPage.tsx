import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, CalendarDays, ClipboardList, PhoneCall,
} from "lucide-react";

type ViewMode = "month" | "week";

export default function CalendarPage() {
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

  const { data } = trpc.calendar.events.useQuery({ startDate, endDate });

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
    if (!data) return { surveys: [], followUps: [] };
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const surveys = data.surveys.filter((e: any) => {
      const d = e.survey.scheduledDate;
      return d >= dayStart.getTime() && d <= dayEnd.getTime();
    });
    const followUps = data.followUps.filter((e: any) => {
      const d = e.followUp.dueDate;
      return d >= dayStart.getTime() && d <= dayEnd.getTime();
    });
    return { surveys, followUps };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ปฏิทิน</h1>
            <p className="text-sm text-muted-foreground mt-1">ตารางงานสำรวจและ Follow-up</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-0.5">
              <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("month")}>เดือน</Button>
              <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setViewMode("week")}>สัปดาห์</Button>
            </div>
          </div>
        </div>

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
                    const hasEvents = events.surveys.length > 0 || events.followUps.length > 0;
                    return (
                      <div key={day} className={`bg-background min-h-[80px] md:min-h-[100px] p-1.5 ${isToday(date) ? "bg-primary/5" : ""}`}>
                        <div className={`text-xs font-medium mb-1 h-6 w-6 flex items-center justify-center rounded-full ${isToday(date) ? "bg-primary text-primary-foreground" : ""}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {events.surveys.slice(0, 2).map((e: any) => (
                            <div
                              key={`s-${e.survey.id}`}
                              className="text-[9px] md:text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 truncate cursor-pointer hover:bg-blue-200 transition-colors"
                              onClick={() => setLocation(`/surveys/${e.survey.id}`)}
                            >
                              <ClipboardList className="h-2.5 w-2.5 inline mr-0.5" />
                              {e.customer.name}
                            </div>
                          ))}
                          {events.followUps.slice(0, 2).map((e: any) => (
                            <div
                              key={`f-${e.followUp.id}`}
                              className="text-[9px] md:text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 truncate cursor-pointer hover:bg-purple-200 transition-colors"
                              onClick={() => setLocation(`/surveys/${e.followUp.surveyId}`)}
                            >
                              <PhoneCall className="h-2.5 w-2.5 inline mr-0.5" />
                              {e.customer.name}
                            </div>
                          ))}
                          {(events.surveys.length + events.followUps.length > 4) && (
                            <div className="text-[9px] text-muted-foreground text-center">+{events.surveys.length + events.followUps.length - 4} อื่นๆ</div>
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
                          {events.surveys.map((e: any) => (
                            <div
                              key={`s-${e.survey.id}`}
                              className="text-[10px] p-2 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                              onClick={() => setLocation(`/surveys/${e.survey.id}`)}
                            >
                              <div className="font-medium text-blue-700 truncate">{e.customer.name}</div>
                              {e.survey.scheduledTime && <div className="text-blue-500 mt-0.5">{e.survey.scheduledTime} น.</div>}
                            </div>
                          ))}
                          {events.followUps.map((e: any) => (
                            <div
                              key={`f-${e.followUp.id}`}
                              className="text-[10px] p-2 rounded-lg bg-purple-50 border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors"
                              onClick={() => setLocation(`/surveys/${e.followUp.surveyId}`)}
                            >
                              <div className="font-medium text-purple-700 truncate">{e.customer.name}</div>
                              <div className="text-purple-500 mt-0.5">Follow-up</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-blue-100 border border-blue-200" />
                <span className="text-xs text-muted-foreground">งานสำรวจ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-purple-100 border border-purple-200" />
                <span className="text-xs text-muted-foreground">Follow-up</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
