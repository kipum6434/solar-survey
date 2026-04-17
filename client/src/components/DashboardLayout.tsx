import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarDays,
  Bell,
  LogOut,
  PanelLeft,
  Sun,
  ChevronRight,
  UserCog,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function getRoleLabel(role: string) {
  switch (role) {
    case "superadmin": return "Superadmin";
    case "admin": return "ผู้ดูแลระบบ";
    default: return "ทีมสำรวจ";
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const loginMutation = trpc.auth.login.useMutation();
  const utils = trpc.useUtils();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync({ username: username.trim(), password });
      toast.success("เข้าสู่ระบบสำเร็จ");
      await utils.auth.me.invalidate();
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#2d4a6f] to-[#1e3a5f]">
      <div className="flex flex-col items-center gap-6 p-8 md:p-10 max-w-md w-full mx-4 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Sun className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1e3a5f] text-center">
            Solar Survey System
          </h1>
          <p className="text-sm text-stone-500 text-center max-w-sm leading-relaxed">
            ระบบจัดการงานสำรวจติดตั้งโซล่าเซลล์
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium text-stone-700">ชื่อผู้ใช้</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้"
              className="h-11 bg-white border-stone-200 focus:border-amber-400 focus:ring-amber-400/20"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-stone-700">รหัสผ่าน</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="h-11 bg-white border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            size="lg"
            className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white shadow-lg hover:shadow-xl transition-all h-12 text-base font-medium"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> กำลังเข้าสู่ระบบ...</>
            ) : (
              "เข้าสู่ระบบ"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isAdminOrSuper = user?.role === "admin" || user?.role === "superadmin";

  const menuItems = [
    { icon: LayoutDashboard, label: "แดชบอร์ด", path: "/" },
    { icon: Users, label: "ลูกค้า", path: "/customers" },
    { icon: ClipboardList, label: "งานสำรวจ", path: "/surveys" },
    { icon: CalendarDays, label: "ปฏิทิน", path: "/calendar" },
    { icon: Bell, label: "แจ้งเตือน", path: "/notifications" },
    ...(isAdminOrSuper ? [{ icon: UserCog, label: "จัดการผู้ใช้", path: "/users" }] : []),
  ];

  const activeMenuItem = menuItems.find((item) => item.path === location);

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center bg-sidebar">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
                    <Sun className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm tracking-tight text-sidebar-foreground truncate block">
                      Solar Survey
                    </span>
                    <span className="text-[10px] text-sidebar-foreground/50 truncate block">
                      ระบบจัดการงานสำรวจ
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 bg-sidebar px-2 pt-2">
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive =
                  item.path === "/"
                    ? location === "/"
                    : location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal rounded-lg ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.path === "/notifications" &&
                        unreadCount !== undefined &&
                        unreadCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full"
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      {isActive && !isCollapsed && (
                        <ChevronRight className="h-3 w-3 opacity-50" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 bg-sidebar">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-8 w-8 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "User"}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/50 truncate mt-1">
                      {getRoleLabel(user?.role || "user")}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{getRoleLabel(user?.role || "user")}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-amber-400/30 transition-colors ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-medium text-foreground">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 bg-background min-h-screen">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
