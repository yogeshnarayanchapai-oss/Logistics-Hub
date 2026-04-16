import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useListVendors, useListStations, useCreateBulkOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Save, Trash2, Loader2, AlertCircle, Upload, Download, FileSpreadsheet, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";

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

const SAMPLE_HEADERS = [
  "Customer Name",
  "Phone Number",
  "Product Name",
  "Quantity",
  "COD Amount (Rs)",
  "Delivery Address",
  "Station (optional)",
];

const SAMPLE_ROWS = [
  ["Ram Sharma", "9841234567", "Mobile Phone", 1, 15000, "Baluwatar, Kathmandu", "Kathmandu"],
  ["Sita Thapa", "9812345678", "Laptop Bag", 2, 1200, "Pulchowk, Lalitpur", "Lalitpur"],
  ["Hari Prasad", "9861234567", "Shoes", 1, 2500, "Bhaktapur Durbar Square", "Bhaktapur"],
];

function makeEmptyRow(): BulkOrderRow {
  return { id: Date.now().toString() + Math.random(), customerName: "", customerPhone: "", productName: "", quantity: 1, codAmount: 0, address: "", stationId: "" };
}

export default function BulkOrder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isVendor = user?.role === "vendor";
  const defaultVendorId = isVendor && user?.vendorId ? user.vendorId : "";

  const [vendorId, setVendorId] = useState<number | "">(defaultVendorId);
  const [rows, setRows] = useState<BulkOrderRow[]>([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
  const [isDragging, setIsDragging] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [importExpanded, setImportExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          setRows([makeEmptyRow()]);
          setImportedCount(null);
        }
      }
    }
  });

  const downloadSample = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [SAMPLE_HEADERS, ...SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 10 },
      { wch: 16 },
      { wch: 30 },
      { wch: 18 },
    ];

    const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "DC2626" } }, fontColor: { rgb: "FFFFFF" } };
    ["A1", "B1", "C1", "D1", "E1", "F1", "G1"].forEach((cell) => {
      if (ws[cell]) ws[cell].s = headerStyle;
    });

    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "swiftship_bulk_order_template.xlsx");
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (raw.length < 2) {
          toast({ title: "Empty file", description: "The Excel file has no data rows.", variant: "destructive" });
          return;
        }

        const headerRow = raw[0].map((h: any) => String(h).trim().toLowerCase());
        const dataRows = raw.slice(1).filter((r) => r.some((c: any) => String(c).trim() !== ""));

        const getCol = (row: any[], names: string[]) => {
          for (const name of names) {
            const idx = headerRow.findIndex((h) => h.includes(name.toLowerCase()));
            if (idx >= 0) return String(row[idx] ?? "").trim();
          }
          return "";
        };

        const parsed: BulkOrderRow[] = dataRows.map((row) => {
          const stationName = getCol(row, ["station"]).toLowerCase();
          const matchedStation = stations?.find((s) =>
            s.name.toLowerCase().includes(stationName) || stationName.includes(s.name.toLowerCase())
          );

          return {
            id: Date.now().toString() + Math.random(),
            customerName: getCol(row, ["customer name", "name", "customer"]),
            customerPhone: getCol(row, ["phone", "mobile", "contact"]),
            productName: getCol(row, ["product", "item", "goods"]),
            quantity: Number(getCol(row, ["quantity", "qty"])) || 1,
            codAmount: Number(getCol(row, ["cod", "amount", "price"])) || 0,
            address: getCol(row, ["address", "delivery address", "location"]),
            stationId: matchedStation ? matchedStation.id : "",
          };
        });

        setRows(parsed.length > 0 ? parsed : [makeEmptyRow()]);
        setImportedCount(parsed.length);
        toast({
          title: `${parsed.length} rows imported`,
          description: "Review the data below and submit when ready.",
        });
      } catch {
        toast({ title: "Parse error", description: "Could not read the Excel file. Please use the sample template.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|ods)$/i)) {
      toast({ title: "Invalid file", description: "Please upload an .xlsx or .xls file.", variant: "destructive" });
      return;
    }
    parseExcelFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const addRow = () => setRows([...rows, makeEmptyRow()]);

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof BulkOrderRow, value: any) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
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

    const filledRows = rows.filter(
      (r) => r.customerName || r.customerPhone || r.productName || r.address || r.codAmount !== 0
    );

    if (filledRows.length === 0) {
      toast({ title: "No data", description: "Please fill at least one order.", variant: "destructive" });
      return;
    }

    const hasErrors = filledRows.some((row) => Object.keys(validateRow(row)).length > 0);
    if (hasErrors) {
      toast({ title: "Validation Error", description: "Please fix highlighted fields before submitting.", variant: "destructive" });
      return;
    }

    bulkOrderMutation.mutate({
      data: {
        vendorId: Number(vendorId),
        orders: filledRows.map((r) => ({
          vendorId: Number(vendorId),
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          productName: r.productName,
          quantity: Number(r.quantity),
          codAmount: Number(r.codAmount),
          address: r.address,
          stationId: r.stationId ? Number(r.stationId) : null,
        })),
      },
    });
  };

  const filledCount = rows.filter(
    (r) => r.customerName || r.customerPhone || r.productName || r.address || r.codAmount !== 0
  ).length;

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
          <p className="text-muted-foreground">Enter orders manually or import from an Excel file.</p>
        </div>
      </div>

      {/* Excel Import Card */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setImportExpanded((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                Import from Excel
                {importedCount !== null && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-normal text-xs">
                    {importedCount} rows imported
                  </Badge>
                )}
              </CardTitle>
              {importExpanded && (
                <CardDescription>
                  Download our template, fill it in, then upload to auto-populate the order table below.
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" onClick={downloadSample} className="shrink-0">
                <Download className="mr-2 h-4 w-4" />
                Download Sample
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setImportExpanded((v) => !v)}
                className="shrink-0 text-muted-foreground"
              >
                {importExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {importExpanded && <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-sm">Click to upload or drag & drop</p>
            <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls files</p>
            {importedCount !== null && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  ✓ {importedCount} rows imported — review the table below
                </Badge>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setImportedCount(null); setRows([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.ods"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
          />

          {/* Column mapping hint */}
          <div className="mt-3 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
            <span className="font-medium">Expected columns:</span>{" "}
            {SAMPLE_HEADERS.map((h, i) => (
              <span key={i}><code className="bg-background px-1 rounded">{h}</code>{i < SAMPLE_HEADERS.length - 1 ? ", " : ""}</span>
            ))}
          </div>
        </CardContent>}
      </Card>

      {/* Spreadsheet Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div>
              <CardTitle>
                Review & Submit
                {filledCount > 0 && (
                  <Badge className="ml-2 bg-primary/10 text-primary border-primary/20">{filledCount} orders</Badge>
                )}
              </CardTitle>
              <CardDescription>Edit any cell. Invalid fields are highlighted in red.</CardDescription>
            </div>
            {!isVendor && (
              <div className="w-64">
                <Select value={vendorId.toString()} onValueChange={(v) => setVendorId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((v) => (
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
                  <th className="p-2 font-medium text-left text-xs">#</th>
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
                  const rowHasError = Object.keys(errors).length > 0;

                  return (
                    <tr key={row.id} className={`border-t ${rowHasError && isRowFilled ? "bg-red-50/40" : ""}`}>
                      <td className="p-1 pl-2 text-xs text-muted-foreground w-6">{index + 1}</td>
                      <td className="p-1">
                        <CellInput value={row.customerName} onChange={(v) => updateRow(row.id, "customerName", v)} error={errors.customerName} />
                      </td>
                      <td className="p-1">
                        <CellInput value={row.customerPhone} onChange={(v) => updateRow(row.id, "customerPhone", v)} error={errors.customerPhone} />
                      </td>
                      <td className="p-1">
                        <CellInput value={row.productName} onChange={(v) => updateRow(row.id, "productName", v)} error={errors.productName} />
                      </td>
                      <td className="p-1">
                        <CellInput type="number" value={row.quantity} onChange={(v) => updateRow(row.id, "quantity", v === "" ? "" : Number(v))} error={errors.quantity} />
                      </td>
                      <td className="p-1">
                        <CellInput type="number" value={row.codAmount} onChange={(v) => updateRow(row.id, "codAmount", v === "" ? "" : Number(v))} error={errors.codAmount} />
                      </td>
                      <td className="p-1">
                        <CellInput value={row.address} onChange={(v) => updateRow(row.id, "address", v)} error={errors.address} />
                      </td>
                      <td className="p-1">
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={row.stationId?.toString() || ""}
                          onChange={(e) => updateRow(row.id, "stationId", e.target.value ? Number(e.target.value) : "")}
                        >
                          <option value="">Auto</option>
                          {stations?.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1 text-center">
                        <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={rows.length === 1} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
              <Save className="mr-2 h-4 w-4" />
              Submit {filledCount > 0 ? `${filledCount} Orders` : "Orders"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CellInput({ value, onChange, error, type = "text" }: { value: any; onChange: (v: string) => void; error?: string; type?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`h-9 border-0 rounded-none focus-visible:ring-1 ${
              error ? "bg-red-50 text-red-900 border border-red-500 focus-visible:ring-red-500" : ""
            }`}
          />
          {error && <AlertCircle className="h-3 w-3 text-red-500 absolute right-2 top-3 pointer-events-none" />}
        </div>
      </TooltipTrigger>
      {error && (
        <TooltipContent side="top">
          <p className="text-red-500">{error}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
