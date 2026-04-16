import { useParams, Link, useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRolePrefix } from "@/lib/use-role-prefix";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetOrder,
  useUpdateOrder,
  useListStations,
  getListOrdersQueryKey,
  getGetOrderQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const editSchema = z.object({
  customerName: z.string().min(2, "Required"),
  customerPhone: z.string().min(10, "Valid phone required"),
  alternatePhone: z.string().optional(),
  productName: z.string().min(2, "Required"),
  quantity: z.coerce.number().min(1),
  codAmount: z.coerce.number().min(0),
  address: z.string().min(5, "Required"),
  landmark: z.string().optional(),
  area: z.string().optional(),
  stationId: z.coerce.number().optional().nullable(),
  priority: z.enum(["normal", "high", "urgent"]).default("normal"),
  notes: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

export default function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const prefix = useRolePrefix();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: orderData, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) }
  });

  const { data: stations } = useListStations();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      customerName: "", customerPhone: "", alternatePhone: "",
      productName: "", quantity: 1, codAmount: 0,
      address: "", landmark: "", area: "",
      priority: "normal", notes: "",
    },
  });

  // Pre-fill form once order data loads
  useEffect(() => {
    if (orderData?.order) {
      const o = orderData.order;
      form.reset({
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        alternatePhone: o.alternatePhone ?? "",
        productName: o.productName,
        quantity: o.quantity,
        codAmount: o.codAmount,
        address: o.address,
        landmark: o.landmark ?? "",
        area: o.area ?? "",
        stationId: o.stationId ?? null,
        priority: (o.priority as "normal" | "high" | "urgent") ?? "normal",
        notes: o.notes ?? "",
      });
    }
  }, [orderData]);

  const updateMutation = useUpdateOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        toast({ title: "Order updated", description: "Changes saved successfully." });
        setLocation(`${prefix}/orders/${orderId}`);
      },
      onError: (err: any) => {
        toast({ title: "Failed to update", description: err.message, variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: EditFormValues) => {
    updateMutation.mutate({
      id: orderId,
      data: { ...values, stationId: values.stationId || null },
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!orderData?.order) {
    return <div className="text-center py-16 text-muted-foreground">Order not found.</div>;
  }

  const order = orderData.order;
  const canEdit = ["admin", "manager"].includes(user?.role || "");
  if (!canEdit) {
    return <div className="text-center py-16 text-muted-foreground">You do not have permission to edit orders.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`${prefix}/orders`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Edit Order</h2>
          <p className="text-muted-foreground">{order.orderCode}</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><CardTitle>Customer Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input {...form.register("customerName")} className={form.formState.errors.customerName ? "border-red-500" : ""} />
                {form.formState.errors.customerName && <p className="text-xs text-red-500">{form.formState.errors.customerName.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input {...form.register("customerPhone")} className={form.formState.errors.customerPhone ? "border-red-500" : ""} />
                  {form.formState.errors.customerPhone && <p className="text-xs text-red-500">{form.formState.errors.customerPhone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Alternate Phone</Label>
                  <Input {...form.register("alternatePhone")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Delivery Address *</Label>
                <Textarea {...form.register("address")} className={form.formState.errors.address ? "border-red-500 min-h-[80px]" : "min-h-[80px]"} />
                {form.formState.errors.address && <p className="text-xs text-red-500">{form.formState.errors.address.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Area / Tole</Label>
                  <Input {...form.register("area")} />
                </div>
                <div className="space-y-2">
                  <Label>Landmark</Label>
                  <Input {...form.register("landmark")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Package & Logistics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product Description *</Label>
                <Input {...form.register("productName")} className={form.formState.errors.productName ? "border-red-500" : ""} />
                {form.formState.errors.productName && <p className="text-xs text-red-500">{form.formState.errors.productName.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input type="number" {...form.register("quantity")} />
                </div>
                <div className="space-y-2">
                  <Label>COD Amount (Rs.) *</Label>
                  <Input type="number" {...form.register("codAmount")} className="text-lg font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.watch("priority")}
                  onValueChange={(v: any) => form.setValue("priority", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {["admin", "manager"].includes(user?.role || "") && (
                <div className="space-y-2">
                  <Label>Station</Label>
                  <Select
                    value={form.watch("stationId")?.toString() ?? "0"}
                    onValueChange={(v) => form.setValue("stationId", v === "0" ? null : parseInt(v, 10))}
                  >
                    <SelectTrigger><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Auto-assign</SelectItem>
                      {stations?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Delivery Notes</Label>
                <Textarea {...form.register("notes")} placeholder="Instructions for the rider..." className="min-h-[80px]" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Link href={`/orders/${orderId}`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={updateMutation.isPending} size="lg">
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
