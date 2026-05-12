import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useRoute } from "wouter";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ClipboardList,
  Clock,
  CalendarCheck,
  CheckCircle2,
  Trophy,
  PhoneCall,
  Wrench,
  Package,
  ArrowRight,
  FileText,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

export default function GroupDashboard() {
  const [, params] = useRoute("/:group/dashboard");
  const group = params?.group || "";
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = trpc.dashboard.groupStats.useQuery(
    { sourceGroup: group },
    { enabled: !!group }
  );

  const statCards = [
    { label: "ลูกค้าทั้งหมด", value: stats?.totalCustomers ?? 0, icon: Users, color: "from-blue-500 to-blue-600", link: `/${group}/customers` },
    { label: "งานสำรวจทั้งหมด", value: stats?.totalSurveys ?? 0, icon: ClipboardList, color: "from-amber-500 to-amber-600", link: `/${group}/surveys` },
    { label: "รอสำรวจ", value: stats?.pendingSurveys ?? 0, icon: Clock, color: "from-orange-500 to-orange-600", link: `/${group}/surveys` },
    { label: "นัดสำรวจ", value: stats?.scheduledSurveys ?? 0, icon: CalendarCheck, color: "from-cyan-500 to-cyan-600", link: `/${group}/surveys` },
    { label: "สำรวจเสร็จ", value: stats?.surveyedSurveys ?? 0, icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", link: `/${group}/surveys` },
    { label: "ติดตาม", value: stats?.followUpCount ?? 0, icon: PhoneCall, color: "from-purple-500 to-purple-600", link: `/${group}/follow-ups` },
    { label: "เสนอราคาแล้ว", value: stats?.quotedCount ?? 0, icon: FileText, color: "from-indigo-500 to-indigo-600", link: `/${group}/follow-ups` },
    { label: "เจรจาต่อรอง", value: stats?.negotiatingCount ?? 0, icon: MessageSquare, color: "from-pink-500 to-pink-600", link: `/${group}/follow-ups` },
    { label: "ปิดการขาย", value: stats?.wonDeals ?? 0, icon: Trophy, color: "from-green-500 to-green-600", link: `/${group}/surveys` },
    { label: "รอติดตั้ง", value: stats?.pendingInstall ?? 0, icon: Wrench, color: "from-yellow-500 to-yellow-600", link: `/${group}/installations` },
    { label: "ติดตั้งแล้ว", value: stats?.installedCount ?? 0, icon: Package, color: "from-teal-500 to-teal-600", link: `/${group}/installations` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Dashboard — {group.toUpperCase()}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ภาพรวมงานสำรวจกลุ่ม {group.toUpperCase()}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
                {isLoading ? (
                  <Skeleton className="h-8 w-16 mb-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary section */}
        {!isLoading && stats && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-sm">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">สรุปภาพรวม</h3>
                  <p className="text-xs text-muted-foreground">สถิติงานกลุ่ม {group.toUpperCase()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-bold text-foreground">{stats.totalCustomers}</p>
                  <p className="text-[11px] text-muted-foreground">ลูกค้า</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-bold text-foreground">{stats.totalSurveys}</p>
                  <p className="text-[11px] text-muted-foreground">งานสำรวจ</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-bold text-green-600">{stats.wonDeals}</p>
                  <p className="text-[11px] text-muted-foreground">ปิดการขาย</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {stats.totalSurveys > 0
                      ? `${((stats.wonDeals / stats.totalSurveys) * 100).toFixed(1)}%`
                      : "0%"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">อัตราปิดการขาย</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
