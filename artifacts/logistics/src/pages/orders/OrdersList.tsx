import { useListOrders } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useState, useRef, useMemo } from "react";
import { Link } from "wouter";
import { format, subDays, startOfDay } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type DatePreset = "all" | "today" | "last7" | "last30" | "custom";

function getDateRange(preset: DatePreset, customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === "today") {
    return { dateFrom: startOfDay(now).toISOString(), dateTo: now.toISOString() };
  }
  if (preset === "last7") {
    return { dateFrom: subDays(now, 7).toISOString(), dateTo: now.toISOString() };
  }
  if (preset === "last30") {
    return { dateFrom: subDays(now, 30).toISOString(), dateTo: now.toISOString() };
  }
  if (preset === "custom" && customFrom) {
    return {
      dateFrom: new Date(customFrom).toISOString(),
      dateTo: customTo ? new Date(customTo + "T23:59:59").toISOString() : now.toISOString(),
    };
  }
  return { dateFrom: undefined, dateTo: undefined };
}

export default function OrdersList() {
  const { user } = useAuth();

  // Search state — committed only when user clicks the Search button
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Filters — only applied when no active search
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [page, setPage] = useState(1);
  const limit = 20;
  const searchRef = useRef<HTMLInputElement>(null);

  // When search is active, bypass all filters
  const isSearchMode = activeSearch.length > 0;

  const { dateFrom, dateTo } = useMemo(
    () => isSearchMode ? { dateFrom: undefined, dateTo: undefined } : getDateRange(datePreset, customFrom, customTo),
    [isSearchMode, datePreset, customFrom, customTo]
  );

  const { data, isLoading } = useListOrders({
    search: activeSearch || undefined,
    status: (!isSearchMode && statusFilter !== "all") ? statusFilter : undefined,
    dateFrom,
    dateTo,
    page,
    limit,
  });

  const handleSearch = () => {
    setActiveSearch(searchInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
    searchRef.current?.focus();
  };

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground">Manage and track all deliveries.</p>
        </div>
        <div className="flex items-center gap-2">
          {["admin", "manager", "vendor"].includes(user?.role || "") && (
            <>
              <Link href="/orders/bulk">
                <Button variant="outline">Bulk Import</Button>
              </Link>
              <Link href="/orders/new">
                <Button><Plus className="mr-2 h-4 w-4" /> Create Order</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search by order code, customer name, phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 pr-8"
              />
              {searchInput && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} className="shrink-0">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            {isSearchMode && (
              <Button variant="outline" onClick={handleClearSearch} className="shrink-0">
                Clear
              </Button>
            )}
          </div>

          {/* Filters row — dimmed when search is active */}
          <div className={`flex flex-wrap gap-3 transition-opacity ${isSearchMode ? "opacity-40 pointer-events-none" : ""}`}>
            {/* Status */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); handleFilterChange(); }}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="duplicate_flagged">Duplicate Flagged</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="picked_for_delivery">Picked Up</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed_delivery">Failed</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
                <SelectItem value="return_pending">Return Pending</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Date preset */}
            <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); handleFilterChange(); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="last30">Last 30 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom date inputs */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); handleFilterChange(); }}
                  className="w-[145px]"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => { setCustomTo(e.target.value); handleFilterChange(); }}
                  className="w-[145px]"
                  min={customFrom}
                />
              </div>
            )}

            {/* Active filter badges */}
            {(statusFilter !== "all" || datePreset !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-9 px-2"
                onClick={() => { setStatusFilter("all"); setDatePreset("today"); setCustomFrom(""); setCustomTo(""); handleFilterChange(); }}
              >
                <X className="mr-1 h-3 w-3" /> Reset filters
              </Button>
            )}
          </div>

          {/* Active mode indicator */}
          {isSearchMode && (
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <Search className="h-3.5 w-3.5" />
              Showing results for <span className="font-semibold">"{activeSearch}"</span> across all orders
              <button onClick={handleClearSearch} className="underline text-muted-foreground ml-1">cancel</button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>COD Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.orders.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                            {order.orderCode}
                          </Link>
                          {order.duplicateFlag && (
                            <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">Dup</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="truncate max-w-[150px]">{order.address}</div>
                          <div className="text-xs text-muted-foreground">{order.city}</div>
                        </TableCell>
                        <TableCell className="font-medium">Rs. {order.codAmount.toLocaleString()}</TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                {data.total === 0
                  ? "No results"
                  : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)} of ${data.total} orders`}
              </div>
              {data.total > limit && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * limit >= data.total}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
