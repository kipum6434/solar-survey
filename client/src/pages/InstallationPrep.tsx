import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, Calendar, MapPin, User, Zap, Sun,
  Battery, Cpu, ChevronLeft, ChevronRight, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const SYSTEM_TYPE_MAP: Record<string, string> = {
  string: "String",
  micro: "Micro",
  both: "String + Micro",
  hybrid: "Hybrid",
};

interface EquipmentSummary {
  inverters: Record<string, number>;
  panels: Record<string, { count: number; brand: string }>;
  batteries: Record<string, number>;
  optimizers: Record<string, number>;
  totalSystemKW: number;
  totalPanels: number;
}

export default function InstallationPrep() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Fetch all installations for the selected month (no pagination, get all)
  const { data, isLoading } = trpc.installation.list.useQuery({
    page: 1,
    limit: 200,
    month,
    year,
    installationStatus: "all",
  });

  // Compute equipment summary
  const { installations, summary } = useMemo(() => {
    if (!data?.data) return { installations: [], summary: null };

    const items = data.data.map((d: any) => ({
      id: d.survey.id,
      customerName: d.customer.name,
      address: d.customer.fullAddress || d.customer.address || `${d.customer.district || ""} ${d.customer.province || ""}`.trim(),
      installationDate: d.survey.installationDate,
      installationStatus: d.survey.installationStatus,
      systemSize: d.survey.systemSize ? parseFloat(d.survey.systemSize) : null,
      panelCount: d.survey.panelCount,
      panelBrand: d.survey.panelBrand,
      inverterModel: d.survey.inverterModel,
      battery: d.survey.needBattery,
      optimizer: d.survey.needOptimizer,
      systemType: d.survey.systemType,
      installerTeam: d.installerTeam,
    }));

    // Build summary
    const sum: EquipmentSummary = {
      inverters: {},
      panels: {},
      batteries: {},
      optimizers: {},
      totalSystemKW: 0,
      totalPanels: 0,
    };

    for (const item of items) {
      // Inverters
      if (item.inverterModel) {
        const key = item.inverterModel.trim();
        sum.inverters[key] = (sum.inverters[key] || 0) + 1;
      }
      // Panels
      if (item.panelBrand) {
        const key = item.panelBrand.trim();
        if (!sum.panels[key]) sum.panels[key] = { count: 0, brand: key };
        sum.panels[key].count += item.panelCount || 0;
      }
      sum.totalPanels += item.panelCount || 0;
      // Battery
      if (item.battery && item.battery.trim() !== "" && item.battery.trim() !== "-") {
        const key = item.battery.trim();
        sum.batteries[key] = (sum.batteries[key] || 0) + 1;
      }
      // Optimizer
      if (item.optimizer && item.optimizer.trim() !== "" && item.optimizer.trim() !== "-") {
        const key = item.optimizer.trim();
        sum.optimizers[key] = (sum.optimizers[key] || 0) + 1;
      }
      // System size
      if (item.systemSize) {
        sum.totalSystemKW += item.systemSize;
      }
    }

    return { installations: items, summary: sum };
  }, [data]);

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return "-";
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear() + 543}`;
  };

  const statusLabel = (s: string | null) => {
    switch (s) {
      case "waiting": return { text: "รอติดตั้ง", color: "bg-amber-100 text-amber-800" };
      case "in_progress": return { text: "กำลังติดตั้ง", color: "bg-blue-100 text-blue-800" };
      case "completed": return { text: "ติดตั้งเสร็จ", color: "bg-green-100 text-green-800" };
      case "delivered": return { text: "ส่งมอบแล้ว", color: "bg-purple-100 text-purple-800" };
      default: return { text: "รอติดตั้ง", color: "bg-gray-100 text-gray-700" };
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-orange-600" />
              เตรียมสินค้าติดตั้ง
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              ดูรายการอุปกรณ์ที่ต้องเตรียมสำหรับงานติดตั้งในแต่ละเดือน
            </p>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THAI_MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!isLoading && summary && (
          <>
            {/* Monthly Equipment Summary */}
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-orange-600" />
                  สรุปอุปกรณ์ประจำเดือน {THAI_MONTHS[month - 1]} {year + 543}
                  <Badge variant="secondary" className="ml-2">{installations.length} งาน</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total System */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      กำลังผลิตรวม
                    </div>
                    <p className="text-2xl font-bold text-yellow-700">{summary.totalSystemKW.toFixed(1)} kW</p>
                  </div>

                  {/* Total Panels */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Sun className="h-4 w-4 text-blue-600" />
                      แผงโซลาร์รวม
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{summary.totalPanels} แผง</p>
                    {Object.entries(summary.panels).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(summary.panels).map(([brand, info]) => (
                          <div key={brand} className="flex justify-between text-xs text-muted-foreground">
                            <span>{brand}</span>
                            <span className="font-medium">{info.count} แผง</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inverters */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Cpu className="h-4 w-4 text-green-600" />
                      อินเวอร์เตอร์
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {Object.values(summary.inverters).reduce((a, b) => a + b, 0)} ตัว
                    </p>
                    {Object.entries(summary.inverters).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(summary.inverters).map(([model, count]) => (
                          <div key={model} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[120px]">{model}</span>
                            <span className="font-medium">{count} ตัว</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Batteries */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Battery className="h-4 w-4 text-purple-600" />
                      แบตเตอรี่
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                      {Object.values(summary.batteries).reduce((a, b) => a + b, 0)} ชุด
                    </p>
                    {Object.entries(summary.batteries).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(summary.batteries).map(([model, count]) => (
                          <div key={model} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[120px]">{model}</span>
                            <span className="font-medium">{count} ชุด</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {Object.entries(summary.batteries).length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">ไม่มีแบตเตอรี่</p>
                    )}
                  </div>
                </div>

                {/* Optimizer summary */}
                {Object.entries(summary.optimizers).length > 0 && (
                  <div className="mt-4 bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Cpu className="h-4 w-4 text-indigo-600" />
                      Optimizer
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(summary.optimizers).map(([model, count]) => (
                        <Badge key={model} variant="secondary" className="text-xs">
                          {model} × {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Installation List - Compact Cards */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                รายการงานติดตั้ง ({installations.length} งาน)
              </h2>

              {installations.length === 0 && (
                <Card className="py-12">
                  <CardContent className="text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>ไม่มีงานติดตั้งในเดือนนี้</p>
                  </CardContent>
                </Card>
              )}

              {installations.map((item) => {
                const status = statusLabel(item.installationStatus);
                return (
                  <Card key={item.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                        {/* Left: Date + Status */}
                        <div className="flex items-center gap-3 lg:w-[180px] shrink-0">
                          <div className="text-center bg-orange-50 rounded-lg p-2 min-w-[60px]">
                            <Calendar className="h-3.5 w-3.5 mx-auto text-orange-600 mb-0.5" />
                            <p className="text-xs font-bold text-orange-800">
                              {formatDate(item.installationDate)}
                            </p>
                          </div>
                          <Badge className={`text-xs ${status.color} border-0`}>
                            {status.text}
                          </Badge>
                        </div>

                        {/* Middle: Customer info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm truncate">{item.customerName}</span>
                            {item.installerTeam && (
                              <Badge variant="outline" className="text-xs shrink-0" style={{ borderColor: item.installerTeam.color || undefined }}>
                                {item.installerTeam.name}
                              </Badge>
                            )}
                          </div>
                          {item.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-xs text-muted-foreground line-clamp-1">{item.address}</span>
                            </div>
                          )}
                        </div>

                        {/* Right: Equipment */}
                        <div className="lg:w-[360px] shrink-0">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {item.systemSize && (
                              <div className="flex items-center gap-1.5">
                                <Zap className="h-3 w-3 text-yellow-600" />
                                <span className="text-muted-foreground">ขนาด:</span>
                                <span className="font-medium">{item.systemSize} kW</span>
                              </div>
                            )}
                            {item.systemType && (
                              <div className="flex items-center gap-1.5">
                                <Layers className="h-3 w-3 text-gray-600" />
                                <span className="text-muted-foreground">ระบบ:</span>
                                <span className="font-medium">{SYSTEM_TYPE_MAP[item.systemType] || item.systemType}</span>
                              </div>
                            )}
                            {item.inverterModel && (
                              <div className="flex items-center gap-1.5">
                                <Cpu className="h-3 w-3 text-green-600" />
                                <span className="text-muted-foreground">INV:</span>
                                <span className="font-medium truncate max-w-[140px]">{item.inverterModel}</span>
                              </div>
                            )}
                            {item.panelBrand && (
                              <div className="flex items-center gap-1.5">
                                <Sun className="h-3 w-3 text-blue-600" />
                                <span className="text-muted-foreground">แผง:</span>
                                <span className="font-medium">{item.panelBrand} × {item.panelCount || "?"}</span>
                              </div>
                            )}
                            {item.battery && item.battery.trim() !== "" && item.battery.trim() !== "-" && (
                              <div className="flex items-center gap-1.5 col-span-2">
                                <Battery className="h-3 w-3 text-purple-600" />
                                <span className="text-muted-foreground">แบต:</span>
                                <span className="font-medium truncate">{item.battery}</span>
                              </div>
                            )}
                            {item.optimizer && item.optimizer.trim() !== "" && item.optimizer.trim() !== "-" && (
                              <div className="flex items-center gap-1.5 col-span-2">
                                <Cpu className="h-3 w-3 text-indigo-600" />
                                <span className="text-muted-foreground">Optimizer:</span>
                                <span className="font-medium truncate">{item.optimizer}</span>
                              </div>
                            )}
                            {!item.inverterModel && !item.panelBrand && !item.systemSize && (
                              <div className="col-span-2 text-muted-foreground italic">
                                ยังไม่ได้ระบุอุปกรณ์
                              </div>
                            )}
                          </div>
                        </div>
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
