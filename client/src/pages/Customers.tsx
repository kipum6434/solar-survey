import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { SOURCE_MAP } from "@/lib/constants";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Users, Plus, Search, Phone, Mail, MapPin, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, Eye,
} from "lucide-react";
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

export default function Customers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.customer.list.useQuery({ search, page, limit: 15 });
  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => { toast.success("เพิ่มลูกค้าสำเร็จ"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => { toast.success("ลบลูกค้าสำเร็จ"); setDeleteId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / 15);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ลูกค้า</h1>
            <p className="text-sm text-muted-foreground mt-1">จัดการข้อมูลลูกค้าทั้งหมด</p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" /> เพิ่มลูกค้า
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : data?.data && data.data.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.data.map((customer: any) => (
                <Card
                  key={customer.id}
                  className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setLocation(`/customers/${customer.id}`)}
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
                              {SOURCE_MAP[customer.source] || customer.source}
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
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/customers/${customer.id}`); }}>
                            <Eye className="h-4 w-4 mr-2" /> ดูรายละเอียด
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/customers/${customer.id}?edit=true`); }}>
                            <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(customer.id); }}>
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
            <p className="text-muted-foreground">{search ? "ไม่พบลูกค้าที่ค้นหา" : "ยังไม่มีข้อมูลลูกค้า"}</p>
            {!search && (
              <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> เพิ่มลูกค้าคนแรก
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Customer Dialog */}
      <AddCustomerDialog open={showAdd} onOpenChange={setShowAdd} onSubmit={(d) => createMutation.mutate(d)} loading={createMutation.isPending} />

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

function AddCustomerDialog({ open, onOpenChange, onSubmit, loading }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", province: "", source: "other" as string, notes: "", electricityBill: "", roofType: "", phaseType: "" as string });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("กรุณาระบุชื่อลูกค้า"); return; }
    onSubmit({
      ...form,
      electricityBill: form.electricityBill || undefined,
      phaseType: form.phaseType || undefined,
      source: form.source as any,
    });
    setForm({ name: "", phone: "", email: "", address: "", province: "", source: "other", notes: "", electricityBill: "", roofType: "", phaseType: "" });
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
              <Label>จังหวัด</Label>
              <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="จังหวัด" />
            </div>
            <div>
              <Label>แหล่งที่มา</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
