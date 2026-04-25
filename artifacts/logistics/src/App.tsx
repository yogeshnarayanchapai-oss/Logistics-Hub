import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth, getRoleHome } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import { Layout } from "@/components/layout";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import OrdersList from "@/pages/orders/OrdersList";
import OrderDetail from "@/pages/orders/OrderDetail";
import NewOrder from "@/pages/orders/NewOrder";
import BulkOrder from "@/pages/orders/BulkOrder";
import EditOrder from "@/pages/orders/EditOrder";
import AssignOrders from "@/pages/orders/AssignOrders";
import DuplicateReview from "@/pages/DuplicateReview";
import Vendors from "@/pages/Vendors";
import Riders from "@/pages/Riders";
import Stations from "@/pages/Stations";
import Users from "@/pages/Users";
import Stock from "@/pages/Stock";
import RiderInventory from "@/pages/RiderInventory";
import Payments from "@/pages/Payments";
import BankAccounts from "@/pages/BankAccounts";
import TicketsList from "@/pages/tickets/TicketsList";
import TicketDetail from "@/pages/tickets/TicketDetail";
import Notifications from "@/pages/Notifications";
import AuditLogs from "@/pages/AuditLogs";
import VendorReport from "@/pages/VendorReport";
import VendorComments from "@/pages/VendorComments";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ADMIN_ROLES = ["admin", "manager", "staff"];
const VENDOR_ROLES = ["vendor"];
const RIDER_ROLES = ["rider"];

function ProtectedRoute({ component: Component, roles }: { component: any; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && roles && !roles.includes(user.role)) {
      setLocation(getRoleHome(user.role));
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (roles && !roles.includes(user.role)) return null;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (user) setLocation(getRoleHome(user.role));
      else setLocation("/login");
    }
  }, [isLoading, user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={RootRedirect} />

      {/* ── ADMIN / MANAGER / STAFF portal ── */}
      <Route path="/admin/dashboard"><ProtectedRoute component={Dashboard} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/orders"><ProtectedRoute component={OrdersList} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/orders/new"><ProtectedRoute component={NewOrder} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/orders/bulk"><ProtectedRoute component={BulkOrder} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/orders/:id/edit"><ProtectedRoute component={EditOrder} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/orders/:id"><ProtectedRoute component={OrderDetail} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/assign-orders"><ProtectedRoute component={AssignOrders} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/duplicate-review"><ProtectedRoute component={DuplicateReview} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/vendors"><ProtectedRoute component={Vendors} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/riders"><ProtectedRoute component={Riders} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/stations"><ProtectedRoute component={Stations} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={Users} roles={["admin"]} /></Route>
      <Route path="/admin/stock"><ProtectedRoute component={Stock} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/payments"><ProtectedRoute component={Payments} roles={["admin", "manager"]} /></Route>
      <Route path="/admin/bank-accounts"><ProtectedRoute component={BankAccounts} roles={["admin"]} /></Route>
      <Route path="/admin/tickets"><ProtectedRoute component={TicketsList} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/tickets/:id"><ProtectedRoute component={TicketDetail} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/notifications"><ProtectedRoute component={Notifications} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/audit-logs"><ProtectedRoute component={AuditLogs} roles={["admin"]} /></Route>
      <Route path="/admin/profile"><ProtectedRoute component={Profile} roles={[...ADMIN_ROLES]} /></Route>
      <Route path="/admin/settings"><ProtectedRoute component={Settings} roles={["admin"]} /></Route>

      {/* ── VENDOR portal ── */}
      <Route path="/vendor/dashboard"><ProtectedRoute component={Dashboard} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/orders"><ProtectedRoute component={OrdersList} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/orders/new"><ProtectedRoute component={NewOrder} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/orders/bulk"><ProtectedRoute component={BulkOrder} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/orders/:id"><ProtectedRoute component={OrderDetail} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/stock"><ProtectedRoute component={Stock} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/payments"><ProtectedRoute component={Payments} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/bank-accounts"><ProtectedRoute component={BankAccounts} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/reports"><ProtectedRoute component={VendorReport} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/comments"><ProtectedRoute component={VendorComments} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/tickets"><ProtectedRoute component={TicketsList} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/tickets/:id"><ProtectedRoute component={TicketDetail} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/notifications"><ProtectedRoute component={Notifications} roles={[...VENDOR_ROLES]} /></Route>
      <Route path="/vendor/profile"><ProtectedRoute component={Profile} roles={[...VENDOR_ROLES]} /></Route>

      {/* ── RIDER portal ── */}
      <Route path="/rider/dashboard"><ProtectedRoute component={Dashboard} roles={[...RIDER_ROLES]} /></Route>
      <Route path="/rider/orders"><ProtectedRoute component={OrdersList} roles={[...RIDER_ROLES]} /></Route>
      <Route path="/rider/orders/:id"><ProtectedRoute component={OrderDetail} roles={[...RIDER_ROLES]} /></Route>
      <Route path="/rider/inventory"><ProtectedRoute component={RiderInventory} roles={[...RIDER_ROLES]} /></Route>
      <Route path="/rider/tickets"><ProtectedRoute component={TicketsList} roles={[...RIDER_ROLES]} /></Route>
      <Route path="/rider/tickets/:id"><ProtectedRoute component={TicketDetail} roles={[...RIDER_ROLES]} /></Route>
      <Route path="/rider/notifications"><ProtectedRoute component={Notifications} roles={[...RIDER_ROLES]} /></Route>
      <Route path="/rider/profile"><ProtectedRoute component={Profile} roles={[...RIDER_ROLES]} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandingProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </BrandingProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
