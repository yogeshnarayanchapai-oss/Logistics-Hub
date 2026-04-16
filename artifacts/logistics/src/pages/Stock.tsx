import { useAuth } from "@/lib/auth";
import { useListStock, useCreateStockEntry, useUpdateStockEntry, useDeleteStockEntry, useListVendors, getListStockQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Package, Plus, Trash2, MoreHorizontal, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type DialogMode = "add-product" | "stock-in" | "stock-out" | null;

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

  const queryClient = useQueryClient();
  const { toast } = useToast();

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
          <Button onClick={() => { setActiveEntry(null); setDialogMode("add-product"); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        )}
      </div>

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
