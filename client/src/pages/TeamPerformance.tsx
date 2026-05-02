import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, BarChart3, Trophy } from "lucide-react";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

type MemberPerf = {
  teamMemberId: number;
  name: string;
  totalCases: number;
  surveyedCount: number;
  wonCount: number;
  closeRate: number;
};

function PerformanceTable({ title, icon, data, emptyText }: { title: string; icon: React.ReactNode; data: MemberPerf[]; emptyText: string }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>{emptyText}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCases = Math.max(...data.map(d => d.totalCases), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3 px-4 font-medium text-muted-foreground">#</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">ชื่อ</th>
                <th className="py-3 px-4 font-medium text-muted-foreground text-center">เคสทั้งหมด</th>
                <th className="py-3 px-4 font-medium text-muted-foreground text-center">สำรวจแล้ว</th>
                <th className="py-3 px-4 font-medium text-muted-foreground text-center">ปิดการขายได้</th>
                <th className="py-3 px-4 font-medium text-muted-foreground text-center">อัตราปิด</th>
                <th className="py-3 px-4 font-medium text-muted-foreground">กราฟ</th>
              </tr>
            </thead>
            <tbody>
              {data.map((member, idx) => {
                const barWidth = Math.round((member.totalCases / maxCases) * 100);
                return (
                  <tr key={member.teamMemberId} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4 text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 px-4 font-medium">{member.name}</td>
                    <td className="py-3 px-4 text-center font-semibold text-lg">{member.totalCases}</td>
                    <td className="py-3 px-4 text-center font-semibold text-blue-600">{member.surveyedCount}</td>
                    <td className="py-3 px-4 text-center font-semibold text-green-600">{member.wonCount}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${
                        member.closeRate >= 50 ? "text-green-600" : member.closeRate >= 25 ? "text-amber-600" : "text-red-500"
                      }`}>
                        {member.closeRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 min-w-[120px]">
                      <div className="w-full bg-muted rounded-full h-3 relative">
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
      </CardContent>
    </Card>
  );
}

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

  const totals = performance?.totals ?? { totalCases: 0, totalWon: 0, closeRate: 0 };
  const adminSenders = performance?.adminSenders ?? [];
  const surveyors = performance?.surveyors ?? [];

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ผลงานทีม</h1>
          <p className="text-muted-foreground text-sm">สรุปผลงานและอัตราปิดการขายแยกตามบทบาท</p>
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
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.totalCases}</p>
              <p className="text-sm text-muted-foreground">เคสทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-green-100 text-green-600">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.totalWon}</p>
              <p className="text-sm text-muted-foreground">ปิดการขายได้</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.closeRate}%</p>
              <p className="text-sm text-muted-foreground">อัตราปิดรวม</p>
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
          {/* Admin Sender Table */}
          <PerformanceTable
            title="ผลงานคนส่งสำรวจ (แอดมิน)"
            icon={<Users className="h-5 w-5 text-purple-600" />}
            data={adminSenders}
            emptyText="ไม่มีข้อมูลคนส่งสำรวจในช่วงเวลานี้"
          />

          {/* Surveyor Table */}
          <PerformanceTable
            title="ผลงานเซลล์ (คนสำรวจ)"
            icon={<Users className="h-5 w-5 text-blue-600" />}
            data={surveyors}
            emptyText="ไม่มีข้อมูลเซลล์ในช่วงเวลานี้"
          />
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
