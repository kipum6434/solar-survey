import { useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Pagination } from "@/components/Pagination";
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
  Search, Image, Camera, Grid3X3, List, Download, ExternalLink,
  X, ChevronLeft, ChevronRight, MapPin, Calendar, Users2,
  Package, CheckCircle2, Clock, Send, XCircle, FolderOpen,
  ImageIcon,
} from "lucide-react";
import { useLocation } from "wouter";
// JSZip no longer needed - ZIP generation moved to server-side

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "รอส่งมอบ", color: "text-amber-700", bg: "bg-amber-50", icon: Clock },
  submitted: { label: "ส่งมอบแล้ว", color: "text-blue-700", bg: "bg-blue-50", icon: Send },
  approved: { label: "อนุมัติแล้ว", color: "text-green-700", bg: "bg-green-50", icon: CheckCircle2 },
  rejected: { label: "ถูกปฏิเสธ", color: "text-red-700", bg: "bg-red-50", icon: XCircle },
};

type ViewMode = "albums" | "feed";

export default function Gallery() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("albums");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Month/Year filter - like Surveys page
  const now = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterByMonth, setFilterByMonth] = useState(false);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
      years.push(y);
    }
    return years;
  }, [now]);

  const handleMonthNav = useCallback((dir: -1 | 1) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
    setFilterByMonth(true);
    setAlbumPage(1);
    setFeedPage(1);
  }, [selectedMonth, selectedYear]);
  const [albumPage, setAlbumPage] = useState(1);
  const [feedPage, setFeedPage] = useState(1);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; caption?: string | null }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [downloadingSurveyId, setDownloadingSurveyId] = useState<number | null>(null);
  // utils removed - gallery download now uses server-side endpoint

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<any>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setAlbumPage(1);
      setFeedPage(1);
    }, 400);
    setSearchTimeout(timeout);
  }, [searchTimeout]);

  // Data queries
  const { data: teamsData } = trpc.installerTeam.list.useQuery();
  const { data: photoCategories } = trpc.installationPhotoCategory.list.useQuery();

  const albumsQuery = trpc.gallery.albums.useQuery({
    search: debouncedSearch || undefined,
    teamId: teamFilter !== "all" ? parseInt(teamFilter) : undefined,
    deliveryStatus: statusFilter !== "all" ? statusFilter : undefined,
    month: filterByMonth ? selectedMonth : undefined,
    year: filterByMonth ? selectedYear : undefined,
    page: albumPage,
    limit: 20,
  }, { enabled: viewMode === "albums" });

  const feedQuery = trpc.gallery.allPhotos.useQuery({
    search: debouncedSearch || undefined,
    teamId: teamFilter !== "all" ? parseInt(teamFilter) : undefined,
    deliveryStatus: statusFilter !== "all" ? statusFilter : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    month: filterByMonth ? selectedMonth : undefined,
    year: filterByMonth ? selectedYear : undefined,
    page: feedPage,
    limit: 40,
  }, { enabled: viewMode === "feed" });

  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (photoCategories) {
      for (const cat of photoCategories) {
        map[cat.key] = cat.label;
      }
    }
    return map;
  }, [photoCategories]);

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  };

  // ZIP download via server-side endpoint (avoids browser CORS/timeout issues)
  const handleDownloadZip = async (surveyId: number, customerName: string) => {
    setDownloadingSurveyId(surveyId);
    const toastId = toast.info("กำลังเตรียมไฟล์ ZIP... (อาจใช้เวลา 1-3 นาที)", { duration: Infinity });
    try {
      const response = await fetch(`/api/gallery/download-zip/${surveyId}`);
      toast.dismiss(toastId as any);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("ไม่มีรูปในอัลบั้มนี้");
        } else {
          toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด");
        }
        return;
      }

      const successCount = parseInt(response.headers.get("X-Photos-Success") || "0");
      const totalCount = parseInt(response.headers.get("X-Photos-Total") || "0");
      const failedCount = parseInt(response.headers.get("X-Photos-Failed") || "0");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${customerName}_installation_photos.zip`;
      a.click();
      URL.revokeObjectURL(url);

      if (failedCount > 0) {
        toast.warning(`ดาวน์โหลด ${successCount}/${totalCount} รูปสำเร็จ (${failedCount} รูปโหลดไม่ได้)`, { duration: 8000 });
      } else {
        toast.success(`ดาวน์โหลด ${successCount}/${totalCount} รูปสำเร็จ`);
      }
    } catch (e) {
      toast.dismiss(toastId as any);
      console.error("Download error:", e);
      toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด");
    } finally {
      setDownloadingSurveyId(null);
    }
  };

  // Lightbox navigation
  const openLightbox = (url: string, photos?: { url: string; caption?: string | null }[], index?: number) => {
    if (photos && index !== undefined) {
      setLightboxPhotos(photos);
      setLightboxIndex(index);
    } else {
      setLightboxPhotos([{ url }]);
      setLightboxIndex(0);
    }
    setLightboxImg(url);
  };

  const navigateLightbox = (direction: number) => {
    const newIndex = lightboxIndex + direction;
    if (newIndex >= 0 && newIndex < lightboxPhotos.length) {
      setLightboxIndex(newIndex);
      setLightboxImg(lightboxPhotos[newIndex].url);
    }
  };

  const albumTotalPages = Math.ceil((albumsQuery.data?.total || 0) / 20);
  const feedTotalPages = Math.ceil((feedQuery.data?.total || 0) / 40);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" /> แกลลอรี่รูปติดตั้ง
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              รวมรูปถ่ายการติดตั้งจากทุกไซต์งาน
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "albums" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode("albums")}
            >
              <Grid3X3 className="h-3.5 w-3.5" /> อัลบั้ม
            </Button>
            <Button
              variant={viewMode === "feed" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode("feed")}
            >
              <List className="h-3.5 w-3.5" /> ทั้งหมด
            </Button>
          </div>
        </div>

        {/* Month Navigation Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            variant={!filterByMonth ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilterByMonth(false); setAlbumPage(1); setFeedPage(1); }}
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
              onClick={() => { setSelectedMonth(i + 1); setFilterByMonth(true); setAlbumPage(1); setFeedPage(1); }}
              className="shrink-0 text-xs px-2.5"
            >
              {m}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleMonthNav(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); if (filterByMonth) { setAlbumPage(1); setFeedPage(1); } }}>
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

        {filterByMonth && (
          <p className="text-sm text-muted-foreground">
            แสดงงานติดตั้งเดือน <span className="font-semibold text-foreground">{THAI_MONTHS[selectedMonth - 1]} {selectedYear + 543}</span>
          </p>
        )}

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setAlbumPage(1); setFeedPage(1); }}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="ทีมช่าง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกทีมช่าง</SelectItem>
                  {teamsData?.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setAlbumPage(1); setFeedPage(1); }}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="สถานะส่งมอบ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="pending">รอส่งมอบ</SelectItem>
                  <SelectItem value="submitted">ส่งมอบแล้ว</SelectItem>
                  <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                  <SelectItem value="rejected">ถูกปฏิเสธ</SelectItem>
                </SelectContent>
              </Select>

              {viewMode === "feed" && (
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setFeedPage(1); }}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="หมวดหมู่รูป" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                    {photoCategories?.map((cat: any) => (
                      <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Album View */}
        {viewMode === "albums" && (
          <>
            {albumsQuery.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden border-0 shadow-sm">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : albumsQuery.data?.albums.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">ไม่พบอัลบั้มรูปติดตั้ง</p>
                  <p className="text-xs mt-1">ยังไม่มีรูปถ่ายการติดตั้งในระบบ หรือไม่ตรงกับตัวกรองที่เลือก</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  พบ {albumsQuery.data?.total} อัลบั้ม
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {albumsQuery.data?.albums.map((album: any) => {
                    const status = DELIVERY_STATUS_MAP[album.deliveryStatus] || DELIVERY_STATUS_MAP.pending;
                    return (
                      <Card key={album.surveyId} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
                        {/* Cover image */}
                        <div
                          className="relative h-48 bg-muted overflow-hidden"
                          onClick={() => setLocation(`/surveys/${album.surveyId}`)}
                        >
                          {album.coverUrl ? (
                            <img
                              src={album.coverUrl}
                              alt={album.customerName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                          {/* Photo count badge */}
                          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <Image className="h-3 w-3" /> {album.photoCount}
                          </div>
                          {/* Delivery status badge */}
                          <div className="absolute bottom-2 left-2">
                            <Badge className={`${status.bg} ${status.color} border-0 text-[10px] gap-1`}>
                              <status.icon className="h-2.5 w-2.5" />
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                        {/* Info */}
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-semibold truncate">{album.customerName}</h3>
                              {album.province && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3 shrink-0" /> {album.province}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={(e) => { e.stopPropagation(); handleDownloadZip(album.surveyId, album.customerName); }}
                              disabled={downloadingSurveyId === album.surveyId || album.photoCount === 0}
                              title="ดาวน์โหลด ZIP"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {album.installationDate && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" /> {formatDate(album.installationDate)}
                              </span>
                            )}
                            {album.teamName && (
                              <Badge variant="outline" className="text-[10px] gap-1 py-0" style={album.teamColor ? { borderColor: album.teamColor, color: album.teamColor } : {}}>
                                <Users2 className="h-2.5 w-2.5" /> {album.teamName}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {/* Pagination */}
                <Pagination page={albumPage} totalPages={albumTotalPages} onPageChange={setAlbumPage} />
              </>
            )}
          </>
        )}

        {/* Feed View */}
        {viewMode === "feed" && (
          <>
            {feedQuery.isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : feedQuery.data?.photos.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">ไม่พบรูปถ่าย</p>
                  <p className="text-xs mt-1">ยังไม่มีรูปถ่ายที่ตรงกับตัวกรองที่เลือก</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  พบ {feedQuery.data?.total} รูป
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {feedQuery.data?.photos.map((photo: any, idx: number) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => openLightbox(
                        photo.url,
                        feedQuery.data?.photos.map((p: any) => ({ url: p.url, caption: `${p.customerName} - ${categoryLabelMap[p.category] || p.category}` })),
                        idx
                      )}
                    >
                      <img
                        src={photo.url}
                        alt={photo.fileName || "installation photo"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-[10px] font-medium truncate">{photo.customerName}</p>
                          <p className="text-white/70 text-[9px] truncate">{categoryLabelMap[photo.category] || photo.category}</p>
                        </div>
                      </div>
                      {/* Category badge */}
                      <div className="absolute top-1.5 left-1.5">
                        <Badge className="text-[8px] bg-black/50 text-white border-0 py-0 px-1.5">
                          {categoryLabelMap[photo.category] || photo.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Pagination */}
                <Pagination page={feedPage} totalPages={feedTotalPages} onPageChange={setFeedPage} totalItems={feedQuery.data?.total} itemLabel="รูป" />
              </>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxImg(null)}>
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={() => setLightboxImg(null)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation */}
          {lightboxPhotos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                disabled={lightboxIndex <= 0}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
                onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                disabled={lightboxIndex >= lightboxPhotos.length - 1}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Image */}
          <img
            src={lightboxImg}
            alt="preview"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption & counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
            {lightboxPhotos[lightboxIndex]?.caption && (
              <p className="text-white text-sm mb-1">{lightboxPhotos[lightboxIndex].caption}</p>
            )}
            {lightboxPhotos.length > 1 && (
              <p className="text-white/60 text-xs">{lightboxIndex + 1} / {lightboxPhotos.length}</p>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
