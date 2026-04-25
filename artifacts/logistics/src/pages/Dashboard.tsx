import { useAuth } from "@/lib/auth";
import { 
  useGetAdminDashboardSummary, 
  useGetVendorDashboardSummary, 
  useGetRiderDashboardSummary,
  useGetOrderTrends,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, CheckCircle, XCircle, Clock, Truck, DollarSign, Users, Store, AlertTriangle, MessageSquare, CalendarClock, Phone, MapPin, ChevronRight, RefreshCw, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back, {user.name}.</p>
      </div>

      {user.role === "admin" || user.role === "manager" ? (
        <AdminDashboard />
      ) : user.role === "vendor" ? (
        <VendorDashboard />
      ) : user.role === "rider" ? (
        <RiderDashboard />
      ) : null}
    </div>
  );
}

function AdminDashboard() {
  const { data: summary, isLoading } = useGetAdminDashboardSummary();
  const { data: trends } = useGetOrderTrends({ query: { days: 7 } });

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Delivery</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pendingOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.deliveredOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed/Returned</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.failedOrders + summary.returnedOrders}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">COD Collected Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {summary.codCollectedToday.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeVendors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Riders</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeRiders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duplicate Flagged</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.duplicateFlagged}</div>
          </CardContent>
        </Card>
      </div>

      {trends && trends.length > 0 && (
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Order Trends (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="delivered" name="Delivered" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="Total" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VendorDashboard() {
  const { data: raw, isLoading } = useGetVendorDashboardSummary();

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!raw) return null;

  const summary = raw as any;
  const pkg = summary.packages ?? {};
  const pkgVal = summary.packageValues ?? {};
  const cod = summary.cod ?? {};
  const today = summary.today ?? {};
  const sales = summary.sales ?? {};

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A";

  const statusChartData = [
    { name: "New", value: pkg.processing ?? 0 },
    { name: "Delivered", value: pkg.delivered ?? 0 },
    { name: "Returned", value: pkg.returned ?? 0 },
    { name: "Hold", value: pkg.hold ?? 0 },
    { name: "Failed", value: pkg.failed ?? 0 },
    { name: "Cancelled", value: pkg.cancelled ?? 0 },
  ];
  const chartColors = ["#6366f1", "#22c55e", "#f97316", "#eab308", "#ef4444", "#94a3b8"];

  return (
    <div className="space-y-5">
      {/* Top 4 panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Packages */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold text-center border-b pb-2">Packages</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1 text-sm">
            {[
              ["Total:", pkg.total ?? 0],
              ["Delivered:", pkg.delivered ?? 0],
              ["Returned:", pkg.returned ?? 0],
              ["Processing:", pkg.processing ?? 0],
              ["Hold:", pkg.hold ?? 0],
              ["Failed:", pkg.failed ?? 0],
              ["Cancelled:", pkg.cancelled ?? 0],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{val as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Package Value */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold text-center border-b pb-2">Package Value (Rs)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1 text-sm">
            {[
              ["Total:", pkgVal.total ?? 0],
              ["Delivered:", pkgVal.delivered ?? 0],
              ["Returned:", pkgVal.returned ?? 0],
              ["Processing:", pkgVal.processing ?? 0],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{fmt(val as number)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* COD Details */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold text-center border-b pb-2">COD Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending:</span>
              <span className="font-semibold text-orange-600">Rs:{fmt(cod.pending ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last COD Amt:</span>
              <span className="font-semibold">Rs:{fmt(cod.lastCodAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Charges:</span>
              <span className="font-semibold">Rs:{fmt(cod.deliveryCharges ?? 0)}</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="text-muted-foreground shrink-0">Last COD Transfer:</span>
              <span className="font-semibold text-right text-primary">{fmtDate(cod.lastTransferDate)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Details */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold text-center border-b pb-2">Today's Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{today.delivered ?? 0}</div>
                <div className="text-xs text-muted-foreground">Delivered Orders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{today.returned ?? 0}</div>
                <div className="text-xs text-muted-foreground">Returned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{today.created ?? 0}</div>
                <div className="text-xs text-muted-foreground">Order Created</div>
              </div>
              <Link href="/vendor-comments">
                <div className="text-center cursor-pointer hover:bg-muted rounded p-1 transition-colors">
                  <div className="text-2xl font-bold text-blue-600">{today.comments ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Order's Comment</div>
                </div>
              </Link>
            </div>
            <div className="border-t pt-2 grid grid-cols-3 gap-1 text-center">
              <div>
                <div className="text-lg font-bold text-yellow-600">{today.hold ?? 0}</div>
                <div className="text-xs text-muted-foreground">Hold Orders</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">{today.stale ?? 0}</div>
                <div className="text-xs text-muted-foreground">Stale Orders</div>
              </div>
              <div>
                <div className="text-lg font-bold">{today.rtv ?? 0}</div>
                <div className="text-xs text-muted-foreground">RTV Orders</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Status Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold text-center">Order Status</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Orders" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sales Statistics */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold text-center border-b pb-2">Sales Statistics</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{sales.successRate ?? 0}%</div>
                <div className="text-xs text-muted-foreground">Successful Delivered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{sales.returnRate ?? 0}%</div>
                <div className="text-xs text-muted-foreground">Returned Delivered</div>
              </div>
            </div>
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Packages:</span>
                <span className="font-semibold">{pkg.total ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivered:</span>
                <span className="font-semibold text-green-600">{pkg.delivered ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Returned:</span>
                <span className="font-semibold text-red-600">{pkg.returned ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing:</span>
                <span className="font-semibold text-indigo-600">{pkg.processing ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const RIDER_STATUSES = [
  { value: "out_for_delivery", label: "Out for Delivery", color: "bg-blue-100 text-blue-800" },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-800" },
  { value: "partial_delivered", label: "Partial Delivery", color: "bg-teal-100 text-teal-800" },
  { value: "failed_delivery", label: "Failed Delivery", color: "bg-red-100 text-red-800" },
  { value: "followup", label: "Follow Up", color: "bg-amber-100 text-amber-800" },
  { value: "reschedule", label: "Reschedule", color: "bg-orange-100 text-orange-800" },
  { value: "return_pending", label: "Return", color: "bg-gray-100 text-gray-800" },
];

function statusLabel(s: string) {
  return RIDER_STATUSES.find((x) => x.value === s)?.label ?? s.replace(/_/g, " ");
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    assigned: "bg-blue-50 text-blue-700",
    confirmed: "bg-indigo-100 text-indigo-700",
    picked_for_delivery: "bg-purple-100 text-purple-700",
    out_for_delivery: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
    partial_delivered: "bg-teal-100 text-teal-800",
    failed_delivery: "bg-red-100 text-red-800",
    followup: "bg-amber-100 text-amber-800",
    reschedule: "bg-orange-100 text-orange-800",
    return_pending: "bg-gray-100 text-gray-800",
  };
  return map[s] ?? "bg-gray-100 text-gray-700";
}

interface OrderItem {
  id: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  area: string | null;
  city: string | null;
  codAmount: number;
  productName: string;
  status: string;
  followupDate?: string | null;
}

function StatusUpdateSheet({
  order,
  open,
  onClose,
  onUpdated,
}: {
  order: OrderItem | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [comment, setComment] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && order) {
      setStatus(order.status);
      setComment("");
      const now = new Date();
      setScheduleDate(now.toISOString().split("T")[0]);
      setScheduleTime(now.toTimeString().slice(0, 5));
    }
  }, [open, order]);

  const needsSchedule = status === "followup" || status === "reschedule";

  const handleSubmit = async () => {
    if (!order || !status) return;
    setSubmitting(true);
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const token = localStorage.getItem("authToken");
    try {
      const body: Record<string, unknown> = { status, comment: comment.trim() || undefined };
      if (needsSchedule && scheduleDate && scheduleTime) {
        body.followupDate = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      }
      const res = await fetch(`${base}/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Status updated", description: `Order ${order.orderCode} → ${statusLabel(status)}` });
      onUpdated();
      onClose();
    } catch {
      toast({ title: "Error", description: "Could not update status", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">Update Order Status</SheetTitle>
          {order && (
            <div className="text-left">
              <span className="font-semibold text-sm">{order.orderCode}</span>
              <span className="text-muted-foreground text-sm"> · {order.customerName}</span>
              <div className="text-xs text-muted-foreground mt-0.5">{order.productName}</div>
            </div>
          )}
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {RIDER_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-base py-3">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsSchedule && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Schedule Date & Time</Label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-32 h-12 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Comment (optional)</Label>
            <Textarea
              placeholder="Add a note about this delivery..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px] text-base resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button className="flex-1 h-12 text-base" onClick={handleSubmit} disabled={submitting || !status}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrderCard({ order, onUpdate }: { order: OrderItem; onUpdate: () => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <div className="flex items-start gap-3 py-3 px-1">
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{order.orderCode}</span>
            <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${statusColor(order.status)}`}>
              {statusLabel(order.status)}
            </Badge>
          </div>
          <div className="text-sm font-medium truncate">{order.customerName}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customerPhone}</span>
            {(order.area || order.city) && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[order.area, order.city].filter(Boolean).join(", ")}</span>
            )}
            {order.followupDate && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <CalendarClock className="h-3 w-3" />{format(new Date(order.followupDate), "h:mm a")}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{order.productName}</div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="text-sm font-bold text-green-700">Rs. {order.codAmount.toLocaleString()}</div>
          <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={() => setSheetOpen(true)}>
            Update
          </Button>
        </div>
      </div>
      <StatusUpdateSheet
        order={order}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUpdated={onUpdate}
      />
    </>
  );
}

function RiderDashboard() {
  const { data: summary, isLoading } = useGetRiderDashboardSummary();
  const { toast } = useToast();

  const [activeOrders, setActiveOrders] = useState<OrderItem[]>([]);
  const [followups, setFollowups] = useState<OrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const token = localStorage.getItem("authToken");
    const headers = { Authorization: `Bearer ${token}` };
    setOrdersLoading(true);
    Promise.all([
      fetch(`${base}/api/dashboard/rider-today-orders`, { headers }).then((r) => r.json()),
      fetch(`${base}/api/dashboard/rider-followups`, { headers }).then((r) => r.json()),
    ])
      .then(([active, fu]) => {
        setActiveOrders(Array.isArray(active) ? active : []);
        setFollowups(Array.isArray(fu) ? fu : []);
      })
      .catch(() => { setActiveOrders([]); setFollowups([]); })
      .finally(() => setOrdersLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Today</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.assignedToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.deliveredToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pendingToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">COD Collected Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {summary.codCollectedToday.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Orders */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-5 w-5 text-primary" />
              Active Orders
              {activeOrders.length > 0 && (
                <Badge className="ml-1 bg-primary/10 text-primary border-0 hover:bg-primary/10 text-xs">
                  {activeOrders.length}
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchOrders} disabled={ordersLoading} className="h-8 w-8 p-0">
              <RefreshCw className={`h-3.5 w-3.5 ${ordersLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : activeOrders.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <Package className="h-10 w-10 mb-2 opacity-25" />
              <p className="text-sm">No active orders right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} onUpdate={fetchOrders} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Follow-ups & Rescheduled */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              Today's Follow-ups
              {followups.length > 0 && (
                <Badge className="ml-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100 text-xs">
                  {followups.length}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : followups.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <CalendarClock className="h-10 w-10 mb-2 opacity-25" />
              <p className="text-sm">No follow-up or rescheduled orders for today.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {followups.map((order) => (
                <OrderCard key={order.id} order={order} onUpdate={fetchOrders} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
