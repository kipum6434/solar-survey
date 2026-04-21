import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SURVEY_STATUS_MAP, PHOTO_CATEGORY_MAP } from "@/lib/constants";
import { useParams } from "wouter";
import { useState } from "react";
import {
  Camera, MapPin, Calendar, Phone, Mail, Zap, Home, Gauge,
  X, Image, Sun, Wrench,
} from "lucide-react";

export default function SharedSurvey() {
  const params = useParams<{ token: string }>();
  const { data, isLoading, error } = trpc.shareLink.getByToken.useQuery({ token: params.token || "" });
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Sun className="h-12 w-12 mx-auto mb-3 text-amber-400 animate-spin" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error || !data || 'error' in data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <X className="h-12 w-12 mx-auto mb-3 text-destructive/50" />
            <h2 className="text-lg font-semibold mb-2">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h2>
            <p className="text-sm text-muted-foreground">กรุณาติดต่อทีมงานเพื่อขอลิงก์ใหม่</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = 'survey' in data ? data.survey : null;
  const c = 'customer' in data ? data.customer : null;
  const photosData = 'photos' in data ? data.photos : [];
  if (!s || !c) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <X className="h-12 w-12 mx-auto mb-3 text-destructive/50" />
            <h2 className="text-lg font-semibold mb-2">ไม่พบข้อมูล</h2>
          </CardContent>
        </Card>
      </div>
    );
  }
  const statusInfo = SURVEY_STATUS_MAP[s.status] || SURVEY_STATUS_MAP.pending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sun className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">ข้อมูลสำรวจ - {c.name}</h1>
              <p className="text-xs text-muted-foreground">Solar Survey Report</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status & Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">ข้อมูลลูกค้า</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={`${statusInfo.bg} ${statusInfo.color} text-xs border-0`}>{statusInfo.label}</Badge>
                {s.scheduledDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(s.scheduledDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              {s.installationDate && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs border-0">
                    <Wrench className="h-3 w-3 mr-1" />
                    นัดติดตั้ง: {new Date(s.installationDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                  </Badge>
                </div>
              )}
              {c.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{c.phone}</div>}
              {c.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{c.email}</div>}
              {c.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{[c.address, c.subDistrict, c.district, c.province, c.postalCode].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {c.latitude && c.longitude && (
                <a href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                  <MapPin className="h-4 w-4" /> ดูบน Google Maps
                </a>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">ข้อมูลทางเทคนิค</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {c.electricityBill && <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />ค่าไฟ: {Number(c.electricityBill).toLocaleString()} บาท/เดือน</div>}
              {c.roofType && <div className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" />หลังคา: {c.roofType}</div>}
              {c.phaseType && <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-muted-foreground" />ระบบไฟ: {c.phaseType === "single" ? "1 เฟส" : "3 เฟส"}</div>}
              {s.systemSize && <div className="flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" />ขนาดระบบ: {s.systemSize} kW</div>}
              {s.panelCount && <div className="flex items-center gap-2">จำนวนแผง: {s.panelCount} แผง</div>}
              {s.inverterModel && <div className="flex items-center gap-2">อินเวอร์เตอร์: {s.inverterModel}</div>}
            </CardContent>
          </Card>
        </div>

        {/* Photos */}
        {photosData && photosData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4" /> รูปภาพหน้างาน ({photosData.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {photosData.map((photo: any) => (
                  <div key={photo.id} className="relative rounded-lg overflow-hidden bg-muted aspect-square cursor-pointer group" onClick={() => setLightboxImg(photo.url)}>
                    <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <Badge variant="secondary" className="text-[9px] bg-white/80 text-foreground">
                        {PHOTO_CATEGORY_MAP[photo.category] || photo.category}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents section hidden from public share link - only visible to logged-in users in SurveyDetail */}

        {/* Survey Notes */}
        {s.surveyNotes && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">หมายเหตุ</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.surveyNotes}</p></CardContent>
          </Card>
        )}

        <div className="text-center py-6 text-xs text-muted-foreground">
          Solar Survey Management System
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2" onClick={() => setLightboxImg(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightboxImg} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
