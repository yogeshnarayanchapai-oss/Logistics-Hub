import { useListOrders, useListRiders, useAssignOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useState, useRef } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Search, X, UserCheck, ArrowDownNarrowWide, Star, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Returns true if any keyword from the rider's coverage area appears in the order location string
function matchesCoverage(coverageArea: string | null | undefined, orderLocation: string): boolean {
  if (!coverageArea || !orderLocation) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[,\/\-\.]/g, " ");
  const riderKeywords = normalize(coverageArea).split(/\s+/).filter(w => w.length > 2);
  const locationNorm = normalize(orderLocation);
  return riderKeywords.some(kw => locationNorm.includes(kw));
}

// Single-order assign popover (for the Assign button per row)
function AssignButton({
  orderId, stationId, orderLocation, onAssigned,
}: {
  orderId: number;
  stationId?: number | null;
  orderLocation: string;
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string>("");
  const [riderSearch, setRiderSearch] = useState("");
  const { toast } = useToast();

  const { data: riders } = useListRiders({ status: "active" });

  const assignMutation = useAssignOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order assigned", description: "Rider assigned successfully." });
        setOpen(false);
        setSelectedRider("");
        onAssigned();
      },
      onError: () => {
        toast({ title: "Assignment failed", variant: "destructive" });
      },
    },
  });

  // Split riders into suggested (coverage match) and rest, filtered by search
  const searchQ = riderSearch.trim().toLowerCase();
  const { suggested, rest } = (riders ?? []).reduce(
    (acc, r) => {
      if (searchQ && !r.name.toLowerCase().includes(searchQ) && !(r.stationName ?? "").toLowerCase().includes(searchQ)) return acc;
      if (matchesCoverage((r as any).coverageArea, orderLocation)) {
        acc.suggested.push(r);
      } else {
        acc.rest.push(r);
      }
      return acc;
    },
    { suggested: [] as typeof riders, rest: [] as typeof riders }
  );
  const sortedRiders = [...(suggested ?? []), ...(rest ?? [])];
  const suggestedIds = new Set((suggested ?? []).map(r => r.id));

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRiderSearch(""); setSelectedRider(""); } }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <UserCheck className="h-3.5 w-3.5" />
          Assign
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Assign Rider</p>
            {suggested && suggested.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {suggested.length} suggested
              </span>
            )}
          </div>
          {orderLocation && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{orderLocation}</span>
            </div>
          )}
          {/* Integrated search + rider list */}
          <div className="rounded-md border overflow-hidden">
            <div className="relative border-b">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                placeholder="Search rider…"
                value={riderSearch}
                onChange={e => setRiderSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-2 text-sm bg-background outline-none placeholder:text-muted-foreground"
                autoComplete="off"
              />
              {riderSearch && (
                <button
                  onClick={() => setRiderSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto">
              {!sortedRiders.length ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">No riders found</div>
              ) : (
                <>
                  {(suggested ?? []).length > 0 && (
                    <>
                      <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600 flex items-center gap-1 bg-amber-50/60">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> Suggested
                      </div>
                      {(suggested ?? []).map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRider(String(r.id))}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-accent ${selectedRider === String(r.id) ? "bg-primary/10 text-primary font-semibold" : ""}`}
                        >
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                          <span className="font-medium">{r.name}</span>
                          {r.stationName && <span className="text-muted-foreground text-xs ml-auto shrink-0">· {r.stationName}</span>}
                        </button>
                      ))}
                    </>
                  )}
                  {(rest ?? []).length > 0 && (
                    <>
                      {(suggested ?? []).length > 0 && (
                        <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted/40 border-t">
                          Other Riders
                        </div>
                      )}
                      {(rest ?? []).map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRider(String(r.id))}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-accent ${selectedRider === String(r.id) ? "bg-primary/10 text-primary font-semibold" : ""}`}
                        >
                          <span className="font-medium">{r.name}</span>
                          {r.stationName && <span className="text-muted-foreground text-xs ml-auto shrink-0">· {r.stationName}</span>}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1"
              onClick={() => {
                if (!selectedRider) return;
                assignMutation.mutate({ id: orderId, data: { riderId: parseInt(selectedRider, 10) } });
              }}
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
  const [page, setPage] = useState(1);
  const limit = 20;
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkRider, setBulkRider] = useState<string>("");

  const queryParams = {
    status: "new",
    search: activeSearch || undefined,
    page,
    limit,
  };

  const { data, isLoading } = useListOrders(queryParams);
  const { data: allRiders } = useListRiders({});

  const assignMutation = useAssignOrder();

  const orders = [...(data?.orders ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const allPageIds = orders.map((o) => o.id);
  const allChecked = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someChecked = allPageIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...allPageIds]));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSearch = () => { setActiveSearch(searchInput.trim()); setPage(1); };
  const handleClearSearch = () => { setSearchInput(""); setActiveSearch(""); setPage(1); searchRef.current?.focus(); };

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey(queryParams) });
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
  };

  // Bulk assign: call assign for each selected order sequentially
  const [bulkPending, setBulkPending] = useState(false);
  const handleBulkAssign = async () => {
    if (!bulkRider || selectedIds.size === 0) return;
    setBulkPending(true);
    const riderId = parseInt(bulkRider, 10);
    let successCount = 0;
    for (const orderId of selectedIds) {
      try {
        await assignMutation.mutateAsync({ id: orderId, data: { riderId } });
        successCount++;
      } catch {
        // continue with remaining
      }
    }
    setBulkPending(false);
    setSelectedIds(new Set());
    setBulkRider("");
    invalidateList();
    toast({
      title: `${successCount} order${successCount !== 1 ? "s" : ""} assigned`,
      description: successCount < selectedIds.size ? `${selectedIds.size - successCount} failed.` : "All assigned successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Assign Orders</h2>
        <p className="text-muted-foreground">Select one or more new orders and assign a rider.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
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
            {activeSearch && (
              <Button variant="outline" onClick={handleClearSearch} className="shrink-0">Clear</Button>
            )}
          </div>
          {activeSearch && (
            <div className="flex items-center gap-2 text-sm text-primary font-medium pt-1">
              <Search className="h-3.5 w-3.5" />
              Results for <span className="font-semibold">"{activeSearch}"</span>
              <button onClick={handleClearSearch} className="underline text-muted-foreground ml-1">cancel</button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Bulk assign bar — shown when at least 1 order is selected */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <span className="text-sm font-medium text-primary shrink-0">
                {selectedIds.size} order{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex-1" />
              <Select value={bulkRider} onValueChange={setBulkRider}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Choose rider..." />
                </SelectTrigger>
                <SelectContent>
                  {allRiders?.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                      {r.stationName && <span className="text-muted-foreground ml-1 text-xs">· {r.stationName}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkAssign}
                disabled={!bulkRider || bulkPending}
                className="gap-1.5 shrink-0"
              >
                {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Assign All
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                        data-state={someChecked && !allChecked ? "indeterminate" : undefined}
                      />
                    </TableHead>
                    <TableHead>Order Code</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        Date <ArrowDownNarrowWide className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    </TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>COD Amount</TableHead>
                    <TableHead className="text-right">Assign</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!orders.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No unassigned orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow
                        key={order.id}
                        className={selectedIds.has(order.id) ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => toggleOne(order.id)}
                            aria-label={`Select ${order.orderCode}`}
                          />
                        </TableCell>
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
                        <TableCell className="text-right">
                          <AssignButton
                            orderId={order.id}
                            stationId={order.stationId}
                            orderLocation={[order.address, order.city, order.stationName].filter(Boolean).join(" ")}
                            onAssigned={() => {
                              setSelectedIds((prev) => { const n = new Set(prev); n.delete(order.id); return n; });
                              invalidateList();
                            }}
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
            <div className="flex items-center justify-between pt-2">
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
