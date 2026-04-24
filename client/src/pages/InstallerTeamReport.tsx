import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HardHat, Wrench, CheckCircle2, Clock, Package, TrendingUp, Zap, AlertTriangle } from "lucide-react";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function InstallerTeamReport() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear() + 543);
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  const queryInput = useMemo(() => {
    const ceYear = selectedYear - 543;
    return viewMode === "month"
      ? { month: selectedMonth, year: ceYear }
      : { year: ceYear };
  }, [selectedMonth, selectedYear, viewMode]);

  const { data: report = [], isLoading } = trpc.installerTeam.report.useQuery(queryInput);

  const years = useMemo(() => {
    const currentBE = now.getFullYear() + 543;
    return Array.from({ length: 5 }, (_, i) => currentBE - i);
  }, []);

  // Summary stats
  const totalJobs = report.reduce((sum, r) => sum + r.totalJobs, 0);
  const totalCompleted = report.reduce((sum, r) => sum + r.completed, 0);
  const totalApproved = report.reduce((sum, r) => sum + r.deliveryApproved, 0);
  const totalKw = report.reduce((sum, r) => sum + r.totalKw, 0);
  const activeTeams = report.filter((r) => r.isActive && r.teamId !== 0).length;

  const periodLabel = viewMode === "month"
    ? `${MONTHS[selectedMonth - 1]} ${selectedYear}`
    : `ปี ${selectedYear}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">สรุปผลงานทีมช่าง</h1>
            <p className="text-muted-foreground text-sm">รายงานจำนวนงานติดตั้งและสถานะงานแยกตามทีมช่าง</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "month" | "year")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">รายเดือน</SelectItem>
                <SelectItem value="year">รายปี</SelectItem>
              </SelectContent>
            </Select>
            {viewMode === "month" && (
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard icon={HardHat} label="ทีมช่างที่ใช้งาน" value={activeTeams} color="text-blue-600" bg="bg-blue-50" />
          <SummaryCard icon={Wrench} label="งานทั้งหมด" value={totalJobs} color="text-orange-600" bg="bg-orange-50" />
          <SummaryCard icon={CheckCircle2} label="ติดตั้งเสร็จ" value={totalCompleted} color="text-green-600" bg="bg-green-50" />
          <SummaryCard icon={Package} label="ส่งมอบแล้ว" value={totalApproved} color="text-purple-600" bg="bg-purple-50" />
          <SummaryCard icon={Zap} label="กำลังไฟรวม" value={`${totalKw.toLocaleString()} kW`} color="text-yellow-600" bg="bg-yellow-50" />
        </div>

        {/* Team Report Table */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              กำลังโหลดข้อมูล...
            </CardContent>
          </Card>
        ) : report.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              ไม่มีข้อมูลงานติดตั้งในช่วง {periodLabel}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">รายละเอียดผลงานทีมช่าง — {periodLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 pr-4 font-medium">ทีมช่าง</th>
                        <th className="pb-3 px-2 font-medium text-center">งานทั้งหมด</th>
                        <th className="pb-3 px-2 font-medium text-center">รอติดตั้ง</th>
                        <th className="pb-3 px-2 font-medium text-center">กำลังติดตั้ง</th>
                        <th className="pb-3 px-2 font-medium text-center">ติดตั้งเสร็จ</th>
                        <th className="pb-3 px-2 font-medium text-center">ส่งมอบ</th>
                        <th className="pb-3 px-2 font-medium text-center">อนุมัติ</th>
                        <th className="pb-3 px-2 font-medium text-center">ปฏิเสธ</th>
                        <th className="pb-3 px-2 font-medium text-center">kW รวม</th>
                        <th className="pb-3 pl-2 font-medium">ความคืบหน้า</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((team) => {
                        const completionRate = team.totalJobs > 0
                          ? Math.round((team.completed / team.totalJobs) * 100)
                          : 0;
                        return (
                          <tr key={team.teamId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{team.teamName}</span>
                                {!team.isActive && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">ปิดใช้งาน</Badge>
                                )}
                                {team.teamId === 0 && (
                                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 bg-yellow-50">
                                    <AlertTriangle className="h-3 w-3 mr-1" />ยังไม่มอบหมาย
                                  </Badge>
                                )}
                              </div>
                              {team.phone && (
                                <span className="text-xs text-muted-foreground">{team.phone}</span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-semibold">{team.totalJobs}</td>
                            <td className="py-3 px-2 text-center">
                              {team.waiting > 0 ? (
                                <Badge variant="outline" className="bg-gray-50 text-gray-700">{team.waiting}</Badge>
                              ) : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {team.inProgress > 0 ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{team.inProgress}</Badge>
                              ) : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {team.completed > 0 ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{team.completed}</Badge>
                              ) : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {team.deliverySubmitted > 0 ? (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{team.deliverySubmitted}</Badge>
                              ) : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {team.deliveryApproved > 0 ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{team.deliveryApproved}</Badge>
                              ) : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center">
                              {team.deliveryRejected > 0 ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{team.deliveryRejected}</Badge>
                              ) : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="py-3 px-2 text-center font-medium">{team.totalKw > 0 ? team.totalKw.toLocaleString() : "-"}</td>
                            <td className="py-3 pl-2 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <Progress value={completionRate} className="h-2 flex-1" />
                                <span className="text-xs text-muted-foreground w-10 text-right">{completionRate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {report.map((team) => {
                const completionRate = team.totalJobs > 0
                  ? Math.round((team.completed / team.totalJobs) * 100)
                  : 0;
                return (
                  <Card key={team.teamId}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardHat className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{team.teamName}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{team.totalJobs} งาน</Badge>
                      </div>
                      {team.phone && (
                        <p className="text-xs text-muted-foreground">{team.phone}</p>
                      )}

                      {/* Status Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-gray-700">{team.waiting}</div>
                          <div className="text-[10px] text-gray-500">รอติดตั้ง</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-blue-700">{team.inProgress}</div>
                          <div className="text-[10px] text-blue-500">กำลังติดตั้ง</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-green-700">{team.completed}</div>
                          <div className="text-[10px] text-green-500">เสร็จแล้ว</div>
                        </div>
                      </div>

                      {/* Delivery Status */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">ส่งมอบ:</span>
                        {team.deliverySubmitted > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">รอตรวจ {team.deliverySubmitted}</Badge>
                        )}
                        {team.deliveryApproved > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">อนุมัติ {team.deliveryApproved}</Badge>
                        )}
                        {team.deliveryRejected > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">ปฏิเสธ {team.deliveryRejected}</Badge>
                        )}
                        {team.deliverySubmitted === 0 && team.deliveryApproved === 0 && team.deliveryRejected === 0 && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Progress + kW */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <Progress value={completionRate} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{completionRate}%</span>
                        </div>
                        {team.totalKw > 0 && (
                          <div className="flex items-center gap-1 text-xs text-yellow-600">
                            <Zap className="h-3 w-3" />
                            {team.totalKw.toLocaleString()} kW
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, color, bg }: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold text-foreground truncate">{value}</div>
          <div className="text-xs text-muted-foreground truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
