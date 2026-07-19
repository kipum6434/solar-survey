import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ClipboardCheck, Search, Trash2, ExternalLink, FileText,
  CheckCircle2, PenTool, Clock, Send, FileSignature, UserCheck, AlertCircle,
} from "lucide-react";

type SignatureStatus = "all" | "not_sent" | "waiting_tech" | "waiting_customer" | "signed";

export default function DeliveryForms() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [search, setSearch] = useState("");
  const [signatureFilter, setSignatureFilter] = useState<SignatureStatus>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const { data: forms, isLoading } = trpc.deliveryForm.list.useQuery();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.deliveryForm.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบใบส่งมอบงานสำเร็จ");
      utils.deliveryForm.list.invalidate();
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkDeleteMutation = trpc.deliveryForm.bulkDelete.useMutation({
    onSuccess: (result) => {
      toast.success(`ลบใบส่งมอบงาน ${result.deleted} รายการสำเร็จ`);
      setSelectedIds(new Set());
      setShowBulkDelete(false);
      utils.deliveryForm.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Compute signature status for each form
  const getSignatureStatus = useCallback((form: NonNullable<typeof forms>[number]) => {
    if (form.customerSignatureUrl && form.signedAt) return "signed";
    if (form.technicianSignatureUrl && !form.customerSignatureUrl) return "waiting_customer";
    if (form.handoverToken && !form.technicianSignatureUrl) return "waiting_tech";
    return "not_sent";
  }, []);

  // Signature status counts
  const signatureCounts = useMemo(() => {
    if (!forms) return { not_sent: 0, waiting_tech: 0, waiting_customer: 0, signed: 0 };
    const counts = { not_sent: 0, waiting_tech: 0, waiting_customer: 0, signed: 0 };
    forms.forEach((f) => {
      const status = getSignatureStatus(f);
      counts[status]++;
    });
    return counts;
  }, [forms, getSignatureStatus]);

  const filteredForms = useMemo(() => {
    return (forms || []).filter((f) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchSearch =
          f.customerName?.toLowerCase().includes(q) ||
          f.customerPhone?.includes(q) ||
          String(f.surveyId).includes(q);
        if (!matchSearch) return false;
      }
      // Signature status filter
      if (signatureFilter !== "all") {
        return getSignatureStatus(f) === signatureFilter;
      }
      return true;
    });
  }, [forms, search, signatureFilter, getSignatureStatus]);

  // Bulk select helpers
  const currentIds = useMemo(() => filteredForms.map((f) => f.id), [filteredForms]);
  const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id));
  const someSelected = currentIds.some((id) => selectedIds.has(id)) && !allSelected;

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (currentIds.every((id) => prev.has(id))) {
        currentIds.forEach((id) => next.delete(id));
      } else {
        currentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [currentIds]);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const signatureStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
    not_sent: { label: "ยังไม่ส่งลิงก์", color: "bg-gray-100 text-gray-600", icon: Clock },
    waiting_tech: { label: "รอช่างเซ็น", color: "bg-orange-100 text-orange-700", icon: AlertCircle },
    waiting_customer: { label: "รอลูกค้าเซ็น", color: "bg-amber-100 text-amber-700", icon: Send },
    signed: { label: "เซ็นครบแล้ว", color: "bg-green-100 text-green-700", icon: UserCheck },
  };

  const filterTabs: { key: SignatureStatus; label: string; count: number }[] = [
    { key: "all", label: "ทั้งหมด", count: forms?.length ?? 0 },
    { key: "not_sent", label: "ยังไม่ส่งลิงก์", count: signatureCounts.not_sent },
    { key: "waiting_tech", label: "รอช่างเซ็น", count: signatureCounts.waiting_tech },
    { key: "waiting_customer", label: "รอลูกค้าเซ็น", count: signatureCounts.waiting_customer },
    { key: "signed", label: "เซ็นครบแล้ว", count: signatureCounts.signed },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-amber-500" />
              ใบส่งมอบงาน
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ติดตามสถานะลายเซ็นและจัดการใบส่งมอบงานทั้งหมด
            </p>
          </div>
        </div>

        {/* Signature Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className={`cursor-pointer transition-all ${signatureFilter === "not_sent" ? "ring-2 ring-gray-400" : "hover:shadow-md"}`} onClick={() => setSignatureFilter(signatureFilter === "not_sent" ? "all" : "not_sent")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{signatureCounts.not_sent}</p>
                <p className="text-xs text-muted-foreground">ยังไม่ส่งลิงก์</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${signatureFilter === "waiting_tech" ? "ring-2 ring-orange-400" : "hover:shadow-md"}`} onClick={() => setSignatureFilter(signatureFilter === "waiting_tech" ? "all" : "waiting_tech")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{signatureCounts.waiting_tech}</p>
                <p className="text-xs text-muted-foreground">รอช่างเซ็น</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${signatureFilter === "waiting_customer" ? "ring-2 ring-amber-400" : "hover:shadow-md"}`} onClick={() => setSignatureFilter(signatureFilter === "waiting_customer" ? "all" : "waiting_customer")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Send className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{signatureCounts.waiting_customer}</p>
                <p className="text-xs text-muted-foreground">รอลูกค้าเซ็น</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`cursor-pointer transition-all ${signatureFilter === "signed" ? "ring-2 ring-green-400" : "hover:shadow-md"}`} onClick={() => setSignatureFilter(signatureFilter === "signed" ? "all" : "signed")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{signatureCounts.signed}</p>
                <p className="text-xs text-muted-foreground">เซ็นครบแล้ว</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs + Search */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {filterTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={signatureFilter === tab.key ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setSignatureFilter(tab.key)}
                >
                  {tab.label}
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {tab.count}
                  </Badge>
                </Button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หรือรหัสงาน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bulk Action Bar */}
        {isAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 flex-1">
              <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-destructive" />
              </div>
              <span className="text-sm font-medium">
                เลือกแล้ว <span className="text-destructive font-bold">{selectedIds.size}</span> รายการ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                ยกเลิก
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> ลบ {selectedIds.size} รายการ
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {signatureFilter === "all" ? "รายการทั้งหมด" : filterTabs.find(t => t.key === signatureFilter)?.label}
                <span className="text-muted-foreground font-normal ml-2 text-sm">({filteredForms.length} รายการ)</span>
              </CardTitle>
              {isAdmin && filteredForms.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="เลือกทั้งหมด"
                  />
                  <span className="text-xs text-muted-foreground">เลือกทั้งหมด</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {search ? "ไม่พบใบส่งมอบงานที่ค้นหา" : signatureFilter !== "all" ? "ไม่มีรายการในหมวดนี้" : "ยังไม่มีใบส่งมอบงาน"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredForms.map((form) => {
                  const sigStatus = getSignatureStatus(form);
                  const sigConfig = signatureStatusConfig[sigStatus];
                  const SigIcon = sigConfig.icon;
                  return (
                    <div
                      key={form.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/delivery-forms/${form.id}`)}
                    >
                      {/* Checkbox */}
                      {isAdmin && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(form.id)}
                            onCheckedChange={() => toggleSelect(form.id)}
                            aria-label={`เลือก ${form.customerName || `งาน #${form.surveyId}`}`}
                          />
                        </div>
                      )}
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                        sigStatus === "signed" ? "bg-green-50" :
                        sigStatus === "waiting_customer" ? "bg-amber-50" :
                        sigStatus === "waiting_tech" ? "bg-orange-50" : "bg-gray-50"
                      }`}>
                        <ClipboardCheck className={`h-5 w-5 ${
                          sigStatus === "signed" ? "text-green-600" :
                          sigStatus === "waiting_customer" ? "text-amber-600" :
                          sigStatus === "waiting_tech" ? "text-orange-600" : "text-gray-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">
                            {form.customerName || `งาน #${form.surveyId}`}
                          </p>
                          {/* Signature Status Badge */}
                          <Badge className={`${sigConfig.color} text-[10px] px-1.5 py-0 h-5 gap-1 shrink-0`}>
                            <SigIcon className="h-3 w-3" />
                            {sigConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>#{form.surveyId}</span>
                          {form.customerPhone && <span>{form.customerPhone}</span>}
                          {form.technicianName && (
                            <span className="text-blue-600">ช่าง: {form.technicianName}</span>
                          )}
                          {form.signedAt && (
                            <span className="text-green-600">เซ็น: {formatDate(new Date(form.signedAt))}</span>
                          )}
                          {!form.signedAt && (
                            <span>สร้าง: {formatDate(form.createdAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Shortcut: จัดการหนังสือส่งมอบ */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/delivery-forms/${form.id}/handover`);
                          }}
                          title="จัดการหนังสือส่งมอบ"
                        >
                          <FileSignature className="h-4 w-4" />
                          <span className="hidden sm:inline text-xs">จัดการส่งมอบ</span>
                        </Button>
                        {form.pdfUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(form.pdfUrl!, "_blank");
                            }}
                            title="ดู PDF"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(form.id);
                            }}
                            title="ลบ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Single Delete Confirmation Dialog */}
        <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบใบส่งมอบงาน</AlertDialogTitle>
              <AlertDialogDescription>
                คุณต้องการลบใบส่งมอบงานนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการลบหลายรายการ</AlertDialogTitle>
              <AlertDialogDescription>
                คุณต้องการลบใบส่งมอบงาน <span className="font-bold text-destructive">{selectedIds.size} รายการ</span> หรือไม่?
                <br />
                <span className="text-xs mt-1 block">การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? "กำลังลบ..." : `ลบ ${selectedIds.size} รายการ`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
