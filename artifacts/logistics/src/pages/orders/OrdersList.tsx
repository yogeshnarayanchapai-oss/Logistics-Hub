import { useListOrders, useDeleteOrder, useAssignOrder, useListRiders, useAddOrderComment, getListOrdersQueryKey, getListOrderCommentsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useRolePrefix } from "@/lib/use-role-prefix";
import { useState, useRef, useMemo } from "react";
import { Link } from "wouter";
import { format, subDays, startOfDay } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Plus, Search, X, Pencil, Trash2, MoreHorizontal, Eye, UserCheck, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
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

export default function OrdersList() {
  const { user } = useAuth();
  const prefix = useRolePrefix();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const searchRef = useRef<HTMLInputElement>(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; code: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Quick comment (rider)
  const [commentTarget, setCommentTarget] = useState<{ id: number; code: string } | null>(null);
  const [commentText, setCommentText] = useState("");
  const commentMutation = useAddOrderComment({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getListOrderCommentsQueryKey(variables.id) });
        toast({ title: "Comment added" });
        setCommentTarget(null);
        setCommentText("");
      },
      onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
    },
  });

  // Quick reassign
  const [reassignTarget, setReassignTarget] = useState<{ id: number; code: string; riderName?: string | null } | null>(null);
  const [reassignRiderId, setReassignRiderId] = useState<string>("");
  const { data: allRiders } = useListRiders({ status: "active" });
  const assignMutation = useAssignOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Rider reassigned successfully" });
        setReassignTarget(null);
        setReassignRiderId("");
        invalidateOrders();
      },
      onError: () => toast({ title: "Reassignment failed", variant: "destructive" }),
    },
  });

  const isSearchMode = activeSearch.length > 0;

  const { dateFrom, dateTo } = useMemo(
    () => isSearchMode ? { dateFrom: undefined, dateTo: undefined } : getDateRange(datePreset, customFrom, customTo),
    [isSearchMode, datePreset, customFrom, customTo]
  );

  const isRider = user?.role === "rider";

  const queryParams = {
    search: activeSearch || undefined,
    status: (!isSearchMode && statusFilter !== "all") ? statusFilter : undefined,
    riderId: isRider && user?.riderId ? user.riderId : undefined,
    dateFrom,
    dateTo,
    page,
    limit,
  };

  const { data, isLoading } = useListOrders(queryParams);
  const deleteMutation = useDeleteOrder();

  const orders = data?.orders ?? [];
  const allPageIds = orders.map((o) => o.id);
  const allChecked = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someChecked = allPageIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds((prev) => { const n = new Set(prev); allPageIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...allPageIds]));
    }
  };
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSearch = () => { setActiveSearch(searchInput.trim()); setPage(1); };
  const handleClearSearch = () => { setSearchInput(""); setActiveSearch(""); setPage(1); searchRef.current?.focus(); };
  const handleFilterChange = () => setPage(1);

  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  };

  // Single delete
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        toast({ title: "Order deleted", description: `${deleteTarget.code} has been deleted.` });
        setDeleteTarget(null);
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
        invalidateOrders();
      },
      onError: () => {
        toast({ title: "Delete failed", variant: "destructive" });
        setDeleteTarget(null);
      },
    });
  };

  // Bulk delete
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const handleBulkDeleteConfirm = async () => {
    setBulkDeletePending(true);
    let success = 0;
    for (const id of selectedIds) {
      try { await deleteMutation.mutateAsync({ id }); success++; } catch { /* continue */ }
    }
    setBulkDeletePending(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    invalidateOrders();
    toast({ title: `${success} order${success !== 1 ? "s" : ""} deleted` });
  };

  const canEdit = ["admin", "manager"].includes(user?.role || "");
  const canDelete = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{isRider ? "My Deliveries" : "Orders"}</h2>
          <p className="text-muted-foreground">
            {isRider ? "Orders assigned to you for delivery." : "Manage and track all deliveries."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["admin", "manager", "vendor"].includes(user?.role || "") && (
            <>
              <Link href={`${prefix}/orders/bulk`}>
                <Button variant="outline">Bulk Import</Button>
              </Link>
              <Link href={`${prefix}/orders/new`}>
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

            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); handleFilterChange(); }} className="w-[145px]" />
                <span className="text-muted-foreground text-sm">to</span>
                <Input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); handleFilterChange(); }} className="w-[145px]" min={customFrom} />
              </div>
            )}

            {(statusFilter !== "all" || datePreset !== "today") && (
              <Button variant="ghost" size="sm" className="text-muted-foreground h-9 px-2"
                onClick={() => { setStatusFilter("all"); setDatePreset("today"); setCustomFrom(""); setCustomTo(""); handleFilterChange(); }}>
                <X className="mr-1 h-3 w-3" /> Reset filters
              </Button>
            )}
          </div>

          {isSearchMode && (
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <Search className="h-3.5 w-3.5" />
              Showing results for <span className="font-semibold">"{activeSearch}"</span> across all orders
              <button onClick={handleClearSearch} className="underline text-muted-foreground ml-1">cancel</button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <span className="text-sm font-medium text-destructive shrink-0">
                {selectedIds.size} order{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex-1" />
              {canDelete && (
                <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete Selected
                </Button>
              )}
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
                    {canDelete && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                          data-state={someChecked && !allChecked ? "indeterminate" : undefined}
                        />
                      </TableHead>
                    )}
                    <TableHead>Order Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>COD Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!orders.length ? (
                    <TableRow>
                      <TableCell colSpan={canDelete ? 9 : 8} className="text-center py-12 text-muted-foreground">
                        No orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id} className={selectedIds.has(order.id) ? "bg-red-50" : ""}>
                        {canDelete && (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => toggleOne(order.id)}
                              aria-label={`Select ${order.orderCode}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">
                          <Link href={`${prefix}/orders/${order.id}`} className="text-primary hover:underline">
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
                          {canEdit && order.status === "assigned" ? (
                            <span
                              title="Double-click to reassign rider"
                              onDoubleClick={() => {
                                setReassignTarget({ id: order.id, code: order.orderCode, riderName: order.riderName });
                                setReassignRiderId("");
                              }}
                              className="cursor-pointer select-none"
                            >
                              <StatusBadge status={order.status} className="ring-1 ring-offset-1 ring-primary/30 hover:ring-primary/60 transition-shadow" />
                            </span>
                          ) : (
                            <StatusBadge status={order.status} />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.riderName
                            ? <span className="font-medium">{order.riderName}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isRider ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                title="Add comment"
                                onClick={() => { setCommentTarget({ id: order.id, code: order.orderCode }); setCommentText(""); }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <Link href={`${prefix}/orders/${order.id}`}>
                                    <DropdownMenuItem className="cursor-pointer">
                                      <Eye className="mr-2 h-4 w-4" /> View
                                    </DropdownMenuItem>
                                  </Link>
                                  {canEdit && (
                                    <Link href={`${prefix}/orders/${order.id}/edit`}>
                                      <DropdownMenuItem className="cursor-pointer">
                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                      </DropdownMenuItem>
                                    </Link>
                                  )}
                                  <DropdownMenuItem
                                    className="cursor-pointer text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                                    onClick={() => { setCommentTarget({ id: order.id, code: order.orderCode }); setCommentText(""); }}
                                  >
                                    <MessageSquare className="mr-2 h-4 w-4" /> Add Comment
                                  </DropdownMenuItem>
                                  {canDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="cursor-pointer text-destructive focus:text-destructive"
                                        onClick={() => setDeleteTarget({ id: order.id, code: order.orderCode })}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
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

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.code}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{selectedIds.size} selected order{selectedIds.size !== 1 ? "s" : ""}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteConfirm} className="bg-destructive hover:bg-destructive/90" disabled={bulkDeletePending}>
              {bulkDeletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Delete ${selectedIds.size} Orders`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Reassign Dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={(open) => { if (!open) { setReassignTarget(null); setReassignRiderId(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Reassign Rider
            </DialogTitle>
            <DialogDescription>
              Order <strong>{reassignTarget?.code}</strong>
              {reassignTarget?.riderName && (
                <> — currently assigned to <strong>{reassignTarget.riderName}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={reassignRiderId} onValueChange={setReassignRiderId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a rider..." />
              </SelectTrigger>
              <SelectContent>
                {!allRiders?.length ? (
                  <SelectItem value="none" disabled>No active riders</SelectItem>
                ) : (
                  allRiders.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                      {r.stationName && <span className="text-muted-foreground ml-1">({r.stationName})</span>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReassignTarget(null); setReassignRiderId(""); }}>Cancel</Button>
            <Button
              disabled={!reassignRiderId || assignMutation.isPending}
              onClick={() => {
                if (!reassignTarget || !reassignRiderId) return;
                assignMutation.mutate({ id: reassignTarget.id, data: { riderId: Number(reassignRiderId) } });
              }}
            >
              {assignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Comment Dialog */}
      <Dialog open={!!commentTarget} onOpenChange={(open) => { if (!open) { setCommentTarget(null); setCommentText(""); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Add Comment
            </DialogTitle>
            <DialogDescription>
              Order <strong>{commentTarget?.code}</strong> — your comment will be visible to the office team.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <Label htmlFor="quick-comment">Comment</Label>
            <Textarea
              id="quick-comment"
              rows={4}
              placeholder="e.g. Customer was not available, tried 2 times..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCommentTarget(null); setCommentText(""); }}>Cancel</Button>
            <Button
              disabled={!commentText.trim() || commentMutation.isPending}
              onClick={() => {
                if (!commentTarget || !commentText.trim()) return;
                commentMutation.mutate({ id: commentTarget.id, data: { content: commentText.trim() } });
              }}
            >
              {commentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
              Submit Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
