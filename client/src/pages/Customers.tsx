import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { SourceCombobox } from "@/components/SourceCombobox";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Users, Plus, Search, Phone, Mail, MapPin, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, Eye,
  LayoutList, Table2, Zap, FileUp, Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export default function Customers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [showImport, setShowImport] = useState(false);

  const importMutation = trpc.customer.importBatch.useMutation({
    onSuccess: (result) => {
      toast.success(`นำเข้าสำเร็จ ${result.successCount} รายการ` + (result.errorCount > 0 ? ` (ผิดพลาด ${result.errorCount})` : ""));
      if (result.errors.length > 0) {
        result.errors.forEach(e => toast.error(e));
      }
      setShowImport(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Month/Year filter
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterByMonth, setFilterByMonth] = useState(false);

  const queryInput = useMemo(() => ({
    search,
    page,
    limit: 30,
    month: filterByMonth ? selectedMonth : undefined,
    year: filterByMonth ? selectedYear : undefined,
  }), [search, page, filterByMonth, selectedMonth, selectedYear]);

  const { data, isLoading, refetch } = trpc.customer.list.useQuery(queryInput);
  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => { toast.success("เพิ่มลูกค้าสำเร็จ"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => { toast.success("ลบลูกค้าสำเร็จ"); setDeleteId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 30);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const handleMonthNav = (dir: -1 | 1) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
    setFilterByMonth(true);
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ลูกค้า</h1>
            <p className="text-sm text-muted-foreground mt-1">จัดการข้อมูลลูกค้าทั้งหมด</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
              <FileUp className="h-4 w-4" /> Import Excel
            </Button>
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="h-4 w-4" /> เพิ่มลูกค้า
            </Button>
          </div>
        </div>

        {/* Month Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            variant={!filterByMonth ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilterByMonth(false); setPage(1); }}
            className="shrink-0"
          >
            ทั้งหมด
          </Button>
          <div className="h-6 w-px bg-border shrink-0" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleMonthNav(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {THAI_MONTHS_SHORT.map((m, i) => (
            <Button
              key={i}
              variant={filterByMonth && selectedMonth === i + 1 ? "default" : "outline"}
              size="sm"
              onClick={() => { setSelectedMonth(i + 1); setFilterByMonth(true); setPage(1); }}
              className="shrink-0 text-xs px-2.5"
            >
              {m}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleMonthNav(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); if (filterByMonth) setPage(1); }}>
            <SelectTrigger className="w-[100px] h-8 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search + View Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter info */}
        {filterByMonth && (
          <div className="text-sm text-muted-foreground">
            แสดงลูกค้าที่สร้างในเดือน <span className="font-semibold text-foreground">{THAI_MONTHS[selectedMonth - 1]} {selectedYear + 543}</span>
            {data && <span className="ml-2">({data.total} ราย)</span>}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <>
            {viewMode === "table" ? (
              <CustomerTableView
                data={data.data}
                onRowClick={(id) => setLocation(`/customers/${id}`)}
                onEdit={(id) => setLocation(`/customers/${id}?edit=true`)}
                onDelete={(id) => setDeleteId(id)}
              />
            ) : (
              <CustomerGridView
                data={data.data}
                onRowClick={(id) => setLocation(`/customers/${id}`)}
                onEdit={(id) => setLocation(`/customers/${id}?edit=true`)}
                onDelete={(id) => setDeleteId(id)}
              />
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">หน้า {page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">{search || filterByMonth ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}</p>
            {!search && !filterByMonth && (
              <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> เพิ่มลูกค้าคนแรก
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Customer Dialog */}
      <AddCustomerDialog open={showAdd} onOpenChange={setShowAdd} onSubmit={(d) => createMutation.mutate(d)} loading={createMutation.isPending} />

      {/* Import Excel Dialog */}
      <ImportExcelDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={(customers) => importMutation.mutate({ customers })}
        loading={importMutation.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>คุณต้องการลบลูกค้ารายนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

/* ==================== TABLE VIEW ==================== */
function CustomerTableView({ data, onRowClick, onEdit, onDelete }: { data: any[]; onRowClick: (id: number) => void; onEdit: (id: number) => void; onDelete: (id: number) => void }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">ชื่อลูกค้า</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">เบอร์โทร</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">อีเมล</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">ช่องทาง</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">เขต/อำเภอ</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">จังหวัด</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">ค่าไฟ/เดือน</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">ระบบไฟ</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">วันที่สร้าง</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap w-10"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((c: any) => (
              <tr
                key={c.id}
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onRowClick(c.id)}
              >
                <td className="px-3 py-2.5 font-medium max-w-[200px] truncate">
                  {c.name}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                  {c.phone || "-"}
                </td>
                <td className="px-3 py-2.5 max-w-[180px] truncate hidden md:table-cell text-muted-foreground">
                  {c.email || "-"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
                  {c.source ? (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {c.source || "-"}
                    </Badge>
                  ) : "-"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground">
                  {c.district || "-"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell text-muted-foreground">
                  {c.province || "-"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell">
                  {c.electricityBill ? (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Zap className="h-3 w-3" />
                      {Number(c.electricityBill).toLocaleString()} ฿
                    </span>
                  ) : <span className="text-muted-foreground">-</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell text-muted-foreground text-xs">
                  {c.phaseType === "single" ? "1 เฟส" : c.phaseType === "three" ? "3 เฟส" : "-"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell text-muted-foreground text-xs">
                  {new Date(c.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </td>
                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onRowClick(c.id)}>
                        <Eye className="h-4 w-4 mr-2" /> ดูรายละเอียด
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(c.id)}>
                        <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(c.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> ลบ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== GRID VIEW (original card layout) ==================== */
function CustomerGridView({ data, onRowClick, onEdit, onDelete }: { data: any[]; onRowClick: (id: number) => void; onEdit: (id: number) => void; onDelete: (id: number) => void }) {
  const [, setLocation] = useLocation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((customer: any) => (
        <Card
          key={customer.id}
          className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onRowClick(customer.id)}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{customer.name}</p>
                  {customer.source && (
                    <Badge variant="secondary" className="text-[10px] mt-1 font-normal">
                      {customer.source || "-"}
                    </Badge>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRowClick(customer.id); }}>
                    <Eye className="h-4 w-4 mr-2" /> ดูรายละเอียด
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(customer.id); }}>
                    <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(customer.id); }}>
                    <Trash2 className="h-4 w-4 mr-2" /> ลบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {customer.phone && (
                <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{customer.phone}</div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2"><Mail className="h-3 w-3" /><span className="truncate">{customer.email}</span></div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{customer.address}</span></div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ==================== ADD CUSTOMER DIALOG ==================== */
function AddCustomerDialog({ open, onOpenChange, onSubmit, loading }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", district: "", province: "", source: "other" as string, notes: "", electricityBill: "", roofType: "", phaseType: "" as string });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("กรุณาระบุชื่อลูกค้า"); return; }
    onSubmit({
      ...form,
      electricityBill: form.electricityBill || undefined,
      phaseType: form.phaseType || undefined,
      source: form.source as any,
    });
    setForm({ name: "", phone: "", email: "", address: "", district: "", province: "", source: "other", notes: "", electricityBill: "", roofType: "", phaseType: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
          <DialogDescription>กรอกข้อมูลลูกค้าเพื่อเพิ่มเข้าสู่ระบบ</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>ชื่อลูกค้า *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ชื่อ-นามสกุล" />
            </div>
            <div>
              <Label>เบอร์โทร</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0xx-xxx-xxxx" />
            </div>
            <div>
              <Label>อีเมล</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div className="col-span-2">
              <Label>ที่อยู่</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ที่อยู่ลูกค้า" rows={2} />
            </div>
            <div>
              <Label>เขต/อำเภอ</Label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="เขต/อำเภอ" />
            </div>
            <div>
              <Label>จังหวัด</Label>
              <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="จังหวัด" />
            </div>
            <div>
              <Label>แหล่งที่มา</Label>
              <SourceCombobox value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
            </div>
            <div>
              <Label>ค่าไฟ/เดือน (บาท)</Label>
              <Input value={form.electricityBill} onChange={(e) => setForm({ ...form, electricityBill: e.target.value })} placeholder="เช่น 3000" type="number" />
            </div>
            <div>
              <Label>ประเภทหลังคา</Label>
              <Input value={form.roofType} onChange={(e) => setForm({ ...form, roofType: e.target.value })} placeholder="เช่น เมทัลชีท" />
            </div>
            <div>
              <Label>ระบบไฟฟ้า</Label>
              <Select value={form.phaseType} onValueChange={(v) => setForm({ ...form, phaseType: v })}>
                <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">1 เฟส</SelectItem>
                  <SelectItem value="three">3 เฟส</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="หมายเหตุเพิ่มเติม" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


/* ==================== IMPORT EXCEL DIALOG ==================== */
const COLUMN_MAP: Record<string, string> = {
  "ชื่อลูกค้า": "name", "ชื่อ": "name", "name": "name", "ชื่อ-นามสกุล": "name",
  "เบอร์โทร": "phone", "โทร": "phone", "phone": "phone", "เบอร์": "phone", "เบอร์โทรศัพท์": "phone",
  "อีเมล": "email", "email": "email", "e-mail": "email",
  "ที่อยู่": "address", "address": "address",
  "จังหวัด": "province", "province": "province",
  "เขต": "district", "อำเภอ": "district", "เขต/อำเภอ": "district", "district": "district",
  "แหล่งที่มา": "source", "ช่องทาง": "source", "source": "source",
  "ค่าไฟ": "electricityBill", "ค่าไฟ/เดือน": "electricityBill", "electricity": "electricityBill", "bill": "electricityBill",
  "ประเภทหลังคา": "roofType", "หลังคา": "roofType", "roof": "roofType",
  "ระบบไฟฟ้า": "phaseType", "เฟส": "phaseType", "phase": "phaseType",
  "ขนาดมิเตอร์": "meterSize", "มิเตอร์": "meterSize", "meter": "meterSize",
  "หมายเหตุ": "notes", "notes": "notes", "note": "notes",
};

function normalizePhaseType(val: string): "single" | "three" | undefined {
  if (!val) return undefined;
  const v = val.toLowerCase().trim();
  if (v.includes("3") || v.includes("three") || v.includes("สาม")) return "three";
  if (v.includes("1") || v.includes("single") || v.includes("เดียว")) return "single";
  return undefined;
}

function ImportExcelDialog({ open, onOpenChange, onImport, loading }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (customers: any[]) => void;
  loading: boolean;
}) {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setParsedData([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

        if (jsonData.length === 0) {
          setError("ไฟล์ไม่มีข้อมูล");
          return;
        }

        // Map columns
        const headers = Object.keys(jsonData[0]);
        const mapping: Record<string, string> = {};
        headers.forEach(h => {
          const normalized = h.trim().toLowerCase();
          for (const [key, val] of Object.entries(COLUMN_MAP)) {
            if (key.toLowerCase() === normalized) {
              mapping[h] = val;
              break;
            }
          }
        });

        const customers = jsonData
          .map(row => {
            const mapped: Record<string, any> = {};
            for (const [origCol, fieldName] of Object.entries(mapping)) {
              const val = String(row[origCol] ?? "").trim();
              if (val) {
                if (fieldName === "phaseType") {
                  mapped[fieldName] = normalizePhaseType(val);
                } else {
                  mapped[fieldName] = val;
                }
              }
            }
            return mapped;
          })
          .filter(c => c.name);

        if (customers.length === 0) {
          setError("ไม่พบคอลัมน์ \"ชื่อลูกค้า\" หรือ \"name\" ในไฟล์ กรุณาตรวจสอบหัวคอลัมน์");
          return;
        }

        setParsedData(customers);
      } catch {
        setError("ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel (.xlsx, .xls)");
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["ชื่อลูกค้า", "เบอร์โทร", "อีเมล", "ที่อยู่", "เขต/อำเภอ", "จังหวัด", "แหล่งที่มา", "ค่าไฟ/เดือน", "ประเภทหลังคา", "ระบบไฟฟ้า", "ขนาดมิเตอร์", "หมายเหตุ"],
      ["สมชาย ใจดี", "0812345678", "somchai@email.com", "123 ถ.สุขุมวิท", "บางนา", "กรุงเทพ", "website", "3500", "เมทัลชีท", "3 เฟส", "30/100", "สนใจติดตั้ง 10kW"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ลูกค้า");
    XLSX.writeFile(wb, "template_import_customers.xlsx");
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            นำเข้าข้อมูลลูกค้าจาก Excel
          </DialogTitle>
          <DialogDescription>
            อัพโหลดไฟล์ Excel (.xlsx, .xls) ที่มีข้อมูลลูกค้า ระบบจะจับคู่คอลัมน์อัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Download className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">ดาวน์โหลดไฟล์ตัวอย่าง</p>
              <p className="text-xs text-blue-700">ใช้เป็นแม่แบบสำหรับเตรียมข้อมูล</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
              <Download className="h-4 w-4 mr-1" /> ดาวน์โหลด
            </Button>
          </div>

          {/* File Upload */}
          <div>
            <Label>เลือกไฟล์ Excel</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="mt-1"
            />
            {fileName && <p className="text-xs text-muted-foreground mt-1">ไฟล์: {fileName}</p>}
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">ตัวอย่างข้อมูล ({parsedData.length} รายการ)</p>
                <Badge variant="secondary">{parsedData.length} รายการ</Badge>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-2 py-1.5 font-medium">#</th>
                        <th className="text-left px-2 py-1.5 font-medium">ชื่อ</th>
                        <th className="text-left px-2 py-1.5 font-medium">เบอร์โทร</th>
                        <th className="text-left px-2 py-1.5 font-medium">อีเมล</th>
                        <th className="text-left px-2 py-1.5 font-medium">จังหวัด</th>
                        <th className="text-left px-2 py-1.5 font-medium">แหล่งที่มา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-1.5 font-medium">{row.name}</td>
                          <td className="px-2 py-1.5">{row.phone || "-"}</td>
                          <td className="px-2 py-1.5">{row.email || "-"}</td>
                          <td className="px-2 py-1.5">{row.province || "-"}</td>
                          <td className="px-2 py-1.5">{row.source || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 10 && (
                  <div className="text-center py-1.5 text-xs text-muted-foreground bg-muted/30 border-t">
                    ...และอีก {parsedData.length - 10} รายการ
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>ยกเลิก</Button>
          <Button
            onClick={() => onImport(parsedData)}
            disabled={parsedData.length === 0 || loading}
            className="gap-2"
          >
            {loading ? "กำลังนำเข้า..." : `นำเข้า ${parsedData.length} รายการ`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
