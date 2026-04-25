import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, PackageCheck, PackageOpen, RefreshCw } from "lucide-react";

export default function RiderInventory() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const token = () => localStorage.getItem("authToken");

  const fetchInventory = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}/api/rider-inventory`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [BASE]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  // Re-fetch when tab becomes visible (e.g. returning from admin Stock page)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchInventory(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchInventory]);

  const totalAssigned = entries.reduce((s, e) => s + e.assignedQty, 0);
  const totalDelivered = entries.reduce((s, e) => s + e.deliveredQty, 0);
  const totalCurrent = entries.reduce((s, e) => s + e.currentQty, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Inventory</h2>
          <p className="text-muted-foreground">Products assigned to you for delivery.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInventory} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalAssigned}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <PackageCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-700">{totalDelivered}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Hand</CardTitle>
            <PackageOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-700">{totalCurrent}</div></CardContent>
        </Card>
      </div>

      {/* Inventory table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-20" />
              <p className="font-medium">No inventory assigned yet.</p>
              <p className="text-sm mt-1">Your manager will assign products to you before delivery.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Assigned</TableHead>
                    <TableHead className="text-center">Delivered</TableHead>
                    <TableHead className="text-center">Returned</TableHead>
                    <TableHead className="text-center">In Hand</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="font-medium">{entry.productName}</div>
                        {entry.productSku && <div className="text-xs text-muted-foreground">SKU: {entry.productSku}</div>}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{entry.assignedQty}</TableCell>
                      <TableCell className="text-center text-green-700 font-medium">{entry.deliveredQty}</TableCell>
                      <TableCell className="text-center text-orange-600 font-medium">{entry.returnedQty}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold text-lg ${entry.currentQty > 0 ? "text-blue-700" : "text-muted-foreground"}`}>
                          {entry.currentQty}
                        </span>
                      </TableCell>
                      <TableCell>
                        {entry.currentQty <= 0 ? (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">Cleared</Badge>
                        ) : entry.currentQty <= 5 ? (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">Low</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">In Stock</Badge>
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
    </div>
  );
}
