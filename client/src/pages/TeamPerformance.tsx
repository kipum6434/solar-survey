import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ClipboardCheck, TrendingUp, BarChart3 } from "lucide-react";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ROLE_LABELS: Record<string, string> = {
  admin_sender: "แอดมิน",
  surveyor: "เซลล์/สำรวจ",
  closer: "ปิดการขาย",
};

export default function TeamPerformance() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear() + 543);
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  const queryInput = useMemo(() => {
    const buddhistYear = selectedYear;
    const ceYear = buddhistYear - 543;
    return viewMode === "month"
      ? { month: selectedMonth, year: ceYear }
      : { year: ceYear };
  }, [selectedMonth, selectedYear, viewMode]);

  const { data: performance, isLoading } = trpc.teamPerformance.summary.useQuery(queryInput);

  const years = useMemo(() => {
    const currentBE = now.getFullYear() + 543;
    return Array.from({ length: 5 }, (_, i) => currentBE - i);
  }, []);

  const totalSurveys = performance?.reduce((sum, p) => sum + p.surveyCount, 0) ?? 0;
  const totalCompleted = performance?.reduce((sum, p) => sum + p.completedCount, 0) ?? 0;
  const teamCount = performance?.length ?? 0;

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ผลงานทีม</h1>
          <p className="text-muted-foreground text-sm">สรุปจำนวนเคสสำรวจต่อทีมงาน</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{teamCount}</p>
              <p className="text-sm text-muted-foreground">ทีมงานที่มีงาน</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSurveys}</p>
              <p className="text-sm text-muted-foreground">เคสทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-green-100 text-green-600">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCompleted}</p>
              <p className="text-sm text-muted-foreground">สำรวจเสร็จ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {viewMode === "month"
              ? `ผลงาน ${MONTHS[selectedMonth - 1]} ${selectedYear}`
              : `ผลงานปี ${selectedYear}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !performance || performance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>ไม่มีข้อมูลผลงานในช่วงเวลานี้</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 px-4 font-medium text-muted-foreground">#</th>
                    <th className="py-3 px-4 font-medium text-muted-foreground">ชื่อทีมงาน</th>
                    <th className="py-3 px-4 font-medium text-muted-foreground">ตำแหน่ง</th>
                    <th className="py-3 px-4 font-medium text-muted-foreground text-center">เคสทั้งหมด</th>
                    <th className="py-3 px-4 font-medium text-muted-foreground text-center">สำรวจเสร็จ</th>
                    <th className="py-3 px-4 font-medium text-muted-foreground text-center">อัตราสำเร็จ</th>
                    <th className="py-3 px-4 font-medium text-muted-foreground">กราฟ</th>
                  </tr>
                </thead>
                <tbody>
                  {performance
                    .sort((a, b) => b.surveyCount - a.surveyCount)
                    .map((member, idx) => {
                      const rate = member.surveyCount > 0 ? Math.round((member.completedCount / member.surveyCount) * 100) : 0;
                      const maxCount = Math.max(...performance.map(p => p.surveyCount), 1);
                      const barWidth = Math.round((member.surveyCount / maxCount) * 100);
                      return (
                        <tr key={member.teamMemberId} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                          <td className="py-3 px-4 font-medium">{member.name}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              member.role === "surveyor" ? "bg-blue-100 text-blue-700" :
                              member.role === "admin_sender" ? "bg-purple-100 text-purple-700" :
                              "bg-green-100 text-green-700"
                            }`}>
                              {ROLE_LABELS[member.role] || member.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-lg">{member.surveyCount}</td>
                          <td className="py-3 px-4 text-center font-semibold text-lg text-green-600">{member.completedCount}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-medium ${rate >= 70 ? "text-green-600" : rate >= 40 ? "text-amber-600" : "text-red-500"}`}>
                              {rate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 min-w-[120px]">
                            <div className="w-full bg-muted rounded-full h-3">
                              <div
                                className="bg-primary rounded-full h-3 transition-all"
                                style={{ width: `${barWidth}%` }}
                              />
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
    </div>
    </DashboardLayout>
  );
}
