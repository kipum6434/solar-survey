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
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  Users,
  Users2,
  Shield,
  ClipboardList,
  CalendarDays,
  Bell,
  LogOut,
  PanelLeft,
  Sun,
  ChevronRight,
  TrendingUp,
  Tags,
  Wrench,
  FolderOpen,
  HardHat,
  BarChart3,
  ImageIcon,
  MessageSquare,
  PhoneCall,
  Building2,
  FileCheck,
  FileText,
  Zap,
  ChevronDown,
  Settings,
  Banknote,
  CheckSquare,
  Globe,
  Target,
  SlidersHorizontal,
  Package,
  XCircle,
  Stamp,
  HardDrive,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { Badge } from "./ui/badge";

// Top-level items (always visible)
const topMenuItems = [
  { icon: LayoutDashboard, label: "แดชบอร์ด", path: "/" },
];

// Color themes for source groups (cycles if more than 3 groups)
const GROUP_THEMES = [
  { icon: Sun, color: "amber", activeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400", headerClass: "text-amber-600", iconClass: "text-amber-500" },
  { icon: Zap, color: "blue", activeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400", headerClass: "text-blue-600", iconClass: "text-blue-500" },
  { icon: Zap, color: "green", activeClass: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400", headerClass: "text-green-600", iconClass: "text-green-500" },
  { icon: Zap, color: "purple", activeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400", headerClass: "text-purple-600", iconClass: "text-purple-500" },
  { icon: Zap, color: "rose", activeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400", headerClass: "text-rose-600", iconClass: "text-rose-500" },
];

// Sub-menu items for each source group (generated dynamically)
function getGroupMenuItems(slug: string) {
  return [
    { icon: BarChart3, label: "Dashboard", path: `/${slug}/dashboard` },
    { icon: Users, label: "ลูกค้า", path: `/${slug}/customers` },
    { icon: ClipboardList, label: "งานสำรวจ", path: `/${slug}/surveys` },
    { icon: PhoneCall, label: "งานติดตาม", path: `/${slug}/follow-ups` },
    { icon: Wrench, label: "งานติดตั้ง", path: `/${slug}/installations` },
    { icon: Banknote, label: "การเงิน", path: `/finance/${slug}` },
    { icon: XCircle, label: "เคสที่ยกเลิก", path: `/${slug}/cancelled-cases` },
  ];
}

// Common items (shared across all sources)
const commonMenuItems = [
  { icon: FileCheck, label: "รออนุมัติ", path: "/approvals" },
  { icon: TrendingUp, label: "ผลงานทีม", path: "/team-performance" },
  { icon: Target, label: "ประสิทธิภาพเซลล์", path: "/sales-performance" },
  { icon: Users2, label: "จัดการทีมงาน", path: "/team" },
  { icon: Shield, label: "จัดการผู้ใช้งาน", path: "/users", superadminOnly: true },
  { icon: HardHat, label: "ทีมช่างติดตั้ง", path: "/installer-teams" },
  { icon: BarChart3, label: "สรุปผลงานช่าง", path: "/installer-team-report" },
  { icon: ImageIcon, label: "แกลลอรี่รูปติดตั้ง", path: "/gallery" },
  { icon: CheckSquare, label: "Checklist ส่งมอบ", path: "/checklist-templates" },
  { icon: Tags, label: "จัดการสถานะ", path: "/status-management" },
  { icon: FolderOpen, label: "จัดการไฟล์", path: "/file-management" },
  { icon: CalendarDays, label: "ปฏิทิน", path: "/calendar" },
  { icon: Wrench, label: "ปฏิทินติดตั้ง", path: "/installation-calendar" },
  { icon: Package, label: "เตรียมสินค้า", path: "/installation-prep", warehouseVisible: true },
];

const settingsMenuItems = [
  { icon: FileText, label: "Template ฟอร์ม", path: "/survey-templates" },
  { icon: MessageSquare, label: "ตั้งค่า LINE", path: "/line-settings", superadminOnly: true },
  { icon: Building2, label: "ตั้งค่าบริษัท", path: "/company-settings" },
  { icon: Globe, label: "จัดการแหล่งที่มา", path: "/source-management" },
  { icon: SlidersHorizontal, label: "ฟิลด์ข้อมูลเทคนิค", path: "/technical-field-settings" },
  { icon: Stamp, label: "เลขทะเบียนเอกสาร", path: "/document-settings" },
  { icon: HardDrive, label: "พื้นที่จัดเก็บ", path: "/storage-settings" },
  { icon: Bell, label: "แจ้งเตือน", path: "/notifications" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// Fallback groups when DB hasn't loaded yet
const FALLBACK_GROUPS = ["TCS", "Gulf", "MEA"];

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
    return <Redirect to="/login" />;
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
  const isWarehouse = user?.role === "warehouse";
  const filterByRole = (items: typeof commonMenuItems) => items.filter((item) => {
    if ((item as any).superadminOnly && user?.role !== "superadmin") return false;
    // Warehouse role only sees specific pages
    if (isWarehouse && (item as any).warehouseVisible !== true) return false;
    return true;
  });
  const topItems = isWarehouse ? [] : topMenuItems;
  const commonItems = filterByRole(commonMenuItems);
  const settingsItems = isWarehouse ? [] : filterByRole(settingsMenuItems);
  const settingsPaths = settingsItems.map(i => i.path);

  // Fetch source groups dynamically from DB
  const { data: sourceGroups } = trpc.source.listGroups.useQuery(undefined, {
    staleTime: 60000, // cache for 1 minute
  });

  // Use fetched groups or fallback, sorted with preferred order (TCS, Gulf, MEA, then others)
  const groups = useMemo(() => {
    const raw = sourceGroups && sourceGroups.length > 0 ? sourceGroups : FALLBACK_GROUPS;
    const preferredOrder = ["TCS", "Gulf", "MEA"];
    return [...raw].sort((a, b) => {
      const ai = preferredOrder.findIndex(p => p.toLowerCase() === a.toLowerCase());
      const bi = preferredOrder.findIndex(p => p.toLowerCase() === b.toLowerCase());
      const aIdx = ai >= 0 ? ai : preferredOrder.length;
      const bIdx = bi >= 0 ? bi : preferredOrder.length;
      return aIdx - bIdx;
    });
  }, [sourceGroups]);

  // Build dynamic group data
  const dynamicGroups = useMemo(() => {
    return groups.map((groupName, idx) => {
      const slug = groupName.toLowerCase();
      const theme = GROUP_THEMES[idx % GROUP_THEMES.length];
      let menuItems = getGroupMenuItems(slug);
      // Warehouse only sees installations within each group
      if (isWarehouse) {
        menuItems = menuItems.filter(item => item.path.endsWith("/installations"));
      }
      return { groupName, slug, theme, menuItems };
    });
  }, [groups, isWarehouse]);

  // Expanded state for each group (keyed by group name)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of FALLBACK_GROUPS) {
      const slug = g.toLowerCase();
      initial[g] = location.startsWith(`/${slug}/`) || location.startsWith(`/finance/${slug}`);
    }
    return initial;
  });

  // Update expanded state when groups change
  useEffect(() => {
    setExpandedGroups(prev => {
      const next = { ...prev };
      for (const g of groups) {
        if (!(g in next)) {
          const slug = g.toLowerCase();
          next[g] = location.startsWith(`/${slug}/`) || location.startsWith(`/finance/${slug}`);
        }
      }
      return next;
    });
  }, [groups]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const [settingsExpanded, setSettingsExpanded] = useState(() => settingsPaths.includes(location));

  // Build allMenuItems for active detection
  const allGroupMenuItems = useMemo(() => dynamicGroups.flatMap(g => g.menuItems), [dynamicGroups]);
  const allMenuItems = [...topItems, ...allGroupMenuItems, ...commonItems, ...settingsItems];
  const activeMenuItem = allMenuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Overdue follow-up count for sidebar badge
  const { data: overdueFollowUpCount } = trpc.followUp.overdueCount.useQuery(undefined, {
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Pending approval count for sidebar badge
  const { data: pendingApprovalCount } = trpc.delivery.pendingCount.useQuery(undefined, {
    staleTime: 30000,
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

          <SidebarContent className="bg-sidebar px-2 pt-2 overflow-y-auto">
            <SidebarMenu className="flex-shrink-0">
              {/* Dashboard (top level) */}
              {topItems.map((item) => {
                const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal rounded-lg ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {isActive && !isCollapsed && <ChevronRight className="h-3 w-3 opacity-50" />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* ===== Dynamic Source Groups ===== */}
              {dynamicGroups.map((group) => {
                const isGroupActive = location.startsWith(`/${group.slug}/`) || location.startsWith(`/finance/${group.slug}`);
                const isExpanded = expandedGroups[group.groupName] ?? false;
                const GroupIcon = group.theme.icon;
                return (
                  <div key={group.groupName}>
                    <li aria-hidden="true" className="my-2 mx-2 h-px bg-sidebar-border" />
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => toggleGroup(group.groupName)}
                        tooltip={`งาน ${group.groupName}`}
                        className={`h-10 transition-all font-normal rounded-lg ${isGroupActive ? `${group.theme.headerClass} font-medium` : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                      >
                        <GroupIcon className={`h-4 w-4 ${group.theme.iconClass}`} />
                        <span className="flex-1 font-semibold">งาน {group.groupName}</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {isExpanded && group.menuItems.map((item) => {
                      const isActive = location.startsWith(item.path);
                      const isFollowUpItem = item.path.endsWith("/follow-ups");
                      const groupOverdue = isFollowUpItem && Array.isArray(overdueFollowUpCount)
                        ? overdueFollowUpCount.find((g: any) => item.path.includes(`/${g.groupSlug}/`))
                        : null;
                      const overdueNum = groupOverdue?.count ?? 0;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={item.label}
                            className={`h-9 pl-8 transition-all font-normal rounded-lg ${isActive ? group.theme.activeClass : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.label}</span>
                            {isFollowUpItem && overdueNum > 0 && (
                              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-orange-500 text-white">
                                {overdueNum > 99 ? "99+" : overdueNum}
                              </span>
                            )}
                            {isActive && !isCollapsed && <ChevronRight className="h-3 w-3 opacity-50" />}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </div>
                );
              })}

              {/* ===== Common Items ===== */}
              <li aria-hidden="true" className="my-2 mx-2 h-px bg-sidebar-border" />
              {commonItems.map((item) => {
                const isActive = location === item.path || location.startsWith(item.path + "/");
                const isApprovalItem = item.path === "/approvals";
                const approvalNum = isApprovalItem ? (pendingApprovalCount ?? 0) : 0;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal rounded-lg ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {isApprovalItem && approvalNum > 0 && (
                        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                          {approvalNum > 99 ? "99+" : approvalNum}
                        </span>
                      )}
                      {isActive && !isCollapsed && <ChevronRight className="h-3 w-3 opacity-50" />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* ===== Settings Group ===== */}
              {!isWarehouse && <>
              <li aria-hidden="true" className="my-2 mx-2 h-px bg-sidebar-border" />
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSettingsExpanded(!settingsExpanded)}
                  tooltip="ตั้งค่า"
                  className={`h-10 transition-all font-normal rounded-lg ${settingsPaths.includes(location) ? "text-amber-600 font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                >
                  <Settings className="h-4 w-4 text-amber-500" />
                  <span className="flex-1 font-semibold">ตั้งค่า</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${settingsExpanded ? "" : "-rotate-90"}`} />
                </SidebarMenuButton>
              </SidebarMenuItem>
              {settingsExpanded && settingsItems.map((item) => {
                const isActive = location === item.path || location.startsWith(item.path + "/");
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-9 pl-8 transition-all font-normal rounded-lg ${isActive ? "bg-amber-50 text-amber-700 font-medium dark:bg-amber-950/50 dark:text-amber-400" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.path === "/notifications" && unreadCount !== undefined && unreadCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                      {isActive && !isCollapsed && <ChevronRight className="h-3 w-3 opacity-50" />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              </>}
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
                      {user?.role === "superadmin" ? "Super Admin" : user?.role === "admin" ? "ผู้ดูแลระบบ" : user?.role === "warehouse" ? "คลังสินค้า" : "ทีมสำรวจ"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
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
