import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useRolePrefix } from "@/lib/use-role-prefix";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCreateOrder, 
  useListVendors, 
  useListStations,
  getListOrdersQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";

const orderSchema = z.object({
  vendorId: z.coerce.number().min(1, "Vendor is required"),
  customerName: z.string().min(2, "Customer name is required"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  alternatePhone: z.string().optional(),
  productName: z.string().min(2, "Product name is required"),
  productSku: z.string().optional(),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  codAmount: z.coerce.number().min(0, "COD amount cannot be negative"),
  address: z.string().min(5, "Address is required"),
  landmark: z.string().optional(),
  area: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  stationId: z.coerce.number().optional().nullable(),
  priority: z.enum(["normal", "high", "urgent"]).default("normal"),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

export default function NewOrder() {
  const { user } = useAuth();
  const prefix = useRolePrefix();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const isVendor = user?.role === "vendor";
  const defaultVendorId = isVendor && user?.vendorId ? user.vendorId : 0;
  const [areaMode, setAreaMode] = useState<"select" | "custom">("select");

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      vendorId: defaultVendorId,
      customerName: "",
      customerPhone: "",
      alternatePhone: "",
      productName: "",
      productSku: "",
      quantity: 1,
      codAmount: 0,
      address: "",
      landmark: "",
      area: "",
      city: "",
      district: "",
      priority: "normal",
      notes: "",
    },
  });

  const { data: vendors } = useListVendors({}, {
    query: { enabled: !isVendor }
  });

  const { data: stations } = useListStations();

  const coverageAreas = useMemo(() => {
    const set = new Set<string>();
    (stations ?? []).forEach(s => {
      const cov = (s as any).areaCoverage as string | null | undefined;
      if (cov) cov.split(",").map(t => t.trim()).filter(Boolean).forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [stations]);

  const createOrderMutation = useCreateOrder({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ title: "Order created", description: `Order ${data.orderCode} has been created successfully.` });
        setLocation(`${prefix}/orders/${data.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Failed to create order", description: err.message, variant: "destructive" });
      }
    }
  });

  const onSubmit = (data: OrderFormValues) => {
    // Convert undefined to null for optional API fields
    const payload = {
      ...data,
      stationId: data.stationId || null,
    };
    createOrderMutation.mutate({ data: payload });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`${prefix}/orders`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create New Order</h2>
          <p className="text-muted-foreground">Enter delivery and package details.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isVendor && (
                <div className="space-y-2">
                  <Label htmlFor="vendorId">Vendor *</Label>
                  <Select 
                    onValueChange={(val) => form.setValue("vendorId", parseInt(val, 10))}
                    value={form.watch("vendorId") ? form.watch("vendorId").toString() : ""}
                  >
                    <SelectTrigger className={form.formState.errors.vendorId ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors?.map(v => (
                        <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.vendorId && <p className="text-xs text-red-500">{form.formState.errors.vendorId.message}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input id="customerName" {...form.register("customerName")} className={form.formState.errors.customerName ? "border-red-500" : ""} />
                {form.formState.errors.customerName && <p className="text-xs text-red-500">{form.formState.errors.customerName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone Number *</Label>
                  <Input id="customerPhone" {...form.register("customerPhone")} className={form.formState.errors.customerPhone ? "border-red-500" : ""} />
                  {form.formState.errors.customerPhone && <p className="text-xs text-red-500">{form.formState.errors.customerPhone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">Alternate Phone</Label>
                  <Input id="alternatePhone" {...form.register("alternatePhone")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Delivery Address *</Label>
                <Textarea id="address" {...form.register("address")} className={form.formState.errors.address ? "border-red-500 min-h-[80px]" : "min-h-[80px]"} />
                {form.formState.errors.address && <p className="text-xs text-red-500">{form.formState.errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...form.register("city")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area">Area/Tole</Label>
                  {areaMode === "select" ? (
                    <Select
                      value={form.watch("area") || ""}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          setAreaMode("custom");
                          form.setValue("area", "");
                        } else {
                          form.setValue("area", val);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an area…" />
                      </SelectTrigger>
                      <SelectContent>
                        {coverageAreas.map(a => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">+ Custom area…</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="area"
                        {...form.register("area")}
                        placeholder="Type custom area / tole"
                        autoFocus
                      />
                      {coverageAreas.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => { setAreaMode("select"); form.setValue("area", ""); }}
                        >
                          List
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Input id="district" {...form.register("district")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="landmark">Landmark</Label>
                  <Input id="landmark" {...form.register("landmark")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Package & Logistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Product Description *</Label>
                <Input id="productName" {...form.register("productName")} className={form.formState.errors.productName ? "border-red-500" : ""} />
                {form.formState.errors.productName && <p className="text-xs text-red-500">{form.formState.errors.productName.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input id="quantity" type="number" {...form.register("quantity")} className={form.formState.errors.quantity ? "border-red-500" : ""} />
                  {form.formState.errors.quantity && <p className="text-xs text-red-500">{form.formState.errors.quantity.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productSku">SKU</Label>
                  <Input id="productSku" {...form.register("productSku")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="codAmount">COD Amount (Rs.) *</Label>
                <Input id="codAmount" type="number" {...form.register("codAmount")} className={form.formState.errors.codAmount ? "border-red-500 text-lg font-bold" : "text-lg font-bold"} />
                {form.formState.errors.codAmount && <p className="text-xs text-red-500">{form.formState.errors.codAmount.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  onValueChange={(val: any) => form.setValue("priority", val)}
                  defaultValue="normal"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {["admin", "manager"].includes(user?.role || "") && (
                <div className="space-y-2">
                  <Label htmlFor="stationId">Target Station</Label>
                  <Select 
                    onValueChange={(val) => form.setValue("stationId", parseInt(val, 10))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-assign based on area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Auto-assign</SelectItem>
                      {stations?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Leave empty to auto-assign based on city/area mapping.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Delivery Notes</Label>
                <Textarea id="notes" {...form.register("notes")} placeholder="Any specific instructions for the rider..." className="min-h-[80px]" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Link href={`${prefix}/orders`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createOrderMutation.isPending} size="lg">
            {createOrderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Create Order
          </Button>
        </div>
      </form>
    </div>
  );
}
