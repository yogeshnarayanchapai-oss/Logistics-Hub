import { useListOrders, useListRiders, useAssignOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Search, X, UserCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type DatePreset = "all" | "today" | "last7" | "last30" | "custom";

function getDateRange(preset: DatePreset, customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === "today") return { dateFrom: startOfDay(now).toISOString(), dateTo: now.toISOString() };
  if (preset === "last7") return { dateFrom: subDays(now, 7).toISOString(), dateTo: now.toISOString() };
  if (preset === "last30") return { dateFrom: subDays(now, 30).toISOString(), dateTo: now.toISOString() };
  if (preset === "custom" && customFrom) return {
    dateFrom: new Date(customFrom).toISOString(),
    dateTo: customTo ? new Date(customTo + "T23:59:59").toISOString() : now.toISOString(),
  };
  return { dateFrom: undefined, dateTo: undefined };
}

function AssignButton({ orderId, stationId, onAssigned }: { orderId: number; stationId?: number | null; onAssigned: () => void }) {
  const [open, setOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string>("");
  const { toast } = useToast();

  const { data: riders } = useListRiders(
    stationId ? { stationId } : {},
    { query: { enabled: open } }
  );

  const assignMutation = useAssignOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order assigned", description: "Rider has been assigned successfully." });
        setOpen(false);
        setSelectedRider("");
        onAssigned();
      },
      onError: () => {
        toast({ title: "Assignment failed", variant: "destructive" });
      },
    },
  });

  const handleAssign = () => {
    if (!selectedRider) return;
    assignMutation.mutate({ id: orderId, data: { riderId: parseInt(selectedRider, 10) } });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserCheck className="h-3.5 w-3.5" />
          Assign
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">Assign Rider</p>
          <Select value={selectedRider} onValueChange={setSelectedRider}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a rider..." />
            </SelectTrigger>
            <SelectContent>
              {!riders?.length ? (
                <SelectItem value="none" disabled>No riders available</SelectItem>
              ) : (
                riders.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    <span className="font-medium">{r.name}</span>
                    {r.stationName && <span className="text-muted-foreground ml-1 text-xs">· {r.stationName}</span>}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleAssign}
              disabled={!selectedRider || assignMutation.isPending}
            >
              {assignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function AssignOrders() {
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const isSearchMode = activeSearch.length > 0;
  const { dateFrom, dateTo } = useMemo(
    () => isSearchMode ? { dateFrom: undefined, dateTo: undefined } : getDateRange(datePreset, customFrom, customTo),
    [isSearchMode, datePreset, customFrom, customTo]
  );

  const queryParams = {
    status: "new",
    search: activeSearch || undefined,
    dateFrom,
    dateTo,
    page,
    limit,
  };

  const { data, isLoading } = useListOrders(queryParams);

  const handleSearch = () => { setActiveSearch(searchInput.trim()); setPage(1); };
  const handleClearSearch = () => { setSearchInput(""); setActiveSearch(""); setPage(1); searchRef.current?.focus(); };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey(queryParams) });
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Assign Orders</h2>
        <p className="text-muted-foreground">New unassigned orders waiting for a rider.</p>
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
                <button onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} className="shrink-0">
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
            {isSearchMode && (
              <Button variant="outline" onClick={handleClearSearch} className="shrink-0">Clear</Button>
            )}
          </div>

          {/* Filters row */}
          <div className={`flex flex-wrap gap-3 transition-opacity ${isSearchMode ? "opacity-40 pointer-events-none" : ""}`}>
            <Select value={datePreset} onValueChange={(v) => { setDatePreset(v as DatePreset); setPage(1); }}>
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

            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }} className="w-[145px]" />
                <span className="text-muted-foreground text-sm">to</span>
                <Input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPage(1); }} className="w-[145px]" min={customFrom} />
              </div>
            )}

            {datePreset !== "today" && (
              <Button variant="ghost" size="sm" className="text-muted-foreground h-9 px-2"
                onClick={() => { setDatePreset("today"); setCustomFrom(""); setCustomTo(""); setPage(1); }}>
                <X className="mr-1 h-3 w-3" /> Reset
              </Button>
            )}
          </div>

          {isSearchMode && (
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <Search className="h-3.5 w-3.5" />
              Showing results for <span className="font-semibold">"{activeSearch}"</span> — status: New only
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
                    <TableHead>Vendor</TableHead>
                    <TableHead>COD Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Assign</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.orders.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No unassigned orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                            {order.orderCode}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="truncate max-w-[140px]">{order.address}</div>
                          <div className="text-xs text-muted-foreground">{order.stationName ?? order.city ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{order.vendorName}</TableCell>
                        <TableCell className="font-medium">Rs. {order.codAmount.toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={order.status} /></TableCell>
                        <TableCell className="text-right">
                          <AssignButton
                            orderId={order.id}
                            stationId={order.stationId}
                            onAssigned={invalidateList}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {data && data.total > 0 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                {`Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)} of ${data.total} orders`}
              </div>
              {data.total > limit && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * limit >= data.total}>Next</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
