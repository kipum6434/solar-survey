import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  Trophy,
  PhoneCall,
  Wrench,
  HardHat,
  PackageCheck,
  ArrowRight,
  BarChart3,
} from "lucide-react";

const SURVEY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "รอดำเนินการ", color: "bg-gray-100 text-gray-700" },
  scheduled: { label: "นัดสำรวจ", color: "bg-blue-100 text-blue-700" },
  surveyed: { label: "สำรวจแล้ว", color: "bg-emerald-100 text-emerald-700" },
  quoted: { label: "เสนอราคาแล้ว", color: "bg-purple-100 text-purple-700" },
  won: { label: "ปิดการขาย", color: "bg-green-100 text-green-700" },
  lost: { label: "ไม่สำเร็จ", color: "bg-red-100 text-red-700" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700" },
};

const INSTALL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  waiting: { label: "รอติดตั้ง", color: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "กำลังติดตั้ง", color: "bg-blue-100 text-blue-700" },
  completed: { label: "ติดตั้งเสร็จ", color: "bg-green-100 text-green-700" },
  delivered: { label: "ส่งมอบแล้ว", color: "bg-emerald-100 text-emerald-700" },
  postponed: { label: "เลื่อน", color: "bg-orange-100 text-orange-700" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-700" },
};

export default function TcsDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.tcsStats.useQuery();

  const statCards = [
    { label: "ลูกค้า TCS", value: stats?.totalCustomers ?? 0, icon: Users, color: "from-amber-500 to-amber-600", link: "/tcs/customers" },
    { label: "งานสำรวจ", value: stats?.totalSurveys ?? 0, icon: ClipboardList, color: "from-blue-500 to-blue-600", link: "/tcs/surveys" },
    { label: "รอสำรวจ", value: stats?.pendingSurveys ?? 0, icon: Clock, color: "from-orange-500 to-orange-600", link: "/tcs/surveys" },
    { label: "สำรวจเสร็จ", value: stats?.completedSurveys ?? 0, icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", link: "/tcs/surveys" },
    { label: "ปิดการขาย", value: stats?.wonDeals ?? 0, icon: Trophy, color: "from-green-500 to-green-600", link: "/tcs/surveys" },
    { label: "รอ Follow-up", value: stats?.pendingFollowUps ?? 0, icon: PhoneCall, color: "from-purple-500 to-purple-600", link: "/tcs/follow-ups" },
  ];

  const installCards = [
    { label: "งานติดตั้งทั้งหมด", value: stats?.totalInstallations ?? 0, icon: Wrench, color: "from-cyan-500 to-cyan-600", link: "/tcs/installations" },
    { label: "กำลังติดตั้ง", value: stats?.inProgressInstallations ?? 0, icon: HardHat, color: "from-indigo-500 to-indigo-600", link: "/tcs/installations" },
    { label: "ติดตั้งเสร็จ", value: stats?.completedInstallations ?? 0, icon: PackageCheck, color: "from-teal-500 to-teal-600", link: "/tcs/installations" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-amber-500" />
              งาน TCS Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">ภาพรวมลูกค้าและงาน TCS</p>
          </div>
          <Button onClick={() => setLocation("/tcs/customers")} size="sm" className="gap-2">
            <Users className="h-4 w-4" /> ดูลูกค้า TCS
          </Button>
        </div>

        {/* Survey Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">สถิติงานสำรวจ</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((card) => (
              <Card
                key={card.label}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => setLocation(card.link)}
              >
                <CardContent className="p-3 sm:p-4">
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${card.color} text-white shrink-0`}>
                        <card.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-bold">{card.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Installation Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">สถิติงานติดตั้ง</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {installCards.map((card) => (
              <Card
                key={card.label}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => setLocation(card.link)}
              >
                <CardContent className="p-3 sm:p-4">
                  {isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${card.color} text-white shrink-0`}>
                        <card.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-bold">{card.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent TCS Surveys */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">งานสำรวจ TCS ล่าสุด</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setLocation("/tcs/surveys")}>
                ดูทั้งหมด <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !stats?.recentSurveys?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีงานสำรวจ TCS</p>
            ) : (
              <div className="space-y-2">
                {stats.recentSurveys.map((s: any) => {
                  const statusInfo = SURVEY_STATUS_MAP[s.status] || { label: s.status, color: "bg-gray-100 text-gray-700" };
                  const installInfo = s.installationStatus ? INSTALL_STATUS_MAP[s.installationStatus] : null;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => setLocation(`/tcs/surveys`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{s.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.customerPhone}
                          {s.scheduledDate ? ` • นัด ${new Date(s.scheduledDate).toLocaleDateString("th-TH")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                        {installInfo && (
                          <Badge className={`text-xs ${installInfo.color}`}>{installInfo.label}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
