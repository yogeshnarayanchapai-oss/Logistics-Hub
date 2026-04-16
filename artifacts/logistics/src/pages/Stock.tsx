import { useAuth } from "@/lib/auth";
import { useListStock, useUpdateStockEntry, useDeleteStockEntry, getListStockQueryKey } from "@workspace/api-client-react";
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
import { Loader2, Search, Package, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Stock() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const isVendor = user?.role === "vendor";
  const isAdmin = user?.role === "admin";
  const vendorId = isVendor && user?.vendorId ? user.vendorId : undefined;

  const { data: rawEntries, isLoading } = useListStock({
    search: search || undefined,
    vendorId,
  });

  const stockEntries = useMemo(() => {
    if (!rawEntries) return [];
    if (stockFilter === "low") return rawEntries.filter((e) => e.currentStock > 0 && e.currentStock <= 10);
    if (stockFilter === "out") return rawEntries.filter((e) => e.currentStock <= 0);
    if (stockFilter === "instock") return rawEntries.filter((e) => e.currentStock > 10);
    return rawEntries.filter((e) => e.currentStock >= 0);
  }, [rawEntries, stockFilter]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStockQueryKey() });

  const updateMutation = useUpdateStockEntry({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Stock updated successfully" }); setIsDialogOpen(false); }
    }
  });

  const deleteMutation = useDeleteStockEntry({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Stock entry deleted" }); setDeleteTarget(null); },
      onError: () => { toast({ title: "Delete failed", variant: "destructive" }); setDeleteTarget(null); }
    }
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      receivedStock: Number(formData.get("receivedStock")),
      damagedStock: Number(formData.get("damagedStock")),
      note: formData.get("note") as string || null
    };
    updateMutation.mutate({ id: editingStock.id, data });
  };

  const getStockLevel = (current: number) => {
    if (current <= 0) return { label: "Out", class: "bg-red-100 text-red-700" };
    if (current <= 10) return { label: "Low", class: "bg-orange-100 text-orange-700" };
    return { label: "OK", class: "bg-green-100 text-green-700" };
  };

  const colSpan = isVendor ? 7 : 9;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Inventory</h2>
          <p className="text-muted-foreground">Monitor inventory levels by vendor and product.</p>
        </div>
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
              <SelectTrigger className="w-[150px]">
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
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Damaged</TableHead>
                    <TableHead className="text-right font-bold text-primary">Current</TableHead>
                    {!isVendor && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!stockEntries.length ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">No inventory records found.</TableCell>
                    </TableRow>
                  ) : (
                    stockEntries.map((entry) => {
                      const level = getStockLevel(entry.currentStock);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="font-medium flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {entry.productName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {entry.productSku && <span className="text-xs text-muted-foreground">SKU: {entry.productSku}</span>}
                              <Badge variant="outline" className={`text-xs px-1.5 py-0 ${level.class}`}>{level.label}</Badge>
                            </div>
                          </TableCell>
                          {!isVendor && <TableCell>{entry.vendorName}</TableCell>}
                          <TableCell className="text-right text-muted-foreground">{entry.openingStock}</TableCell>
                          <TableCell className="text-right text-blue-600">+{entry.receivedStock}</TableCell>
                          <TableCell className="text-right text-green-600">-{entry.deliveredStock}</TableCell>
                          <TableCell className="text-right text-orange-600">+{entry.returnedStock}</TableCell>
                          <TableCell className="text-right text-red-600">-{entry.damagedStock}</TableCell>
                          <TableCell className="text-right font-bold text-primary">{entry.currentStock}</TableCell>
                          {!isVendor && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => { setEditingStock(entry); setIsDialogOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5 mr-1" /> Adjust
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteTarget({ id: entry.id, name: entry.productName })}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
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

      {/* Adjust Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Adjust Inventory</DialogTitle>
              <DialogDescription>
                Update stock counts for {editingStock?.productName} ({editingStock?.vendorName})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receivedStock">Add Received</Label>
                  <Input id="receivedStock" name="receivedStock" type="number" defaultValue="0" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="damagedStock">Add Damaged/Lost</Label>
                  <Input id="damagedStock" name="damagedStock" type="number" defaultValue="0" min="0" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Adjustment Note</Label>
                <Input id="note" name="note" placeholder="Reason for adjustment..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Stock
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
