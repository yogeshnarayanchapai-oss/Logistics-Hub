import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import {
  useGetVendorDashboardSummary,
  useListOrders,
  useListPaymentRequests,
  useGetCodSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Package, Truck, AlertCircle, DollarSign, Wallet, TrendingUp, BarChart2 } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  new: "#6366f1",
  assigned: "#f59e0b",
  picked_up: "#3b82f6",
  in_transit: "#8b5cf6",
  delivered: "#10b981",
  failed_delivery: "#ef4444",
  returned: "#f97316",
  cancelled: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  assigned: "Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
  failed_delivery: "Failed",
  returned: "Returned",
  cancelled: "Cancelled",
};

export default function VendorReport() {
  const { user } = useAuth();
  const vendorId = user?.vendorId ?? undefined;

  const defaultFrom = useMemo(() => format(startOfMonth(new Date()), "yyyy-MM-dd"), []);
  const defaultTo = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const dateFromMemo = useMemo(() => dateFrom, [dateFrom]);
  const dateToMemo = useMemo(() => dateTo, [dateTo]);

  const { data: summary, isLoading: summaryLoading } = useGetVendorDashboardSummary();
  const { data: codSummary } = useGetCodSummary({ query: { vendorId } });

  const { data: orders, isLoading: ordersLoading } = useListOrders(
    { vendorId, dateFrom: dateFromMemo, dateTo: dateToMemo, limit: 500 },
    { query: { enabled: !!vendorId } }
  );

  const { data: paymentRequests, isLoading: paymentsLoading } = useListPaymentRequests(
    { vendorId },
    { query: { enabled: !!vendorId } }
  );

  const orderList = useMemo(() => (orders as any)?.orders ?? [], [orders]);

  const ordersByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    orderList.forEach((o: any) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
      fill: STATUS_COLORS[status] ?? "#94a3b8",
    }));
  }, [orderList]);

  const totalInPeriod = useMemo(() => orderList.length, [orderList]);
  const deliveredInPeriod = useMemo(() => orderList.filter((o: any) => o.status === "delivered").length, [orderList]);
  const failedInPeriod = useMemo(() => orderList.filter((o: any) => o.status === "failed_delivery").length, [orderList]);
  const pendingInPeriod = useMemo(() => orderList.filter((o: any) => ["new", "assigned", "picked_up", "in_transit"].includes(o.status)).length, [orderList]);

  const deliveryRate = totalInPeriod > 0 ? ((deliveredInPeriod / totalInPeriod) * 100).toFixed(1) : "0.0";

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Reports</h2>
        <p className="text-muted-foreground">Overview of your orders, COD, and payment activity.</p>
      </div>

      {/* Overall Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Delivered</CardTitle>
            <Truck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary?.deliveredOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summary?.pendingOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.failedOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{summary?.todayOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Placed today</p>
          </CardContent>
        </Card>
      </div>

      {/* COD Summary */}
      {codSummary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total COD Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rs. {codSummary.totalVendorPayable.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">From all delivered orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Released to You</CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">Rs. {codSummary.totalReleased.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Already transferred</p>
            </CardContent>
          </Card>
          <Card className="border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Pending Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Rs. {codSummary.pendingRelease.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Available to request</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Date Range Filter + Order Stats */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5" /> Orders in Period</CardTitle>
              <CardDescription>Filter by date range to analyze your orders.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm w-36" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm w-36" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-slate-50 border">
                  <div className="text-2xl font-bold">{totalInPeriod}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Orders</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-700">{deliveredInPeriod}</div>
                  <div className="text-xs text-muted-foreground mt-1">Delivered</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-2xl font-bold text-red-700">{failedInPeriod}</div>
                  <div className="text-xs text-muted-foreground mt-1">Failed</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-2xl font-bold text-primary">{deliveryRate}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Delivery Rate</div>
                </div>
              </div>

              {/* Bar Chart */}
              {ordersByStatus.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Orders by Status</p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={ordersByStatus} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [v, "Orders"]} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {ordersByStatus.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={ordersByStatus} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {ordersByStatus.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [v, "Orders"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {totalInPeriod === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No orders found in the selected date range.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Requests History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Request History</CardTitle>
          <CardDescription>All payment requests you have submitted.</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account Info</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead>Ref / Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!paymentRequests || paymentRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No payment requests yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paymentRequests.map((pr: any) => (
                      <TableRow key={pr.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(pr.createdAt), "MMM d, yyyy")}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">{pr.bankAccountInfo}</TableCell>
                        <TableCell className="text-right">Rs. {pr.requestedAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {pr.approvedAmount ? `Rs. ${pr.approvedAmount.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {pr.referenceId ? (
                            <div>
                              <div className="font-mono text-xs">{pr.referenceId}</div>
                              {pr.paymentDate && <div className="text-muted-foreground">{format(new Date(pr.paymentDate), "MMM d, yyyy")}</div>}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={pr.status === "pending" ? "secondary" : pr.status === "approved" ? "default" : pr.status === "released" ? "outline" : "destructive"}
                            className={pr.status === "released" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
                          >
                            {pr.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
