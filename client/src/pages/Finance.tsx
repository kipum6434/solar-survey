import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Banknote, CheckCircle2, Clock, Upload, Search, Filter,
  FileText, Eye, Receipt, Loader2, ArrowUpDown, TrendingUp,
  Phone, Zap, AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "รอเก็บเงิน", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  paid: { label: "เก็บครบแล้ว", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  partial: { label: "เก็บบางส่วน", color: "bg-blue-50 text-blue-700 border-blue-200", icon: TrendingUp },
  overdue: { label: "เกินกำหนด", color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
};

interface FinanceProps {
  sourceMode?: string | null;
}

export default function Finance(props: FinanceProps & Record<string, any>) {
  const sourceMode = props.sourceMode ?? null;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount_high" | "amount_low">("newest");

  // Get source names by group for dynamic filtering
  const { data: sourceNamesByGroup } = trpc.source.sourceNamesByGroup.useQuery();

  // Determine source/sourceExclude based on sourceMode (dynamic)
  const sourceFilter = useMemo(() => {
    if (!sourceMode || !sourceNamesByGroup) return {};
    // Find the matching group name (case-insensitive)
    const matchedGroup = Object.keys(sourceNamesByGroup).find(
      (g) => g.toLowerCase() === sourceMode.toLowerCase()
    );
    if (matchedGroup) {
      const groupNames = sourceNamesByGroup[matchedGroup] || [];
      return groupNames.length > 0 ? { sourceInclude: groupNames } : {};
    }
    return { source: sourceMode };
  }, [sourceMode, sourceNamesByGroup]);

  // Get payments list
  const { data: paymentsResult, isLoading } = trpc.payment.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 200,
    ...sourceFilter,
  });
  const payments = paymentsResult?.data ?? [];

  // Upload slip mutation
  const uploadSlip = trpc.payment.uploadSlip.useMutation({
    onSuccess: () => {
      toast.success("อัพโหลดสลิปสำเร็จ");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePayment = trpc.payment.update.useMutation({
    onSuccess: () => {
      toast.success("อัพเดทสถานะสำเร็จ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filter and sort
  const filteredPayments = useMemo(() => {
    let result = [...payments];

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p: any) =>
        p.customerName?.toLowerCase().includes(s) ||
        p.customerPhone?.includes(s) ||
        p.surveyId?.toString().includes(s)
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      case "oldest":
        result.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
        break;
      case "amount_high":
        result.sort((a: any, b: any) => (b.contractValue || 0) - (a.contractValue || 0));
        break;
      case "amount_low":
        result.sort((a: any, b: any) => (a.contractValue || 0) - (b.contractValue || 0));
        break;
    }

    return result;
  }, [payments, search, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    const pending = payments.filter((p: any) => p.status === "pending" || p.status === "overdue");
    const partial = payments.filter((p: any) => p.status === "partial");
    const paid = payments.filter((p: any) => p.status === "paid");
    
    const totalContract = payments.reduce((sum: number, p: any) => sum + (p.contractValue || 0), 0);
    const totalCollected = payments.reduce((sum: number, p: any) => sum + (p.collectedAmount || 0), 0);
    const totalOutstanding = totalContract - totalCollected;

    return {
      total: payments.length,
      pendingCount: pending.length,
      partialCount: partial.length,
      paidCount: paid.length,
      totalContract,
      totalCollected,
      totalOutstanding: totalOutstanding > 0 ? totalOutstanding : 0,
    };
  }, [payments]);

  const formatCurrency = (amount: number) => {
    if (!amount && amount !== 0) return "฿0";
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return "-";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return phone;
  };

  const groupTitle = sourceMode ? sourceMode.toUpperCase() : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          การเงิน {groupTitle && `- ${groupTitle}`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          จัดการการเก็บเงินและหลักฐานการชำระเงิน
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ทั้งหมด</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalContract)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">รอเก็บเงิน</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">เก็บครบแล้ว</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.paidCount}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">ยอดค้างรวม</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อลูกค้า / เบอร์โทร..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="pending">รอเก็บเงิน</SelectItem>
                <SelectItem value="partial">เก็บบางส่วน</SelectItem>
                <SelectItem value="paid">เก็บครบแล้ว</SelectItem>
                <SelectItem value="overdue">เกินกำหนด</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-full sm:w-[160px] text-sm">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="เรียงตาม" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">ใหม่สุด</SelectItem>
                <SelectItem value="oldest">เก่าสุด</SelectItem>
                <SelectItem value="amount_high">มูลค่าสูง-ต่ำ</SelectItem>
                <SelectItem value="amount_low">มูลค่าต่ำ-สูง</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Banknote className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">ไม่พบรายการเก็บเงิน</p>
            <p className="text-xs text-muted-foreground mt-1">
              รายการจะปรากฏเมื่อมีงานที่พร้อมเก็บเงิน
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment: any) => {
            const statusInfo = PAYMENT_STATUS_MAP[payment.status] || PAYMENT_STATUS_MAP.pending;
            const StatusIcon = statusInfo.icon;
            const outstanding = (payment.contractValue || 0) - (payment.collectedAmount || 0);

            return (
              <Card key={payment.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Top row: Customer info + Status */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Link
                            href={`/surveys/${payment.surveyId}`}
                            className="text-sm font-semibold hover:text-primary transition-colors"
                          >
                            {payment.customerName || `งาน #${payment.surveyId}`}
                          </Link>
                          <Badge className={`${statusInfo.color} border text-[10px] gap-1`}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {payment.customerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {formatPhone(payment.customerPhone)}
                            </span>
                          )}
                          {payment.systemSize && (
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {payment.systemSize} kW
                            </span>
                          )}
                          {payment.source && (
                            <Badge variant="outline" className="text-[10px] py-0">{payment.source}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {payment.slipUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => window.open(payment.slipUrl, "_blank")}
                          >
                            <Eye className="h-3 w-3" /> ดูสลิป
                          </Button>
                        )}
                        {payment.status === "pending" && isAdmin && (
                          <PaymentUploadSlip
                            paymentId={payment.id}
                            onUpload={(file) => {
                              const reader = new FileReader();
                              reader.onload = () => {
                                const base64 = (reader.result as string).split(",")[1];
                                uploadSlip.mutate({
                                  id: payment.id,
                                  base64Data: base64,
                                  fileName: file.name,
                                  mimeType: file.type,
                                });
                              };
                              reader.readAsDataURL(file);
                            }}
                            isPending={uploadSlip.isPending}
                          />
                        )}
                        {(payment.status === "pending" || payment.status === "partial") && isAdmin && (
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              updatePayment.mutate({ id: payment.id, status: "paid" });
                            }}
                            disabled={updatePayment.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3" /> เก็บครบแล้ว
                          </Button>
                        )}
                        <Link href={`/surveys/${payment.surveyId}`}>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs">
                            <FileText className="h-3 w-3" /> ดูงาน
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Bottom row: Financial info */}
                    <div className="flex items-center gap-4 text-xs border-t pt-2">
                      <div className="flex-1">
                        <span className="text-muted-foreground">มูลค่าสัญญา:</span>{" "}
                        <span className="font-semibold">{formatCurrency(payment.contractValue || 0)}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-muted-foreground">เก็บแล้ว:</span>{" "}
                        <span className="font-semibold text-green-600">{formatCurrency(payment.collectedAmount || 0)}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-muted-foreground">ค้าง:</span>{" "}
                        <span className={`font-semibold ${outstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(outstanding > 0 ? outstanding : 0)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sub-component for uploading payment slip
function PaymentUploadSlip({
  paymentId,
  onUpload,
  isPending,
}: {
  paymentId: number;
  onUpload: (file: File) => void;
  isPending: boolean;
}) {
  return (
    <>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id={`slip-upload-${paymentId}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              toast.error("ไฟล์ต้องไม่เกิน 5MB");
              return;
            }
            onUpload(file);
          }
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="gap-1 text-xs"
        onClick={() => document.getElementById(`slip-upload-${paymentId}`)?.click()}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        อัพสลิป
      </Button>
    </>
  );
}
