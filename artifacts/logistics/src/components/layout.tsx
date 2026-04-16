import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
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

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "vendor", "rider", "staff"] },
    { name: "Orders", href: "/orders", icon: Package, roles: ["admin", "manager", "vendor", "rider", "staff"] },
    { name: "Assign Orders", href: "/assign-orders", icon: UserCheck, roles: ["admin", "manager"] },
    { name: "Vendors", href: "/vendors", icon: Building2, roles: ["admin", "manager"] },
    { name: "Riders", href: "/riders", icon: Truck, roles: ["admin", "manager", "station"] },
    { name: "Stations", href: "/stations", icon: MapPin, roles: ["admin", "manager"] },
    { name: "Users", href: "/users", icon: Users, roles: ["admin"] },
    { name: "Stock Inventory", href: "/stock", icon: Package, roles: ["admin", "manager", "vendor"] },
    { name: "Payments", href: "/payments", icon: Wallet, roles: ["admin", "manager", "vendor"] },
    { name: "My Reports", href: "/vendor-report", icon: BarChart2, roles: ["vendor"] },
    { name: "Support Tickets", href: "/tickets", icon: Ticket, roles: ["admin", "manager", "vendor", "rider"] },
    { name: "Audit Logs", href: "/audit-logs", icon: Activity, roles: ["admin"] },
  ];

  const filteredNavigation = navigation.filter((item) => 
    item.roles.includes(user.role)
  );

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 bg-primary z-50 shadow-lg">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-primary-foreground/20">
          <Truck className="h-8 w-8 text-primary-foreground mr-2" />
          <span className="text-xl font-bold text-primary-foreground">SwiftShip</span>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + '/');
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                    isActive ? "bg-primary-foreground/20 font-medium" : ""
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5 opacity-90" aria-hidden="true" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-primary-foreground/20">
          <div className="flex items-center text-primary-foreground mb-4 px-2">
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs opacity-70 truncate capitalize">{user.role}</p>
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
          <h1 className="text-lg font-medium">
            {filteredNavigation.find(n => location === n.href || location.startsWith(n.href + '/'))?.name || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
              </Button>
            </Link>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold">
                  {initials}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user.role} · {user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    My Profile
                  </DropdownMenuItem>
                </Link>
                {user.role === "admin" && (
                  <Link href="/settings">
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
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
