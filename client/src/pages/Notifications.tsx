import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Bell, CheckCheck, ClipboardList, PhoneCall, AlertCircle, Clock } from "lucide-react";

const NOTIF_ICONS: Record<string, any> = {
  new_assignment: ClipboardList,
  status_changed: AlertCircle,
  follow_up_due: PhoneCall,
  follow_up_reminder: Clock,
};

export default function Notifications() {
  const [, setLocation] = useLocation();
  const { data: notifications, isLoading, refetch } = trpc.notification.list.useQuery({});
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllRead = trpc.notification.markAllRead.useMutation({ onSuccess: () => refetch() });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">การแจ้งเตือน</h1>
            <p className="text-sm text-muted-foreground mt-1">การแจ้งเตือนทั้งหมดของคุณ</p>
          </div>
          {notifications && notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" /> อ่านทั้งหมด
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm animate-pulse"><CardContent className="p-4 h-16" /></Card>
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map((n: any) => {
              const Icon = NOTIF_ICONS[n.type] || Bell;
              return (
                <Card
                  key={n.id}
                  className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${!n.isRead ? "bg-primary/5 ring-1 ring-primary/10" : ""}`}
                  onClick={() => {
                    if (!n.isRead) markRead.mutate({ id: n.id });
                    if (n.relatedSurveyId) setLocation(`/surveys/${n.relatedSurveyId}`);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${!n.isRead ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`h-4 w-4 ${!n.isRead ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.isRead ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">ไม่มีการแจ้งเตือน</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
