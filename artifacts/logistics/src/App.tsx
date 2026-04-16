import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
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
import Payments from "@/pages/Payments";
import BankAccounts from "@/pages/BankAccounts";
import TicketsList from "@/pages/tickets/TicketsList";
import TicketDetail from "@/pages/tickets/TicketDetail";
import Notifications from "@/pages/Notifications";
import AuditLogs from "@/pages/AuditLogs";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, roles }: { component: any, roles?: string[] }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && roles && !roles.includes(user.role)) {
      setLocation("/dashboard");
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

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/dashboard"); }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={RedirectToDashboard} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/orders"><ProtectedRoute component={OrdersList} /></Route>
      <Route path="/orders/new"><ProtectedRoute component={NewOrder} /></Route>
      <Route path="/orders/bulk"><ProtectedRoute component={BulkOrder} roles={["admin", "manager", "vendor"]} /></Route>
      <Route path="/assign-orders"><ProtectedRoute component={AssignOrders} roles={["admin", "manager"]} /></Route>
      <Route path="/orders/:id/edit"><ProtectedRoute component={EditOrder} roles={["admin", "manager"]} /></Route>
      <Route path="/orders/:id"><ProtectedRoute component={OrderDetail} /></Route>
      <Route path="/duplicate-review"><ProtectedRoute component={DuplicateReview} roles={["admin", "manager"]} /></Route>
      <Route path="/vendors"><ProtectedRoute component={Vendors} roles={["admin", "manager"]} /></Route>
      <Route path="/riders"><ProtectedRoute component={Riders} roles={["admin", "manager", "station"]} /></Route>
      <Route path="/stations"><ProtectedRoute component={Stations} roles={["admin", "manager"]} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} roles={["admin"]} /></Route>
      <Route path="/stock"><ProtectedRoute component={Stock} roles={["admin", "manager", "vendor"]} /></Route>
      <Route path="/payments"><ProtectedRoute component={Payments} roles={["admin", "manager", "vendor"]} /></Route>
      <Route path="/bank-accounts"><ProtectedRoute component={BankAccounts} roles={["admin", "vendor"]} /></Route>
      <Route path="/tickets"><ProtectedRoute component={TicketsList} /></Route>
      <Route path="/tickets/:id"><ProtectedRoute component={TicketDetail} /></Route>
      <Route path="/notifications"><ProtectedRoute component={Notifications} /></Route>
      <Route path="/audit-logs"><ProtectedRoute component={AuditLogs} roles={["admin"]} /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} roles={["admin"]} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
