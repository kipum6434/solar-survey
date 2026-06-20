import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP } from "@/lib/constants";
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  Trophy,
  PhoneCall,
  ArrowRight,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(
    selectedMonth !== undefined && selectedYear !== undefined
      ? { month: selectedMonth, year: selectedYear }
      : selectedYear !== undefined
      ? { year: selectedYear }
      : undefined
  );
  const { data: activities, isLoading: activitiesLoading } = trpc.dashboard.recentActivities.useQuery({ limit: 10 }, { enabled: isAdmin });
  const { data: upcomingSurveys } = trpc.survey.list.useQuery({ limit: 5, status: "scheduled" });

  const statCards = [
    { label: "ลูกค้าทั้งหมด", value: stats?.totalCustomers ?? 0, icon: Users, color: "from-blue-500 to-blue-600", link: "/customers" },
    { label: "งานสำรวจทั้งหมด", value: stats?.totalSurveys ?? 0, icon: ClipboardList, color: "from-amber-500 to-amber-600", link: "/surveys" },
    { label: "รอสำรวจ", value: stats?.pendingSurveys ?? 0, icon: Clock, color: "from-orange-500 to-orange-600", link: "/surveys" },
    { label: "สำรวจเสร็จ", value: stats?.completedSurveys ?? 0, icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", link: "/surveys" },
    { label: "ปิดการขาย", value: stats?.wonDeals ?? 0, icon: Trophy, color: "from-green-500 to-green-600", link: "/surveys" },
    { label: "รอ Follow-up", value: stats?.pendingFollowUps ?? 0, icon: PhoneCall, color: "from-purple-500 to-purple-600", link: "/surveys" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">แดชบอร์ด</h1>
            <p className="text-muted-foreground text-sm mt-1">ภาพรวมระบบจัดการงานสำรวจโซล่าเซลล์</p>
          </div>
          <Button onClick={() => setLocation("/customers")} className="bg-primary hover:bg-primary/90 gap-2">
            <Users className="h-4 w-4" />
            เพิ่มลูกค้าใหม่
          </Button>
        </div>

        {/* Month/Year Filter */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">กรองตามเดือน:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (selectedMonth !== undefined && selectedYear !== undefined) {
                      if (selectedMonth === 1) {
                        setSelectedMonth(12);
                        setSelectedYear(selectedYear - 1);
                      } else {
                        setSelectedMonth(selectedMonth - 1);
                      }
                    }
                  }}
                  disabled={selectedMonth === undefined}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={selectedMonth !== undefined ? String(selectedMonth) : "all"}
                  onValueChange={(val) => {
                    if (val === "all") {
                      setSelectedMonth(undefined);
                      setSelectedYear(undefined);
                    } else {
                      setSelectedMonth(Number(val));
                      if (selectedYear === undefined) setSelectedYear(now.getFullYear());
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"].map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedYear !== undefined ? String(selectedYear) : "all"}
                  onValueChange={(val) => {
                    if (val === "all") {
                      setSelectedYear(undefined);
                      setSelectedMonth(undefined);
                    } else {
                      setSelectedYear(Number(val));
                    }
                  }}
                >
                  <SelectTrigger className="w-[100px] h-8">
                    <SelectValue placeholder="ปี" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกปี</SelectItem>
                    {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (selectedMonth !== undefined && selectedYear !== undefined) {
                      if (selectedMonth === 12) {
                        setSelectedMonth(1);
                        setSelectedYear(selectedYear + 1);
                      } else {
                        setSelectedMonth(selectedMonth + 1);
                      }
                    }
                  }}
                  disabled={selectedMonth === undefined}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {(selectedMonth !== undefined || selectedYear !== undefined) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setSelectedMonth(undefined); setSelectedYear(undefined); }}
                >
                  ดูทั้งหมด
                </Button>
              )}
              {selectedMonth !== undefined && selectedYear !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][selectedMonth - 1]} {selectedYear + 543}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat) => (
            <Card
              key={stat.label}
              className="cursor-pointer hover:shadow-md transition-all duration-200 border-0 shadow-sm group"
              onClick={() => setLocation(stat.link)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-sm`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
                </div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  งานสำรวจที่กำลังจะมาถึง
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/calendar")} className="text-xs text-muted-foreground hover:text-foreground">
                  ดูทั้งหมด <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingSurveys?.data && upcomingSurveys.data.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSurveys.data.map((item: any) => {
                    const statusInfo = SURVEY_STATUS_MAP[item.survey.status] || SURVEY_STATUS_MAP.pending;
                    return (
                      <div
                        key={item.survey.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => setLocation(`/surveys/${item.survey.id}`)}
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.customer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.survey.scheduledDate
                              ? new Date(item.survey.scheduledDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
                              : "ยังไม่กำหนดวัน"}
                            {item.survey.scheduledTime ? ` ${item.survey.scheduledTime} น.` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-[10px] font-medium border-0`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ยังไม่มีงานสำรวจที่กำลังจะมาถึง</p>
                </div>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                กิจกรรมล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {activitiesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="space-y-2">
                  {activities.map((activity: any) => (
                    <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">{activity.details || activity.action}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(activity.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ยังไม่มีกิจกรรม</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
