import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { HardDrive, Image, FileText, AlertTriangle, Cloud } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function StorageSettings() {
  const [, setLocation] = useLocation();
  const { data: storageStats, isLoading: statsLoading } = trpc.storage.stats.useQuery();
  const { data: s3Usage, isLoading: s3Loading } = trpc.storage.s3Usage.useQuery(undefined, {
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-sm">
            <HardDrive className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">พื้นที่จัดเก็บ</h1>
            <p className="text-sm text-muted-foreground">ข้อมูลรูปภาพและเอกสารที่อัพโหลดในระบบ</p>
          </div>
        </div>

        {/* File counts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              {statsLoading ? (
                <Skeleton className="h-10 w-20 mx-auto mb-2" />
              ) : (
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Image className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold text-foreground">{storageStats?.totalPhotos ?? 0}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">รูปภาพ</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              {statsLoading ? (
                <Skeleton className="h-10 w-20 mx-auto mb-2" />
              ) : (
                <div className="flex items-center justify-center gap-2 mb-1">
                  <FileText className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold text-foreground">{storageStats?.totalDocuments ?? 0}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">เอกสาร</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              {s3Loading ? (
                <Skeleton className="h-10 w-20 mx-auto mb-2" />
              ) : (
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Cloud className="h-5 w-5 text-sky-500" />
                  <span className="text-2xl font-bold text-foreground">{s3Usage?.totalObjects ?? 0}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">ไฟล์บน S3</p>
            </CardContent>
          </Card>
        </div>

        {/* AWS S3 Usage Section */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-semibold text-foreground">AWS S3 Storage</span>
              </div>
              {s3Usage && (
                <span className="text-xs text-muted-foreground">{s3Usage.bucketName}</span>
              )}
            </div>

            {s3Loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            ) : s3Usage ? (
              <>
                {/* Progress bar */}
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      s3Usage.usagePercent > 90 ? 'bg-red-500' :
                      s3Usage.usagePercent > 70 ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(s3Usage.usagePercent, 100)}%` }}
                  />
                </div>

                {/* Usage text */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">
                    ใช้ไป{" "}
                    <span className="font-semibold text-foreground">
                      {s3Usage.totalSize > 1073741824
                        ? `${(s3Usage.totalSize / 1073741824).toFixed(2)} GB`
                        : s3Usage.totalSize > 1048576
                        ? `${(s3Usage.totalSize / 1048576).toFixed(1)} MB`
                        : s3Usage.totalSize > 1024
                        ? `${(s3Usage.totalSize / 1024).toFixed(0)} KB`
                        : `${s3Usage.totalSize} B`}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Free Tier: <span className="font-semibold text-foreground">5 GB</span>
                  </span>
                </div>
                <div className="text-right mt-1">
                  <span className={`text-xs font-medium ${
                    s3Usage.usagePercent > 90 ? 'text-red-500' :
                    s3Usage.usagePercent > 70 ? 'text-amber-500' :
                    'text-emerald-500'
                  }`}>
                    {s3Usage.usagePercent}% ของ Free Tier
                  </span>
                </div>

                {/* Warning when approaching limit */}
                {s3Usage.usagePercent > 80 && (
                  <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
                    s3Usage.usagePercent > 90
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {s3Usage.usagePercent > 90
                        ? 'ใกล้เต็ม Free Tier แล้ว! หลังจากนี้จะเริ่มมีค่าใช้จ่าย (~$0.023/GB/เดือน)'
                        : 'ใกล้ถึง Free Tier Limit แล้ว ควรพิจารณาลบไฟล์ที่ไม่ใช้แล้ว'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">ไม่สามารถโหลดข้อมูล S3 ได้</p>
            )}
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              พื้นที่จัดเก็บใช้สำหรับเก็บรูปภาพหน้างานและเอกสารที่อัพโหลดในระบบ
              หากต้องการลบไฟล์เพื่อคืนพื้นที่ สามารถไปที่หน้า <strong>จัดการไฟล์</strong> เพื่อดูและลบไฟล์ที่ไม่ต้องการได้
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setLocation("/file-management")}
            >
              ไปหน้าจัดการไฟล์
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
