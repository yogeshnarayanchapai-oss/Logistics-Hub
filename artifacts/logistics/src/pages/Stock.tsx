import { useAuth } from "@/lib/auth";
import { useListStock, useCreateStockEntry, useUpdateStockEntry, useDeleteStockEntry, useListVendors, useListRiders, getListStockQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Package, Plus, Trash2, MoreHorizontal, ArrowDownToLine, ArrowUpFromLine, UserCheck, UserMinus, Undo2, Truck, History, ArrowDown, ArrowUp, Filter } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

type DialogMode = "add-product" | "stock-in" | "stock-out" | "assign-inventory" | "return-inventory" | null;

export default function Stock() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const isVendor = user?.role === "vendor";
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canManage = isAdmin || isManager || isVendor;
  const vendorId = isVendor && user?.vendorId ? user.vendorId : undefined;

  const { data: rawEntries, isLoading } = useListStock({
    search: search || undefined,
    vendorId,
  });

  const { data: vendors } = useListVendors({ status: "active" });

  const stockEntries = useMemo(() => {
    if (!rawEntries) return [];
    if (stockFilter === "low") return rawEntries.filter((e) => e.currentStock > 0 && e.currentStock <= 10);
    if (stockFilter === "out") return rawEntries.filter((e) => e.currentStock <= 0);
    if (stockFilter === "instock") return rawEntries.filter((e) => e.currentStock > 10);
    return rawEntries.filter((e) => e.currentStock >= 0);
  }, [rawEntries, stockFilter]);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  // Rider inventory state
  const [riderInventories, setRiderInventories] = useState<any[]>([]);
  const [riderInvLoading, setRiderInvLoading] = useState(false);
  const [assignPending, setAssignPending] = useState(false);
  const [returnPending, setReturnPending] = useState(false);
  const [returnEntry, setReturnEntry] = useState<any>(null);

  // Assign/Deassign combined dialog
  const [assignDialogTab, setAssignDialogTab] = useState<"assign" | "deassign">("assign");
  const [deassignRiderId, setDeassignRiderId] = useState<string>("");
  const [deassignEntryId, setDeassignEntryId] = useState<string>("");
  const [deassignQty, setDeassignQty] = useState<string>("");

  const { data: riders } = useListRiders({ status: "active" });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const authToken = () => localStorage.getItem("authToken");

  // ── Movements tab state ──
  const today = new Date().toISOString().split("T")[0];
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [mvDateFrom, setMvDateFrom] = useState(today);
  const [mvDateTo, setMvDateTo] = useState(today);
  const [mvType, setMvType] = useState("all");
  const [mvVendorId, setMvVendorId] = useState("all");
  const [activeTab, setActiveTab] = useState("inventory");

  const fetchMovements = useCallback(() => {
    setMovementsLoading(true);
    const params = new URLSearchParams();
    if (mvDateFrom) params.set("dateFrom", mvDateFrom);
    if (mvDateTo) params.set("dateTo", mvDateTo);
    if (mvType !== "all") params.set("movementType", mvType);
    if (mvVendorId !== "all" && !isVendor) params.set("vendorId", mvVendorId);
    if (isVendor && user?.vendorId) params.set("vendorId", String(user.vendorId));
    fetch(`${BASE}/api/stock-movements?${params}`, { headers: { Authorization: `Bearer ${authToken()}` } })
      .then(r => r.json()).then(d => setMovements(Array.isArray(d) ? d : []))
      .catch(() => setMovements([]))
      .finally(() => setMovementsLoading(false));
  }, [mvDateFrom, mvDateTo, mvType, mvVendorId, isVendor]);

  useEffect(() => {
    if (activeTab === "movements") fetchMovements();
  }, [activeTab, fetchMovements]);

  const mvTypeLabel: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    vendor_in:    { label: "Vendor In",     color: "bg-blue-50 text-blue-700 border-blue-200",   icon: <ArrowDown className="h-3 w-3 mr-1 text-blue-600" /> },
    stock_out:    { label: "Out / Damaged", color: "bg-red-50 text-red-700 border-red-200",      icon: <ArrowUp className="h-3 w-3 mr-1 text-red-600" /> },
    rider_assign: { label: "Rider Out",     color: "bg-amber-50 text-amber-700 border-amber-200", icon: <Truck className="h-3 w-3 mr-1 text-amber-600" /> },
    rider_return: { label: "Rider Return",  color: "bg-green-50 text-green-700 border-green-200", icon: <Undo2 className="h-3 w-3 mr-1 text-green-600" /> },
  };

  const fetchRiderInventories = useCallback(() => {
    if (!canManage || isVendor) return;
    setRiderInvLoading(true);
    fetch(`${BASE}/api/rider-inventory`, { headers: { Authorization: `Bearer ${authToken()}` } })
      .then(r => r.json()).then(d => setRiderInventories(Array.isArray(d) ? d : []))
      .catch(() => setRiderInventories([]))
      .finally(() => setRiderInvLoading(false));
  }, [canManage, isVendor]);

  useEffect(() => { fetchRiderInventories(); }, [fetchRiderInventories]);

  const handleAssignInventory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const riderId = fd.get("riderId") as string;
    const stockId = fd.get("stockId") as string;
    const qty = fd.get("qty") as string;
    const note = fd.get("note") as string;
    if (!riderId || !stockId || !qty || Number(qty) <= 0) {
      toast({ title: "Fill all fields with a valid quantity", variant: "destructive" }); return;
    }
    setAssignPending(true);
    try {
      const res = await fetch(`${BASE}/api/rider-inventory/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
        body: JSON.stringify({ riderId, stockId, qty: Number(qty), note }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: "Inventory assigned to rider" });
      setDialogMode(null);
      fetchRiderInventories();
    } catch (err: any) {
      toast({ title: err.message || "Assignment failed", variant: "destructive" });
    } finally { setAssignPending(false); }
  };

  const handleReturnInventory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qty = fd.get("qty") as string;
    if (!returnEntry || !qty || Number(qty) <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" }); return;
    }
    setReturnPending(true);
    try {
      const res = await fetch(`${BASE}/api/rider-inventory/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
        body: JSON.stringify({ entryId: returnEntry.id, qty: Number(qty) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: "Inventory returned from rider" });
      setDialogMode(null);
      setReturnEntry(null);
      fetchRiderInventories();
    } catch (err: any) {
      toast({ title: err.message || "Return failed", variant: "destructive" });
    } finally { setReturnPending(false); }
  };

  const handleDeassign = async () => {
    if (!deassignEntryId || !deassignQty || Number(deassignQty) <= 0) {
      toast({ title: "Select a product and enter a valid quantity", variant: "destructive" }); return;
    }
    setReturnPending(true);
    try {
      const res = await fetch(`${BASE}/api/rider-inventory/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
        body: JSON.stringify({ entryId: Number(deassignEntryId), qty: Number(deassignQty) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: "Inventory deassigned — stock returned to office" });
      setDialogMode(null);
      setDeassignRiderId("");
      setDeassignEntryId("");
      setDeassignQty("");
      fetchRiderInventories();
      queryClient.invalidateQueries({ queryKey: getListStockQueryKey() });
    } catch (err: any) {
      toast({ title: err.message || "Deassign failed", variant: "destructive" });
    } finally { setReturnPending(false); }
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStockQueryKey() });

  const createMutation = useCreateStockEntry({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Product added to inventory" }); setDialogMode(null); }
    }
  });

  const updateMutation = useUpdateStockEntry({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Stock updated successfully" }); setDialogMode(null); }
    }
  });

  const deleteMutation = useDeleteStockEntry({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Stock entry deleted" }); setDeleteTarget(null); },
      onError: () => { toast({ title: "Delete failed", variant: "destructive" }); setDeleteTarget(null); }
    }
  });

  const handleAddProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      data: {
        vendorId: isVendor ? (user?.vendorId ?? 0) : Number(fd.get("vendorId")),
        productName: fd.get("productName") as string,
        productSku: fd.get("productSku") as string || null,
        openingStock: Number(fd.get("openingStock")) || 0,
      }
    });
  };

  const handleStockMovement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qty = Number(fd.get("qty"));
    if (!qty || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: activeEntry.id,
      data: {
        type: dialogMode === "stock-in" ? "in" : "out",
        qty,
      }
    });
  };

  const getStockLevel = (current: number) => {
    if (current <= 0) return { label: "Out of Stock", class: "bg-red-100 text-red-700" };
    if (current <= 10) return { label: "Low Stock", class: "bg-orange-100 text-orange-700" };
    return { label: "In Stock", class: "bg-green-100 text-green-700" };
  };

  const colSpan = isVendor ? 7 : 8;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Inventory</h2>
          <p className="text-muted-foreground">Monitor inventory levels by vendor and product.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setAssignDialogTab("assign"); setDeassignRiderId(""); setDeassignEntryId(""); setDeassignQty(""); setDialogMode("assign-inventory"); }}>
              <UserCheck className="mr-2 h-4 w-4" /> Assign / Deassign
            </Button>
            <Button onClick={() => { setActiveEntry(null); setDialogMode("add-product"); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory"><Package className="mr-1.5 h-4 w-4" /> Inventory</TabsTrigger>
          {canManage && !isVendor && (
            <TabsTrigger value="rider-inventory"><Truck className="mr-1.5 h-4 w-4" /> Rider Inventory</TabsTrigger>
          )}
          <TabsTrigger value="movements"><History className="mr-1.5 h-4 w-4" /> Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Stock level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (excl. negative)</SelectItem>
                <SelectItem value="instock">In Stock (&gt;10)</SelectItem>
                <SelectItem value="low">Low Stock (1–10)</SelectItem>
                <SelectItem value="out">Out of Stock (0)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    {!isVendor && <TableHead>Vendor</TableHead>}
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right text-blue-600">In (+)</TableHead>
                    <TableHead className="text-right text-green-600">Delivered (−)</TableHead>
                    <TableHead className="text-right text-orange-600">Returned (+)</TableHead>
                    <TableHead className="text-right text-red-600">Out/Dmg (−)</TableHead>
                    <TableHead className="text-right font-bold text-primary">Current</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!stockEntries.length ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                        <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>No inventory records found.</p>
                        {canManage && (
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setActiveEntry(null); setDialogMode("add-product"); }}>
                            <Plus className="mr-2 h-3.5 w-3.5" /> Add First Product
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockEntries.map((entry) => {
                      const level = getStockLevel(entry.currentStock);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="font-medium flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              {entry.productName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {entry.productSku && <span className="text-xs text-muted-foreground font-mono">SKU: {entry.productSku}</span>}
                              <Badge variant="outline" className={`text-xs px-1.5 py-0 ${level.class}`}>{level.label}</Badge>
                            </div>
                          </TableCell>
                          {!isVendor && <TableCell className="text-sm">{entry.vendorName}</TableCell>}
                          <TableCell className="text-right text-muted-foreground">{entry.openingStock}</TableCell>
                          <TableCell className="text-right text-blue-600 font-medium">+{entry.receivedStock}</TableCell>
                          <TableCell className="text-right text-green-600">−{entry.deliveredStock}</TableCell>
                          <TableCell className="text-right text-orange-600">+{entry.returnedStock}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">−{entry.damagedStock}</TableCell>
                          <TableCell className="text-right font-bold text-lg text-primary">{entry.currentStock}</TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="cursor-pointer text-blue-700 focus:text-blue-800 focus:bg-blue-50"
                                    onClick={() => { setActiveEntry(entry); setDialogMode("stock-in"); }}
                                  >
                                    <ArrowDownToLine className="mr-2 h-4 w-4" /> Stock In
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                                    onClick={() => { setActiveEntry(entry); setDialogMode("stock-out"); }}
                                  >
                                    <ArrowUpFromLine className="mr-2 h-4 w-4" /> Stock Out
                                  </DropdownMenuItem>
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="cursor-pointer text-destructive focus:text-destructive"
                                        onClick={() => setDeleteTarget({ id: entry.id, name: entry.productName })}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* ── Movements Log Tab ── */}
        <TabsContent value="movements" className="mt-4 space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={mvDateFrom} onChange={e => setMvDateFrom(e.target.value)} className="w-[150px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={mvDateTo} onChange={e => setMvDateTo(e.target.value)} className="w-[150px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={mvType} onValueChange={setMvType}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="vendor_in">Vendor In</SelectItem>
                      <SelectItem value="stock_out">Out / Damaged</SelectItem>
                      <SelectItem value="rider_assign">Rider Out</SelectItem>
                      <SelectItem value="rider_return">Rider Return</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!isVendor && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Vendor</Label>
                    <Select value={mvVendorId} onValueChange={setMvVendorId}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Vendors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {vendors?.map(v => (
                          <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={fetchMovements} disabled={movementsLoading} className="ml-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  {movementsLoading ? "Loading..." : "Apply Filter"}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Movements Summary Badges */}
          {!movementsLoading && movements.length > 0 && (() => {
            const totals = movements.reduce((acc, m) => {
              acc[m.movementType] = (acc[m.movementType] ?? 0) + m.qty;
              return acc;
            }, {} as Record<string, number>);
            return (
              <div className="flex flex-wrap gap-2">
                {Object.entries(mvTypeLabel).map(([type, meta]) => totals[type] ? (
                  <Badge key={type} variant="outline" className={`${meta.color} flex items-center gap-1 px-3 py-1 text-sm`}>
                    {meta.icon} {meta.label}: <strong className="ml-1">{totals[type]}</strong> units
                  </Badge>
                ) : null)}
              </div>
            );
          })()}

          {/* Movements Table */}
          <Card>
            <CardContent className="p-0">
              {movementsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                  <History className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">No movements found for the selected filters.</p>
                  <p className="text-xs mt-1">Try widening the date range or changing filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Product</TableHead>
                        {!isVendor && <TableHead>Vendor</TableHead>}
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Rider</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map(m => {
                        const meta = mvTypeLabel[m.movementType];
                        const isIn = m.movementType === "vendor_in" || m.movementType === "rider_return";
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(m.createdAt), "MMM d, yyyy")}
                              <div className="text-xs">{format(new Date(m.createdAt), "h:mm a")}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{m.productName}</div>
                            </TableCell>
                            {!isVendor && <TableCell className="text-sm text-muted-foreground">{m.vendorName}</TableCell>}
                            <TableCell>
                              <Badge variant="outline" className={`flex items-center w-fit text-xs px-2 py-0.5 ${meta?.color ?? ""}`}>
                                {meta?.icon}
                                {meta?.label ?? m.movementType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              <span className={isIn ? "text-green-700" : "text-red-600"}>
                                {isIn ? "+" : "−"}{m.qty}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{m.riderName ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.note ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.performedByName ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && !isVendor && (
          <TabsContent value="rider-inventory" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {riderInvLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : riderInventories.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mb-2 opacity-20" />
                    <p>No inventory has been assigned to riders yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rider</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Assigned</TableHead>
                          <TableHead className="text-center">Delivered</TableHead>
                          <TableHead className="text-center">Returned</TableHead>
                          <TableHead className="text-center">In Hand</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {riderInventories.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                  {(entry.riderName || "R").charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-sm">{entry.riderName || `Rider #${entry.riderId}`}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{entry.productName}</div>
                              {entry.productSku && <div className="text-xs text-muted-foreground">SKU: {entry.productSku}</div>}
                            </TableCell>
                            <TableCell className="text-center">{entry.assignedQty}</TableCell>
                            <TableCell className="text-center text-green-700 font-medium">{entry.deliveredQty}</TableCell>
                            <TableCell className="text-center text-orange-600 font-medium">{entry.returnedQty}</TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold ${entry.currentQty > 0 ? "text-blue-700" : "text-muted-foreground"}`}>
                                {entry.currentQty}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {entry.currentQty > 0 && (
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => { setReturnEntry(entry); setDialogMode("return-inventory"); }}
                                >
                                  <Undo2 className="mr-1 h-3.5 w-3.5" /> Return
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add Product Dialog */}
      <Dialog open={dialogMode === "add-product"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleAddProduct}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Add Product to Inventory
              </DialogTitle>
              <DialogDescription>
                Create a new inventory record for a product.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!isVendor && (
                <div className="space-y-2">
                  <Label htmlFor="vendorId">Vendor *</Label>
                  <select
                    id="vendorId" name="vendorId" required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select a vendor...</option>
                    {vendors?.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.vendorCode})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="productName">Product Name *</Label>
                  <Input id="productName" name="productName" placeholder="e.g. Red Shoes" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productSku">SKU / Code</Label>
                  <Input id="productSku" name="productSku" placeholder="e.g. SKU-001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openingStock">Opening Stock</Label>
                  <Input id="openingStock" name="openingStock" type="number" min="0" defaultValue="0" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock In Dialog */}
      <Dialog open={dialogMode === "stock-in"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <form onSubmit={handleStockMovement}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-700">
                <ArrowDownToLine className="h-5 w-5" />
                Stock In — Receive Inventory
              </DialogTitle>
              <DialogDescription>
                <span className="font-semibold text-foreground">{activeEntry?.productName}</span>
                {activeEntry?.productSku && <span className="text-muted-foreground ml-1">(SKU: {activeEntry.productSku})</span>}
                <br />
                Current stock: <strong>{activeEntry?.currentStock}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity Received *</Label>
                <Input id="qty" name="qty" type="number" min="1" placeholder="e.g. 50" required autoFocus />
              </div>
              <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-700">
                This will add to the <strong>received stock</strong> counter and increase the current stock.
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Stock In
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Out Dialog */}
      <Dialog open={dialogMode === "stock-out"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <form onSubmit={handleStockMovement}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <ArrowUpFromLine className="h-5 w-5" />
                Stock Out — Remove / Write-off
              </DialogTitle>
              <DialogDescription>
                <span className="font-semibold text-foreground">{activeEntry?.productName}</span>
                {activeEntry?.productSku && <span className="text-muted-foreground ml-1">(SKU: {activeEntry.productSku})</span>}
                <br />
                Current stock: <strong>{activeEntry?.currentStock}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity to Remove *</Label>
                <Input id="qty" name="qty" type="number" min="1" placeholder="e.g. 5" required autoFocus />
              </div>
              <div className="rounded-md bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                This will add to the <strong>damaged / written-off</strong> counter and reduce the current stock.
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Stock Out
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* Assign / Deassign Inventory Dialog */}
      <Dialog open={dialogMode === "assign-inventory"} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {assignDialogTab === "assign"
                ? <><UserCheck className="h-5 w-5 text-primary" /> Assign Inventory to Rider</>
                : <><UserMinus className="h-5 w-5 text-orange-600" /> Deassign Inventory from Rider</>}
            </DialogTitle>
            <DialogDescription>
              {assignDialogTab === "assign"
                ? "Send stock from the office warehouse to a rider."
                : "Return stock from a rider back to the office warehouse."}
            </DialogDescription>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex rounded-lg border border-input overflow-hidden mb-1">
            <button
              type="button"
              onClick={() => setAssignDialogTab("assign")}
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${assignDialogTab === "assign" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <UserCheck className="h-3.5 w-3.5" /> Assign
            </button>
            <button
              type="button"
              onClick={() => setAssignDialogTab("deassign")}
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${assignDialogTab === "deassign" ? "bg-orange-600 text-white" : "hover:bg-muted text-muted-foreground"}`}
            >
              <UserMinus className="h-3.5 w-3.5" /> Deassign
            </button>
          </div>

          {assignDialogTab === "assign" ? (
            <form onSubmit={handleAssignInventory}>
              <div className="grid gap-4 py-3">
                <div className="space-y-2">
                  <Label htmlFor="riderId">Rider *</Label>
                  <select name="riderId" id="riderId" required
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">— Select rider —</option>
                    {(riders ?? []).map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockId">Product *</Label>
                  <select name="stockId" id="stockId" required
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">— Select product —</option>
                    {(rawEntries ?? []).filter(e => e.currentStock > 0).map((e: any) => (
                      <option key={e.id} value={e.id}>{e.productName} {e.productSku ? `(${e.productSku})` : ""} — {e.currentStock} in stock</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qty">Quantity *</Label>
                  <Input id="qty" name="qty" type="number" min="1" placeholder="e.g. 20" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note (optional)</Label>
                  <Input id="note" name="note" placeholder="e.g. For Kathmandu route" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
                <Button type="submit" disabled={assignPending}>
                  {assignPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div>
              <div className="grid gap-4 py-3">
                <div className="space-y-2">
                  <Label>Rider *</Label>
                  <select
                    value={deassignRiderId}
                    onChange={(e) => { setDeassignRiderId(e.target.value); setDeassignEntryId(""); setDeassignQty(""); }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— Select rider —</option>
                    {Array.from(new Map(riderInventories.filter(e => e.currentQty > 0).map(e => [e.riderId, e])).values()).map((e: any) => (
                      <option key={e.riderId} value={e.riderId}>{e.riderName}</option>
                    ))}
                  </select>
                </div>

                {deassignRiderId && (
                  <>
                    <div className="space-y-2">
                      <Label>Product *</Label>
                      <select
                        value={deassignEntryId}
                        onChange={(e) => { setDeassignEntryId(e.target.value); setDeassignQty(""); }}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">— Select product —</option>
                        {riderInventories.filter(e => String(e.riderId) === deassignRiderId && e.currentQty > 0).map((e: any) => (
                          <option key={e.id} value={e.id}>{e.productName}{e.productSku ? ` (${e.productSku})` : ""} — {e.currentQty} in hand</option>
                        ))}
                      </select>
                    </div>
                    {deassignEntryId && (
                      <div className="space-y-2">
                        <Label>
                          Quantity to Return *
                          {(() => {
                            const entry = riderInventories.find(e => String(e.id) === deassignEntryId);
                            return entry ? <span className="text-muted-foreground font-normal"> (max {entry.currentQty})</span> : null;
                          })()}
                        </Label>
                        <Input
                          type="number" min="1"
                          max={riderInventories.find(e => String(e.id) === deassignEntryId)?.currentQty ?? 9999}
                          placeholder="e.g. 5"
                          value={deassignQty}
                          onChange={(e) => setDeassignQty(e.target.value)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>Cancel</Button>
                <Button
                  type="button"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={returnPending || !deassignEntryId || !deassignQty || Number(deassignQty) <= 0}
                  onClick={handleDeassign}
                >
                  {returnPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Deassign
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Inventory Dialog */}
      <Dialog open={dialogMode === "return-inventory"} onOpenChange={(open) => { if (!open) { setDialogMode(null); setReturnEntry(null); } }}>
        <DialogContent className="sm:max-w-[380px]">
          <form onSubmit={handleReturnInventory}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <Undo2 className="h-5 w-5" /> Return Inventory
              </DialogTitle>
              <DialogDescription>
                Rider: <strong>{returnEntry?.riderName}</strong><br />
                Product: <strong>{returnEntry?.productName}</strong><br />
                Currently in hand: <strong>{returnEntry?.currentQty}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity to Return *</Label>
                <Input id="qty" name="qty" type="number" min="1" max={returnEntry?.currentQty ?? 9999} placeholder="e.g. 5" required autoFocus />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogMode(null); setReturnEntry(null); }}>Cancel</Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={returnPending}>
                {returnPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Return
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the inventory record for <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
