import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useListVendors, useListStations, useCreateBulkOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Save, Trash2, Loader2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BulkOrderRow {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  quantity: number | "";
  codAmount: number | "";
  address: string;
  stationId: number | null | "";
}

export default function BulkOrder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isVendor = user?.role === "vendor";
  const defaultVendorId = isVendor && user?.vendorId ? user.vendorId : "";

  const [vendorId, setVendorId] = useState<number | "">(defaultVendorId);
  const [rows, setRows] = useState<BulkOrderRow[]>([
    { id: "1", customerName: "", customerPhone: "", productName: "", quantity: 1, codAmount: 0, address: "", stationId: "" },
    { id: "2", customerName: "", customerPhone: "", productName: "", quantity: 1, codAmount: 0, address: "", stationId: "" },
    { id: "3", customerName: "", customerPhone: "", productName: "", quantity: 1, codAmount: 0, address: "", stationId: "" }
  ]);

  const { data: vendors } = useListVendors({}, { query: { enabled: !isVendor } });
  const { data: stations } = useListStations();

  const bulkOrderMutation = useCreateBulkOrders({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ 
          title: "Bulk upload complete", 
          description: `Successfully created ${data.created} orders. ${data.failed} failed.` 
        });
        if (data.failed === 0) {
          setRows([{ id: Date.now().toString(), customerName: "", customerPhone: "", productName: "", quantity: 1, codAmount: 0, address: "", stationId: "" }]);
        }
      }
    }
  });

  const addRow = () => {
    setRows([...rows, { id: Date.now().toString(), customerName: "", customerPhone: "", productName: "", quantity: 1, codAmount: 0, address: "", stationId: "" }]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof BulkOrderRow, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const validateRow = (row: BulkOrderRow) => {
    const errors: Record<string, string> = {};
    if (!row.customerName.trim()) errors.customerName = "Required";
    if (!row.customerPhone.trim() || row.customerPhone.length < 10) errors.customerPhone = "Invalid phone";
    if (!row.productName.trim()) errors.productName = "Required";
    if (row.quantity === "" || row.quantity < 1) errors.quantity = "Invalid qty";
    if (row.codAmount === "" || row.codAmount < 0) errors.codAmount = "Invalid COD";
    if (!row.address.trim()) errors.address = "Required";
    return errors;
  };

  const handleSubmit = () => {
    if (!vendorId) {
      toast({ title: "Vendor required", variant: "destructive" });
      return;
    }

    const filledRows = rows.filter(r => r.customerName || r.customerPhone || r.productName || r.address || r.codAmount !== 0);
    
    if (filledRows.length === 0) {
      toast({ title: "No data", description: "Please fill at least one order.", variant: "destructive" });
      return;
    }

    let hasErrors = false;
    filledRows.forEach(row => {
      if (Object.keys(validateRow(row)).length > 0) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      toast({ title: "Validation Error", description: "Please fix highlighted fields before submitting.", variant: "destructive" });
      return;
    }

    const payload = {
      vendorId: Number(vendorId),
      orders: filledRows.map(r => ({
        vendorId: Number(vendorId),
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        productName: r.productName,
        quantity: Number(r.quantity),
        codAmount: Number(r.codAmount),
        address: r.address,
        stationId: r.stationId ? Number(r.stationId) : null,
      }))
    };

    bulkOrderMutation.mutate({ data: payload });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bulk Order Entry</h2>
          <p className="text-muted-foreground">Rapidly enter multiple orders at once.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div>
              <CardTitle>Spreadsheet Entry</CardTitle>
              <CardDescription>Enter one order per row. Invalid fields will be highlighted.</CardDescription>
            </div>
            {!isVendor && (
              <div className="w-64">
                <Select value={vendorId.toString()} onValueChange={(v) => setVendorId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map(v => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium text-left">Customer Name *</th>
                  <th className="p-2 font-medium text-left w-32">Phone *</th>
                  <th className="p-2 font-medium text-left">Product *</th>
                  <th className="p-2 font-medium text-left w-20">Qty *</th>
                  <th className="p-2 font-medium text-left w-28">COD (Rs) *</th>
                  <th className="p-2 font-medium text-left">Address *</th>
                  <th className="p-2 font-medium text-left w-40">Station</th>
                  <th className="p-2 font-medium text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isRowFilled = row.customerName || row.customerPhone || row.productName || row.address;
                  const errors = isRowFilled ? validateRow(row) : {};
                  
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="p-1">
                        <CellInput
                          value={row.customerName}
                          onChange={(v) => updateRow(row.id, "customerName", v)}
                          error={errors.customerName}
                        />
                      </td>
                      <td className="p-1">
                        <CellInput
                          value={row.customerPhone}
                          onChange={(v) => updateRow(row.id, "customerPhone", v)}
                          error={errors.customerPhone}
                        />
                      </td>
                      <td className="p-1">
                        <CellInput
                          value={row.productName}
                          onChange={(v) => updateRow(row.id, "productName", v)}
                          error={errors.productName}
                        />
                      </td>
                      <td className="p-1">
                        <CellInput
                          type="number"
                          value={row.quantity}
                          onChange={(v) => updateRow(row.id, "quantity", v === "" ? "" : Number(v))}
                          error={errors.quantity}
                        />
                      </td>
                      <td className="p-1">
                        <CellInput
                          type="number"
                          value={row.codAmount}
                          onChange={(v) => updateRow(row.id, "codAmount", v === "" ? "" : Number(v))}
                          error={errors.codAmount}
                        />
                      </td>
                      <td className="p-1">
                        <CellInput
                          value={row.address}
                          onChange={(v) => updateRow(row.id, "address", v)}
                          error={errors.address}
                        />
                      </td>
                      <td className="p-1">
                        <select 
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          value={row.stationId?.toString() || ""}
                          onChange={(e) => updateRow(row.id, "stationId", e.target.value ? Number(e.target.value) : "")}
                        >
                          <option value="">Auto</option>
                          {stations?.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1 text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <Button variant="outline" onClick={addRow} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Row
            </Button>
            
            <Button onClick={handleSubmit} disabled={bulkOrderMutation.isPending || !vendorId}>
              {bulkOrderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" /> Save Orders
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CellInput({ value, onChange, error, type = "text" }: { value: any, onChange: (v: string) => void, error?: string, type?: string }) {
  const isInvalid = !!error;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`h-9 border-0 rounded-none focus-visible:ring-1 ${isInvalid ? 'bg-red-50 text-red-900 border border-red-500 focus-visible:ring-red-500' : ''}`}
          />
          {isInvalid && (
            <AlertCircle className="h-3 w-3 text-red-500 absolute right-2 top-3 pointer-events-none" />
          )}
        </div>
      </TooltipTrigger>
      {isInvalid && (
        <TooltipContent side="top">
          <p className="text-red-500">{error}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
