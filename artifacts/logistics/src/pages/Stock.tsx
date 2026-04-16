import { useAuth } from "@/lib/auth";
import { useListStock, useUpdateStockEntry, getListStockQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Stock() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const isVendor = user?.role === "vendor";
  const vendorId = isVendor && user?.vendorId ? user.vendorId : undefined;
  
  const { data: stockEntries, isLoading } = useListStock({ 
    search: search || undefined,
    vendorId: vendorId
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useUpdateStockEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStockQueryKey() });
        toast({ title: "Stock updated successfully" });
        setIsDialogOpen(false);
      }
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

  const openEditDialog = (stock: any) => {
    setEditingStock(stock);
    setIsDialogOpen(true);
  };

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
          <div className="flex w-full md:w-1/3 items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
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
                  {stockEntries?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isVendor ? 7 : 9} className="text-center py-8 text-muted-foreground">No inventory records found.</TableCell>
                    </TableRow>
                  ) : (
                    stockEntries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {entry.productName}
                          </div>
                          {entry.productSku && <div className="text-xs text-muted-foreground">SKU: {entry.productSku}</div>}
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
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(entry)}>Adjust</Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
