import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, getRoleHome } from "@/lib/auth";
import { useListNotifications } from "@workspace/api-client-react";
import { useBranding } from "@/lib/branding";
import {
  LayoutDashboard,
  Package,
  Users,
  MapPin,
  Truck,
  Building2,
  Settings,
  LogOut,
  Bell,
  Ticket,
  Wallet,
  Activity,
  UserCheck,
  BarChart2,
  UserCircle,
  MessageSquare,
  CreditCard,
  Copy,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badgeTypes?: string[];
}

function getNavItems(role: string): NavItem[] {
  if (role === "vendor") {
    return [
      { name: "Dashboard", href: "/vendor/dashboard", icon: LayoutDashboard },
      { name: "My Orders", href: "/vendor/orders", icon: Package, badgeTypes: ["new_comment"] },
      { name: "Stock Inventory", href: "/vendor/stock", icon: Package },
      { name: "Payments", href: "/vendor/payments", icon: Wallet },
      { name: "My Reports", href: "/vendor/reports", icon: BarChart2 },
      {
        name: "Today's Comments",
        href: "/vendor/comments",
        icon: MessageSquare,
      },
      { name: "Support Tickets", href: "/vendor/tickets", icon: Ticket },
    ];
  }

  if (role === "rider") {
    return [
      { name: "Dashboard", href: "/rider/dashboard", icon: LayoutDashboard },
      { name: "Orders", href: "/rider/orders", icon: Package, badgeTypes: ["order_assigned", "new_comment"] },
      { name: "My Inventory", href: "/rider/inventory", icon: ClipboardList },
      { name: "Payments", href: "/rider/payments", icon: Wallet },
      { name: "Support Tickets", href: "/rider/tickets", icon: Ticket },
    ];
  }

  // admin / manager / staff
  const items: NavItem[] = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Orders", href: "/admin/orders", icon: Package },
    { name: "Assign Orders", href: "/admin/assign-orders", icon: UserCheck, badgeTypes: ["new_order"] },
    { name: "Duplicate Review", href: "/admin/duplicate-review", icon: Copy },
    { name: "Vendors", href: "/admin/vendors", icon: Building2 },
    { name: "Riders", href: "/admin/riders", icon: Truck },
    { name: "Stations", href: "/admin/stations", icon: MapPin },
  ];

  if (role === "admin" || role === "manager") {
    items.push({
      name: "Stock Inventory",
      href: "/admin/stock",
      icon: Package,
    });
    items.push({ name: "Payments", href: "/admin/payments", icon: Wallet });
  }

  if (role === "admin") {
    items.push({ name: "Users", href: "/admin/users", icon: Users });
    items.push({
      name: "Audit Logs",
      href: "/admin/audit-logs",
      icon: Activity,
    });
  }

  items.push({ name: "Support Tickets", href: "/admin/tickets", icon: Ticket });

  return items;
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const [location] = useLocation();

  const { data: unreadNotifications } = useListNotifications(
    { unreadOnly: true },
    { query: { refetchInterval: 30000, enabled: !!user } }
  );

  function getBadgeCount(types: string[]): number {
    if (!unreadNotifications) return 0;
    return unreadNotifications.filter((n) => types.includes(n.type)).length;
  }

  if (!user) return <>{children}</>;

  const navItems = getNavItems(user.role);
  const prefix =
    user.role === "vendor"
      ? "/vendor"
      : user.role === "rider"
        ? "/rider"
        : "/admin";

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const currentPageName =
    navItems.find(
      (n) => location === n.href || location.startsWith(n.href + "/"),
    )?.name ?? "Dashboard";

  const roleLabel =
    user.role === "admin"
      ? "Administrator"
      : user.role === "manager"
        ? "Manager"
        : user.role === "vendor"
          ? "Vendor"
          : user.role === "rider"
            ? "Rider"
            : user.role === "staff"
              ? "Staff"
              : user.role;

  const totalUnread = unreadNotifications?.length ?? 0;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 bg-primary z-50 shadow-lg">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-primary-foreground/20">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="logo" className="h-8 w-8 mr-2 object-contain rounded" />
          ) : (
            <Truck className="h-8 w-8 text-primary-foreground mr-2" />
          )}
          <span className="text-xl font-bold text-primary-foreground truncate">
            {branding.companyName}
          </span>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              location === item.href || location.startsWith(item.href + "/");
            const badgeCount = item.badgeTypes ? getBadgeCount(item.badgeTypes) : 0;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                    isActive ? "bg-primary-foreground/20 font-medium" : "",
                  )}
                >
                  <item.icon
                    className="mr-3 h-5 w-5 opacity-90 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">{item.name}</span>
                  {badgeCount > 0 && (
                    <span className="ml-2 bg-white text-primary text-xs font-bold rounded-full h-5 min-w-[1.25rem] flex items-center justify-center px-1 leading-none">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-primary-foreground/20">
          <div className="flex items-center text-primary-foreground mb-4 px-2">
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs opacity-70 truncate">{roleLabel}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-primary-foreground hover:bg-red-700 hover:text-primary-foreground"
            onClick={() => logout()}
          >
            <LogOut className="mr-3 h-5 w-5 opacity-90" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-6 shadow-sm z-10">
          <h1 className="text-lg font-medium">{currentPageName}</h1>
          <div className="flex items-center gap-2">
            <Link href={`${prefix}/notifications`}>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-0.5 leading-none">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold"
                >
                  {initials}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel} · {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href={`${prefix}/profile`}>
                  <DropdownMenuItem className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    My Profile
                  </DropdownMenuItem>
                </Link>
                {user.role === "admin" && (
                  <Link href="/admin/settings">
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => logout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 relative">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
