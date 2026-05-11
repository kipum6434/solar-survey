import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Banknote, CheckCircle2, Clock, Upload, Search, Filter,
  FileText, Eye, Receipt, Loader2, ArrowUpDown, TrendingUp,
  Phone, Zap, AlertCircle, Plus, Pencil, X,
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editContractValue, setEditContractValue] = useState("");
  const [editCollectedAmount, setEditCollectedAmount] = useState("");

  // Get source names by group for dynamic filtering
  const { data: sourceNamesByGroup } = trpc.source.sourceNamesByGroup.useQuery();

  // Determine source/sourceExclude based on sourceMode (dynamic)
  const sourceFilter = useMemo(() => {
    if (!sourceMode || !sourceNamesByGroup) return {};
    const matchedGroup = Object.keys(sourceNamesByGroup).find(
      (g) => g.toLowerCase() === sourceMode.toLowerCase()
    );
    if (matchedGroup) {
      const groupNames = sourceNamesByGroup[matchedGroup] || [];
      return groupNames.length > 0 ? { sourceInclude: groupNames } : {};
    }
    return { source: sourceMode };
  }, [sourceMode, sourceNamesByGroup]);

  const utils = trpc.useUtils();

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
      utils.payment.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePayment = trpc.payment.update.useMutation({
    onSuccess: () => {
      toast.success("อัพเดทข้อมูลสำเร็จ");
      utils.payment.list.invalidate();
      setEditingPaymentId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filter and sort
  const filteredPayments = useMemo(() => {
    let result = [...payments];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p: any) =>
        p.customerName?.toLowerCase().includes(s) ||
        p.customerPhone?.includes(s) ||
        p.surveyId?.toString().includes(s)
      );
    }
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

  const startEditPayment = (payment: any) => {
    setEditingPaymentId(payment.id);
    setEditContractValue(String(payment.contractValue || 0));
    setEditCollectedAmount(String(payment.collectedAmount || 0));
  };

  const saveEditPayment = () => {
    if (editingPaymentId === null) return;
    const cv = parseFloat(editContractValue) || 0;
    const ca = parseFloat(editCollectedAmount) || 0;
    updatePayment.mutate({
      id: editingPaymentId,
      contractValue: cv,
      collectedAmount: ca,
      status: ca >= cv && cv > 0 ? "paid" : ca > 0 ? "partial" : "pending",
    });
  };

  const groupTitle = sourceMode ? sourceMode.toUpperCase() : "";

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            การเงิน {groupTitle && `- ${groupTitle}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการการเก็บเงินและหลักฐานการชำระเงิน
          </p>
        </div>
        {isAdmin && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                เพิ่มรายการเก็บเงิน
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <AddPaymentDialog
                sourceFilter={sourceFilter}
                onClose={() => setAddDialogOpen(false)}
                onSuccess={() => {
                  setAddDialogOpen(false);
                  utils.payment.list.invalidate();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
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
              รายการจะถูกสร้างอัตโนมัติเมื่อปิดการขาย หรือกดปุ่ม "เพิ่มรายการเก็บเงิน" ด้านบน
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment: any) => {
            const statusInfo = PAYMENT_STATUS_MAP[payment.status] || PAYMENT_STATUS_MAP.pending;
            const StatusIcon = statusInfo.icon;
            const outstanding = (payment.contractValue || 0) - (payment.collectedAmount || 0);
            const isEditing = editingPaymentId === payment.id;

            return (
              <Card key={payment.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {/* Top row: Customer info + Status + Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">
                            {payment.customerName || "ไม่ระบุชื่อ"}
                          </h3>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusInfo.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
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

                    {/* Bottom row: Financial info - editable */}
                    {isEditing ? (
                      <div className="flex items-end gap-3 border-t pt-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">มูลค่าสัญญา (บาท)</Label>
                          <Input
                            type="number"
                            value={editContractValue}
                            onChange={(e) => setEditContractValue(e.target.value)}
                            className="h-8 text-sm mt-1"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">เก็บแล้ว (บาท)</Label>
                          <Input
                            type="number"
                            value={editCollectedAmount}
                            onChange={(e) => setEditCollectedAmount(e.target.value)}
                            className="h-8 text-sm mt-1"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={saveEditPayment}
                            disabled={updatePayment.isPending}
                          >
                            {updatePayment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            บันทึก
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setEditingPaymentId(null)}
                          >
                            <X className="h-3 w-3" /> ยกเลิก
                          </Button>
                        </div>
                      </div>
                    ) : (
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
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => startEditPayment(payment)}
                            title="แก้ไขจำนวนเงิน"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

// ==================== Add Payment Dialog ====================
function AddPaymentDialog({
  sourceFilter,
  onClose,
  onSuccess,
}: {
  sourceFilter: Record<string, any>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [contractValue, setContractValue] = useState("");
  const [notes, setNotes] = useState("");

  const { data: wonSurveys, isLoading } = trpc.payment.wonSurveysWithoutPayment.useQuery(sourceFilter);

  const createPayment = trpc.payment.createFromFinance.useMutation({
    onSuccess: () => {
      toast.success("สร้างรายการเก็บเงินสำเร็จ");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedSurvey = wonSurveys?.find((s: any) => s.id === selectedSurveyId);

  const handleSelectSurvey = (surveyId: number) => {
    setSelectedSurveyId(surveyId);
    const survey = wonSurveys?.find((s: any) => s.id === surveyId);
    if (survey?.quotedPrice) {
      setContractValue(String(survey.quotedPrice));
    } else {
      setContractValue("");
    }
  };

  const handleSubmit = () => {
    if (!selectedSurveyId) {
      toast.error("กรุณาเลือกงานสำรวจ");
      return;
    }
    createPayment.mutate({
      surveyId: selectedSurveyId,
      contractValue: contractValue ? parseFloat(contractValue) : undefined,
      notes: notes || undefined,
    });
  };

  const formatCurrency = (amount: number) => {
    if (!amount && amount !== 0) return "฿0";
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          เพิ่มรายการเก็บเงิน
        </DialogTitle>
        <DialogDescription>
          เลือกงานที่ปิดการขายแล้วเพื่อสร้างรายการเก็บเงิน
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Survey Selection */}
        <div>
          <Label className="text-sm font-medium">เลือกงานสำรวจ (ปิดการขายแล้ว)</Label>
          {isLoading ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !wonSurveys || wonSurveys.length === 0 ? (
            <div className="mt-2 p-4 border rounded-lg text-center text-sm text-muted-foreground bg-muted/30">
              <Banknote className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              ไม่มีงานที่ปิดการขายแล้วที่ยังไม่มีรายการเก็บเงิน
            </div>
          ) : (
            <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1.5 border rounded-lg p-2">
              {wonSurveys.map((survey: any) => (
                <div
                  key={survey.id}
                  className={`p-2.5 rounded-md cursor-pointer border transition-colors ${
                    selectedSurveyId === survey.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelectSurvey(survey.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{survey.customerName || "ไม่ระบุชื่อ"}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {survey.customerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {survey.customerPhone}
                          </span>
                        )}
                        {survey.systemSize && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {survey.systemSize} kW
                          </span>
                        )}
                        {survey.source && (
                          <Badge variant="outline" className="text-[10px] py-0">{survey.source}</Badge>
                        )}
                      </div>
                    </div>
                    {survey.quotedPrice && (
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(survey.quotedPrice)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contract Value */}
        {selectedSurvey && (
          <>
            <div>
              <Label className="text-sm font-medium">มูลค่าสัญญา (บาท)</Label>
              <Input
                type="number"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="กรอกมูลค่าสัญญา"
                className="mt-1"
              />
              {selectedSurvey.quotedPrice && (
                <p className="text-xs text-muted-foreground mt-1">
                  ราคาเสนอจากงานสำรวจ: {formatCurrency(selectedSurvey.quotedPrice)}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm font-medium">หมายเหตุ (ไม่บังคับ)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น เงื่อนไขการชำระเงิน, จำนวนงวด..."
                className="mt-1"
                rows={2}
              />
            </div>
          </>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedSurveyId || createPayment.isPending}
          className="gap-2"
        >
          {createPayment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          สร้างรายการเก็บเงิน
        </Button>
      </DialogFooter>
    </>
  );
}

// ==================== Upload Slip Sub-component ====================
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
