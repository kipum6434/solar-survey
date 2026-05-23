import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { XCircle, RotateCcw, Search, BarChart3, Users, TrendingDown, Download } from "lucide-react";
import { useSourceGroup } from "@/hooks/useSourceGroup";

export default function CancelledCases() {
  const [search, setSearch] = useState("");
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<{ surveyId: number; customerName: string } | null>(null);
  const [filterReason, setFilterReason] = useState<string | null>(null);

  const sourceGroup = useSourceGroup();
  const utils = trpc.useUtils();
  const { data: cancelledList, isLoading } = trpc.cancelledCases.list.useQuery({ sourceGroup });
  const { data: reasonStats } = trpc.cancelledCases.stats.useQuery({ sourceGroup });

  const reopenMutation = trpc.cancelledCases.reopen.useMutation({
    onSuccess: () => {
      toast.success("เปิดเคสใหม่สำเร็จ");
      utils.cancelledCases.list.invalidate();
      utils.cancelledCases.stats.invalidate();
      setReopenDialogOpen(false);
      setReopenTarget(null);
    },
    onError: (err) => {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    },
  });

  // Filter data
  const filteredList = (cancelledList || []).filter((item) => {
    const matchSearch = !search || 
      item.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.customer.phone && item.customer.phone.includes(search)) ||
      (item.cancelLog?.reason && item.cancelLog.reason.toLowerCase().includes(search.toLowerCase()));
    
    const matchReason = !filterReason || 
      (item.cancelLog?.reason && extractBaseReason(item.cancelLog.reason) === filterReason);
    
    return matchSearch && matchReason;
  });

  // Extract base reason (before ": detail")
  function extractBaseReason(reason: string): string {
    const baseReasons = ["ได้เจ้าที่ถูกกว่า", "เปลี่ยนใจไม่ติด", "งบไม่พอ", "ติดต่อไม่ได้", "อื่นๆ"];
    for (const base of baseReasons) {
      if (reason === base || reason.startsWith(base + ": ")) return base;
    }
    return "อื่นๆ";
  }

  // Group stats by base reason for display
  const groupedStats = (() => {
    if (!reasonStats) return [];
    const grouped: Record<string, number> = {};
    for (const stat of reasonStats) {
      const base = extractBaseReason(stat.reason);
      grouped[base] = (grouped[base] || 0) + Number(stat.count);
    }
    return Object.entries(grouped)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const totalCancelled = filteredList.length;
  const totalAll = cancelledList?.length || 0;

  const handleExportExcel = async () => {
    if (!cancelledList || cancelledList.length === 0) return;
    try {
      // Build CSV data (Excel-compatible with BOM)
      const headers = ["ชื่อลูกค้า", "เบอร์โทร", "จังหวัด", "แหล่งที่มา", "เหตุผลยกเลิก", "รายละเอียด", "เซลล์", "วันที่ยกเลิก"];
      const rows = cancelledList.map(item => {
        const baseReason = item.cancelLog?.reason ? extractBaseReason(item.cancelLog.reason) : "ไม่ระบุ";
        const fullReason = item.cancelLog?.reason || "";
        const detail = fullReason !== baseReason ? fullReason.replace(baseReason + ": ", "") : "-";
        const cancelDate = item.cancelLog?.createdAt ? formatDate(item.cancelLog.createdAt) : formatDate(item.survey.updatedAt);
        return [
          item.customer.name,
          item.customer.phone || "-",
          item.customer.province || "-",
          item.customer.source || "-",
          baseReason,
          detail,
          item.closerName || "-",
          cancelDate,
        ];
      });
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `เคสยกเลิก${sourceGroup ? `_${sourceGroup.toUpperCase()}` : ""}_${new Date().toLocaleDateString("th-TH")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("ส่งออกไฟล์สำเร็จ");
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการส่งออก");
    }
  };

  const handleReopen = (surveyId: number, customerName: string) => {
    setReopenTarget({ surveyId, customerName });
    setReopenDialogOpen(true);
  };

  const confirmReopen = () => {
    if (!reopenTarget) return;
    reopenMutation.mutate({ surveyId: reopenTarget.surveyId });
  };

  const formatDate = (timestamp: number | Date | null | undefined) => {
    if (!timestamp) return "-";
    const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
  };

  // Color mapping for reasons
  const reasonColors: Record<string, string> = {
    "ได้เจ้าที่ถูกกว่า": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    "เปลี่ยนใจไม่ติด": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    "งบไม่พอ": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    "ติดต่อไม่ได้": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    "อื่นๆ": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">เคสที่ยกเลิก{sourceGroup ? ` (${sourceGroup.toUpperCase()})` : ""}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              รายการเคสที่ถูกยกเลิกจากการติดตาม พร้อมสถิติเหตุผล
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportExcel}
            disabled={!cancelledList || cancelledList.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${!filterReason ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterReason(null)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAll}</p>
                  <p className="text-xs text-muted-foreground">ทั้งหมด</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {groupedStats.slice(0, 3).map((stat) => (
            <Card 
              key={stat.reason}
              className={`cursor-pointer transition-all hover:shadow-md ${filterReason === stat.reason ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilterReason(filterReason === stat.reason ? null : stat.reason)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <TrendingDown className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.count}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[100px]">{stat.reason}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Reason Statistics Breakdown */}
        {groupedStats.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                สถิติเหตุผลยกเลิก
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {groupedStats.map((stat) => {
                  const percentage = totalAll > 0 ? Math.round((stat.count / totalAll) * 100) : 0;
                  return (
                    <div key={stat.reason} className="flex items-center gap-3">
                      <div className="w-32 md:w-40 text-sm font-medium truncate">{stat.reason}</div>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/70 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(percentage, 8)}%` }}
                        >
                          <span className="text-[10px] font-medium text-primary-foreground">{stat.count}</span>
                        </div>
                      </div>
                      <div className="w-12 text-right text-sm font-medium text-muted-foreground">
                        {percentage}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search + Filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, เหตุผล..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {filterReason && (
            <Button variant="outline" size="sm" onClick={() => setFilterReason(null)}>
              ล้างตัวกรอง: {filterReason}
            </Button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead className="hidden md:table-cell">เบอร์โทร</TableHead>
                    <TableHead className="hidden md:table-cell">จังหวัด</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead className="hidden md:table-cell">เซลล์</TableHead>
                    <TableHead className="hidden md:table-cell">วันที่ยกเลิก</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        กำลังโหลด...
                      </TableCell>
                    </TableRow>
                  ) : filteredList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        ไม่พบเคสที่ยกเลิก
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredList.map((item, idx) => {
                      const baseReason = item.cancelLog?.reason ? extractBaseReason(item.cancelLog.reason) : "ไม่ระบุ";
                      const fullReason = item.cancelLog?.reason || "ไม่ระบุเหตุผล";
                      return (
                        <TableRow key={item.survey.id}>
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{item.customer.name}</div>
                            <div className="text-xs text-muted-foreground md:hidden">
                              {item.customer.phone || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{item.customer.phone || "-"}</TableCell>
                          <TableCell className="hidden md:table-cell">{item.customer.province || "-"}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${reasonColors[baseReason] || reasonColors["อื่นๆ"]}`}>
                              {baseReason}
                            </Badge>
                            {fullReason !== baseReason && (
                              <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={fullReason}>
                                {fullReason.replace(baseReason + ": ", "")}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {item.closerName || "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {item.cancelLog?.createdAt ? formatDate(item.cancelLog.createdAt) : formatDate(item.survey.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
                              onClick={() => handleReopen(item.survey.id, item.customer.name)}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              เปิดใหม่
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {!isLoading && filteredList.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            แสดง {filteredList.length} จาก {totalAll} เคส
          </p>
        )}

        {/* Reopen Confirmation Dialog */}
        <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เปิดเคสใหม่</DialogTitle>
              <DialogDescription>
                ต้องการเปิดเคสของลูกค้า <span className="font-medium text-foreground">{reopenTarget?.customerName}</span> ใหม่หรือไม่?
                <br />
                สถานะจะเปลี่ยนกลับเป็น "ติดตาม" เพื่อให้ทีมเซลล์ดำเนินการต่อ
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button 
                onClick={confirmReopen} 
                disabled={reopenMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {reopenMutation.isPending ? "กำลังดำเนินการ..." : "ยืนยันเปิดใหม่"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
