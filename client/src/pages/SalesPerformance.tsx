import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Target, Users, TrendingUp, PhoneCall, CheckCircle2, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

type MemberPerf = {
  teamMemberId: number;
  name: string;
  assignedCount: number;
  totalCases: number;
  surveyedCount: number;
  wonCount: number;
  closeRate: number;
  followUpCount?: number;
};

export default function SalesPerformance() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear() + 543);
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  const queryInput = useMemo(() => {
    const ceYear = selectedYear - 543;
    return viewMode === "month"
      ? { month: selectedMonth, year: ceYear, tab: "lead" as const }
      : { year: ceYear, tab: "lead" as const };
  }, [selectedMonth, selectedYear, viewMode]);

  const { data: performance, isLoading } = trpc.teamPerformance.summary.useQuery(queryInput);

  const years = useMemo(() => {
    const currentBE = now.getFullYear() + 543;
    return Array.from({ length: 5 }, (_, i) => currentBE - i);
  }, []);

  const surveyors = (performance?.surveyors ?? []) as MemberPerf[];
  const adminSenders = (performance?.adminSenders ?? []) as MemberPerf[];
  const totals = performance?.totals ?? { totalCases: 0, totalSurveyed: 0, totalWon: 0, closeRate: 0 };

  // Calculate follow-up cases (surveyed but not won = in follow-up pipeline)
  const totalFollowUp = totals.totalSurveyed - totals.totalWon;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-600" />
              ประสิทธิภาพเซลล์
            </h1>
            <p className="text-muted-foreground text-sm mt-1">เปรียบเทียบจำนวนเคสที่ติดตามกับเคสที่ปิดการขายได้ของแต่ละคน</p>
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
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.totalCases}</p>
                  <p className="text-xs text-muted-foreground">เคสทั้งหมด</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalFollowUp}</p>
                  <p className="text-xs text-muted-foreground">กำลังติดตาม</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.totalWon}</p>
                  <p className="text-xs text-muted-foreground">ปิดการขายได้</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.closeRate}%</p>
                  <p className="text-xs text-muted-foreground">อัตราปิดการขาย</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Surveyor (Sales) Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-blue-600" />
                  ผลงานเซลล์ (คนสำรวจ) — เปรียบเทียบติดตาม vs ปิดการขาย
                </CardTitle>
              </CardHeader>
              <CardContent>
                {surveyors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>ไม่มีข้อมูลเซลล์ในช่วงเวลานี้</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-3 px-4 font-medium text-muted-foreground">#</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground">ชื่อเซลล์</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">ได้รับมอบหมาย</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">สำรวจแล้ว</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">กำลังติดตาม</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">ปิดการขายได้</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">Conversion Rate</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground">กราฟเปรียบเทียบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surveyors.map((member, idx) => {
                          const followingCount = member.surveyedCount - member.wonCount;
                          const conversionRate = member.totalCases > 0 ? Math.round((member.wonCount / member.totalCases) * 100) : 0;
                          const maxCases = Math.max(...surveyors.map(s => s.totalCases), 1);
                          const barTotal = Math.round((member.totalCases / maxCases) * 100);
                          const barWon = member.totalCases > 0 ? Math.round((member.wonCount / member.totalCases) * 100) : 0;

                          return (
                            <tr key={member.teamMemberId} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                              <td className="py-3 px-4 font-medium">{member.name}</td>
                              <td className="py-3 px-4 text-center font-semibold">{member.assignedCount}</td>
                              <td className="py-3 px-4 text-center font-semibold text-blue-600">{member.surveyedCount}</td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-semibold text-orange-600">{followingCount}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-semibold text-green-600">{member.wonCount}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge variant="outline" className={`text-xs font-bold ${
                                  conversionRate >= 50 ? "border-green-300 text-green-700 bg-green-50" :
                                  conversionRate >= 25 ? "border-amber-300 text-amber-700 bg-amber-50" :
                                  "border-red-300 text-red-700 bg-red-50"
                                }`}>
                                  {conversionRate >= 50 ? <ArrowUpRight className="h-3 w-3 mr-0.5 inline" /> : <ArrowDownRight className="h-3 w-3 mr-0.5 inline" />}
                                  {conversionRate}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 min-w-[160px]">
                                <div className="w-full bg-muted rounded-full h-4 relative overflow-hidden">
                                  <div
                                    className="bg-blue-200 rounded-full h-4 absolute left-0 top-0 transition-all"
                                    style={{ width: `${barTotal}%` }}
                                  />
                                  <div
                                    className="bg-green-500 rounded-full h-4 absolute left-0 top-0 transition-all"
                                    style={{ width: `${(barWon * barTotal) / 100}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-foreground/70">
                                    {member.wonCount}/{member.totalCases}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ปิดได้</span>
                                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-blue-200 inline-block" /> ทั้งหมด</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Sender Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-purple-600" />
                  ผลงานคนส่งสำรวจ (แอดมิน) — เปรียบเทียบติดตาม vs ปิดการขาย
                </CardTitle>
              </CardHeader>
              <CardContent>
                {adminSenders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>ไม่มีข้อมูลคนส่งสำรวจในช่วงเวลานี้</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-3 px-4 font-medium text-muted-foreground">#</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground">ชื่อ</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">เคสทั้งหมด</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">สำรวจแล้ว</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">กำลังติดตาม</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">ปิดการขายได้</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-center">Conversion Rate</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground">กราฟเปรียบเทียบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSenders.map((member, idx) => {
                          const followingCount = member.surveyedCount - member.wonCount;
                          const conversionRate = member.totalCases > 0 ? Math.round((member.wonCount / member.totalCases) * 100) : 0;
                          const maxCases = Math.max(...adminSenders.map(s => s.totalCases), 1);
                          const barTotal = Math.round((member.totalCases / maxCases) * 100);
                          const barWon = member.totalCases > 0 ? Math.round((member.wonCount / member.totalCases) * 100) : 0;

                          return (
                            <tr key={member.teamMemberId} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                              <td className="py-3 px-4 font-medium">{member.name}</td>
                              <td className="py-3 px-4 text-center font-semibold">{member.totalCases}</td>
                              <td className="py-3 px-4 text-center font-semibold text-blue-600">{member.surveyedCount}</td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-semibold text-orange-600">{followingCount}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-semibold text-green-600">{member.wonCount}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge variant="outline" className={`text-xs font-bold ${
                                  conversionRate >= 50 ? "border-green-300 text-green-700 bg-green-50" :
                                  conversionRate >= 25 ? "border-amber-300 text-amber-700 bg-amber-50" :
                                  "border-red-300 text-red-700 bg-red-50"
                                }`}>
                                  {conversionRate >= 50 ? <ArrowUpRight className="h-3 w-3 mr-0.5 inline" /> : <ArrowDownRight className="h-3 w-3 mr-0.5 inline" />}
                                  {conversionRate}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 min-w-[160px]">
                                <div className="w-full bg-muted rounded-full h-4 relative overflow-hidden">
                                  <div
                                    className="bg-purple-200 rounded-full h-4 absolute left-0 top-0 transition-all"
                                    style={{ width: `${barTotal}%` }}
                                  />
                                  <div
                                    className="bg-green-500 rounded-full h-4 absolute left-0 top-0 transition-all"
                                    style={{ width: `${(barWon * barTotal) / 100}%` }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-foreground/70">
                                    {member.wonCount}/{member.totalCases}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ปิดได้</span>
                                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-purple-200 inline-block" /> ทั้งหมด</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Note */}
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  <strong>หมายเหตุ:</strong> "กำลังติดตาม" = เคสที่สำรวจแล้วแต่ยังไม่ปิดการขาย (สถานะ: รอติดตาม, เสนอราคาแล้ว, เจรจาต่อรอง) |
                  "ปิดการขายได้" = เคสที่ติดตั้งเสร็จหรือส่งมอบแล้ว |
                  "Conversion Rate" = ปิดการขายได้ / เคสทั้งหมดที่ได้รับ
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
