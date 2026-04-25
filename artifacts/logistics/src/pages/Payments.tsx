import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useListPaymentRequests, useCreatePaymentRequest, useUpdatePaymentRequest, useGetCodSummary, useListBankAccounts, useCreateBankAccount, useUpdateBankAccount, getListPaymentRequestsQueryKey, getGetCodSummaryQueryKey, getListBankAccountsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, DollarSign, Wallet, CreditCard, Building, Pencil, Truck, CheckCircle, XCircle, Eye, Package, Send, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export default function Payments() {
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const vendorId = isVendor && user?.vendorId ? user.vendorId : undefined;
  
  const { data: payments, isLoading } = useListPaymentRequests({ vendorId });
  const { data: codSummary } = useGetCodSummary({ query: { vendorId } });
  const { data: bankAccounts, isLoading: bankAccountsLoading } = useListBankAccounts({ vendorId }, { query: { enabled: isVendor } });

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [requestNote, setRequestNote] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "release" | null>(null);

  // Bank account management state
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreatePaymentRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentRequestsQueryKey() });
        toast({ title: "Payment requested successfully" });
        setIsRequestDialogOpen(false);
      }
    }
  });

  const updateMutation = useUpdatePaymentRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCodSummaryQueryKey() });
        toast({ title: "Payment status updated" });
        setSelectedPayment(null);
        setActionType(null);
      }
    }
  });

  const createBankMutation = useCreateBankAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBankAccountsQueryKey() });
        toast({ title: "Bank account added successfully" });
        setBankFormOpen(false);
        setEditingAccount(null);
      }
    }
  });

  const updateBankMutation = useUpdateBankAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBankAccountsQueryKey() });
        toast({ title: "Bank account updated successfully" });
        setBankFormOpen(false);
        setEditingAccount(null);
      }
    }
  });

  const handleRequestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      bankAccountId: Number(selectedBankAccountId),
      requestedAmount: Number(formData.get("requestedAmount")),
      note: requestNote || null
    };
    createMutation.mutate({ data });
  };

  const openRequestDialog = () => {
    setSelectedBankAccountId(bankAccounts?.[0]?.id?.toString() ?? "");
    setRequestNote("");
    setIsRequestDialogOpen(true);
  };

  const handleActionConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPayment || !actionType) return;
    
    const formData = new FormData(e.currentTarget);
    const data: any = {
      status: actionType === "approve" ? "approved" : actionType === "reject" ? "rejected" : "released"
    };

    if (actionType === "approve") {
      data.approvedAmount = Number(formData.get("approvedAmount"));
    } else if (actionType === "release") {
      data.referenceId = formData.get("referenceId") as string;
      data.paymentDate = formData.get("paymentDate") as string;
      data.releaseNote = formData.get("releaseNote") as string;
    }

    updateMutation.mutate({ id: selectedPayment.id, data });
  };

  const handleBankSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      vendorId: isVendor && user.vendorId ? user.vendorId : Number(formData.get("vendorId")),
      accountHolderName: formData.get("accountHolderName") as string,
      bankName: formData.get("bankName") as string,
      branch: (formData.get("branch") as string) || null,
      accountNumber: formData.get("accountNumber") as string,
      walletMethod: (formData.get("walletMethod") as string) || null,
      remarks: (formData.get("remarks") as string) || null,
      isDefault: formData.get("isDefault") === "on",
    };

    if (editingAccount) {
      const { vendorId: _, ...updateData } = data;
      updateBankMutation.mutate({ id: editingAccount.id, data: updateData });
    } else {
      createBankMutation.mutate({ data });
    }
  };

  const openAddBankForm = () => {
    setEditingAccount(null);
    setBankFormOpen(true);
  };

  const openEditBankForm = (account: any) => {
    setEditingAccount(account);
    setBankFormOpen(true);
  };

  // ── Rider payment requests (admin/manager only) ──
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const authToken = () => localStorage.getItem("authToken");

  // ── View Payment Request dialog ──
  const [viewingPayment, setViewingPayment] = useState<any>(null);
  const [viewOrders, setViewOrders] = useState<any[]>([]);
  const [viewOrdersLoading, setViewOrdersLoading] = useState(false);
  const [viewAdminNote, setViewAdminNote] = useState("");
  const [viewNoteSending, setViewNoteSending] = useState(false);
  const [viewingRiderPayment, setViewingRiderPayment] = useState<any>(null);
  const [riderViewAdminNote, setRiderViewAdminNote] = useState("");
  const [riderViewNoteSending, setRiderViewNoteSending] = useState(false);

  const sendAdminNote = async (type: "vendor" | "rider", id: number, note: string, onDone: () => void) => {
    if (!note.trim()) return;
    const endpoint = type === "vendor"
      ? `${BASE}/api/payment-requests/${id}/admin-note`
      : `${BASE}/api/rider-payment-requests/${id}/admin-note`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
        body: JSON.stringify({ note: note.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const updated = await res.json();
      if (type === "vendor") {
        setViewingPayment(updated);
        setViewAdminNote("");
      } else {
        setViewingRiderPayment(updated);
        setRiderViewAdminNote("");
        fetchRiderPayments();
      }
      toast({ title: "Note sent successfully" });
      onDone();
    } catch (err: any) {
      toast({ title: err.message || "Failed to send note", variant: "destructive" });
    }
  };

  const openViewDialog = (payment: any) => {
    setViewingPayment(payment);
    setViewAdminNote("");
    setViewOrders([]);
    setViewOrdersLoading(true);
    fetch(`${BASE}/api/payment-requests/${payment.id}/orders`, {
      headers: { Authorization: `Bearer ${authToken()}` }
    })
      .then(r => r.json())
      .then(d => setViewOrders(Array.isArray(d) ? d : []))
      .catch(() => setViewOrders([]))
      .finally(() => setViewOrdersLoading(false));
  };

  const handleDownloadCodPdf = async (payment: any) => {
    const res = await fetch(`${BASE}/api/payment-requests/${payment.id}/orders`, {
      headers: { Authorization: `Bearer ${authToken()}` }
    });
    if (!res.ok) return;
    const orders = await res.json();
    downloadPaymentPdf(payment, Array.isArray(orders) ? orders : []);
  };

  const downloadPaymentPdf = (payment: any, orders: any[]) => {
    const totalCod = orders.reduce((s: number, o: any) => s + Number(o.codAmount), 0);
    const totalDelivery = orders.reduce((s: number, o: any) => s + Number(o.deliveryCharge), 0);
    const totalNet = orders.reduce((s: number, o: any) => s + Number(o.vendorPayable), 0);

    const rows = orders.map((o: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${o.orderCode}</td>
        <td>${o.customerName}<br/><small>${o.customerPhone}</small></td>
        <td class="num">${Number(o.codAmount).toLocaleString()}</td>
        <td class="num">${Number(o.deliveryCharge).toLocaleString()}</td>
        <td class="num">${Number(o.vendorPayable).toLocaleString()}</td>
        <td>${o.riderName ?? "—"}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Payment Statement - ${payment.vendorName}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
        h2 { margin: 0 0 4px; } p { margin: 2px 0; color: #555; }
        .header { margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #d1d5db; font-size: 11px; }
        td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
        .num { text-align: right; }
        tfoot td { font-weight: bold; background: #f9fafb; }
        .meta { display: flex; gap: 40px; margin-top: 12px; font-size: 11px; }
        .meta span { color: #6b7280; } .meta strong { color: #111; }
      </style></head><body>
      <div class="header">
        <h2>Payment Statement</h2>
        <p>Vendor: <strong>${payment.vendorName}</strong></p>
        <p>Request Date: ${new Date(payment.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
        ${payment.referenceId ? `<p>Ref: ${payment.referenceId}</p>` : ""}
        ${payment.paymentDate ? `<p>Payment Date: ${payment.paymentDate}</p>` : ""}
      </div>
      <table>
        <thead><tr><th>SN</th><th>Order #</th><th>Customer</th><th class="num">COD</th><th class="num">Delivery Charge</th><th class="num">Net Payable</th><th>Rider</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="3">Total (${orders.length} orders)</td>
          <td class="num">Rs. ${totalCod.toLocaleString()}</td>
          <td class="num">Rs. ${totalDelivery.toLocaleString()}</td>
          <td class="num">Rs. ${totalNet.toLocaleString()}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const [riderPayments, setRiderPayments] = useState<any[]>([]);
  const [riderPaymentsLoading, setRiderPaymentsLoading] = useState(false);
  const [riderReleaseDialogOpen, setRiderReleaseDialogOpen] = useState(false);
  const [selectedRiderPayment, setSelectedRiderPayment] = useState<any>(null);
  const [riderActionType, setRiderActionType] = useState<"release" | "reject" | null>(null);
  const [riderActionPending, setRiderActionPending] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const fetchRiderPayments = useCallback(() => {
    if (!isAdmin) return;
    setRiderPaymentsLoading(true);
    fetch(`${BASE}/api/rider-payment-requests`, { headers: { Authorization: `Bearer ${authToken()}` } })
      .then(r => r.json()).then(d => setRiderPayments(Array.isArray(d) ? d : []))
      .catch(() => setRiderPayments([])).finally(() => setRiderPaymentsLoading(false));
  }, [isAdmin]);

  useEffect(() => { fetchRiderPayments(); }, [fetchRiderPayments]);

  const handleRiderAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRiderPayment || !riderActionType) return;
    const fd = new FormData(e.currentTarget);
    setRiderActionPending(true);
    try {
      const body: any = { status: riderActionType === "release" ? "released" : "rejected" };
      if (riderActionType === "release") {
        body.approvedAmount = fd.get("approvedAmount");
        body.referenceId = fd.get("referenceId");
        body.paymentDate = fd.get("paymentDate");
        body.releaseNote = fd.get("releaseNote");
      }
      const res = await fetch(`${BASE}/api/rider-payment-requests/${selectedRiderPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: riderActionType === "release" ? "Payment released to rider" : "Request rejected" });
      setRiderReleaseDialogOpen(false);
      setSelectedRiderPayment(null);
      setRiderActionType(null);
      fetchRiderPayments();
    } catch (err: any) {
      toast({ title: err.message || "Action failed", variant: "destructive" });
    } finally { setRiderActionPending(false); }
  };

  const riderPaymentStatusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
    released: "bg-green-100 text-green-700 border-green-300",
    rejected: "bg-red-100 text-red-700 border-red-300",
  };

  const allRequestsSorted = useMemo(() => {
    const vendorItems = (payments ?? []).map((p: any) => ({ ...p, _type: "vendor" as const }));
    const riderItems = riderPayments.map((p: any) => ({ ...p, _type: "rider" as const }));
    return [...vendorItems, ...riderItems].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [payments, riderPayments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments & Remittances</h2>
          <p className="text-muted-foreground">Manage COD releases and payment requests.</p>
        </div>
        {isVendor && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsBankDialogOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" /> Manage Bank Accounts
            </Button>
            <Button onClick={openRequestDialog} disabled={!codSummary || codSummary.pendingRelease <= 0}>
              <Plus className="mr-2 h-4 w-4" /> Request Payment
            </Button>
          </div>
        )}
      </div>

      {codSummary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rs. {codSummary.totalVendorPayable.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Total COD minus delivery charges</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Already Released</CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">Rs. {codSummary.totalReleased.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Pending Release</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Rs. {codSummary.pendingRelease.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue={isAdmin ? "all" : "vendor"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="all">All Requests</TabsTrigger>}
          <TabsTrigger value="vendor"><DollarSign className="mr-1.5 h-4 w-4" /> Vendor Payments</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="rider"><Truck className="mr-1.5 h-4 w-4" /> Rider Commissions</TabsTrigger>
          )}
        </TabsList>

        {/* ── All Requests (Admin/Manager) ── */}
        {isAdmin && (
          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Payment Requests</CardTitle>
                <CardDescription>Combined vendor and rider commission payment requests.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading || riderPaymentsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Party</TableHead>
                          <TableHead>Account Info</TableHead>
                          <TableHead className="text-right">Requested</TableHead>
                          <TableHead className="text-right">Approved</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allRequestsSorted.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payment requests found.</TableCell>
                          </TableRow>
                        ) : (
                          allRequestsSorted.map((item) => item._type === "vendor" ? (
                            <TableRow key={`v-${item.id}`}>
                              <TableCell className="font-medium text-sm">{format(new Date(item.createdAt), "MMM d, yyyy")}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">Vendor</Badge></TableCell>
                              <TableCell className="text-sm">{item.vendorName}</TableCell>
                              <TableCell>
                                <div className="text-sm max-w-[160px] truncate">{item.bankAccountInfo}</div>
                                {item.referenceId && <div className="text-xs text-muted-foreground">Ref: {item.referenceId}</div>}
                              </TableCell>
                              <TableCell className="text-right">Rs. {item.requestedAmount.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{item.approvedAmount ? `Rs. ${item.approvedAmount.toLocaleString()}` : "—"}</TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'pending' ? 'secondary' : item.status === 'approved' ? 'default' : item.status === 'released' ? 'outline' : 'destructive'}
                                  className={item.status === 'released' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => openViewDialog(item)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {item.status === 'pending' && (
                                    <>
                                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setSelectedPayment(item); setActionType('reject'); }}>Reject</Button>
                                      <Button size="sm" onClick={() => { setSelectedPayment(item); setActionType('approve'); }}>Approve</Button>
                                    </>
                                  )}
                                  {item.status === 'approved' && (
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelectedPayment(item); setActionType('release'); }}>Mark Released</Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={`r-${item.id}`}>
                              <TableCell className="font-medium text-sm">{format(new Date(item.createdAt), "MMM d, yyyy")}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">Rider</Badge></TableCell>
                              <TableCell>
                                <div className="text-sm font-medium">{item.riderName}</div>
                                <div className="text-xs text-muted-foreground">{item.riderEmail}</div>
                              </TableCell>
                              <TableCell className="text-sm">
                                <div>{item.bankName}</div>
                                <div className="text-muted-foreground text-xs">{item.accountNumber}</div>
                              </TableCell>
                              <TableCell className="text-right font-semibold">Rs. {item.requestedAmount.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{item.approvedAmount ? `Rs. ${item.approvedAmount.toLocaleString()}` : "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={riderPaymentStatusColor[item.status] ?? ""}>
                                  {item.status === "released" && <CheckCircle className="mr-1 h-3 w-3" />}
                                  {item.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
                                    onClick={() => { setViewingRiderPayment(item); setRiderViewAdminNote(""); }}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {item.status === "pending" && (
                                    <>
                                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() => { setSelectedRiderPayment(item); setRiderActionType("reject"); setRiderReleaseDialogOpen(true); }}>
                                        Reject
                                      </Button>
                                      <Button size="sm"
                                        onClick={() => { setSelectedRiderPayment(item); setRiderActionType("release"); setRiderReleaseDialogOpen(true); }}>
                                        Release
                                      </Button>
                                    </>
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
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Vendor Payment Requests ── */}
        <TabsContent value="vendor" className="mt-4">
          {isVendor ? (
            <Tabs defaultValue="cod">
              <TabsList>
                <TabsTrigger value="cod">COD Payment</TabsTrigger>
                <TabsTrigger value="requests">Payment Request</TabsTrigger>
              </TabsList>

              {/* Tab 1: Released / completed COD payments */}
              <TabsContent value="cod" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (() => {
                      const released = (payments ?? []).filter(p => p.status === "released");
                      if (released.length === 0) return (
                        <div className="flex flex-col items-center py-16 text-muted-foreground">
                          <DollarSign className="h-12 w-12 mb-3 opacity-20" />
                          <p className="font-medium">No payments received yet</p>
                          <p className="text-sm mt-1">Completed COD payments will appear here once released by admin.</p>
                        </div>
                      );
                      return (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">S.No</TableHead>
                                <TableHead>Transfer ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount (Rs.)</TableHead>
                                <TableHead>Bank / Collection</TableHead>
                                <TableHead className="text-center">Print</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {released.map((payment, idx) => (
                                <TableRow key={payment.id}>
                                  <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                                  <TableCell>
                                    <div className="font-mono font-semibold">{payment.referenceId || "—"}</div>
                                    {payment.paymentDate && <div className="text-xs text-muted-foreground">{payment.paymentDate}</div>}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{format(new Date(payment.createdAt), "dd MMM yyyy")}</TableCell>
                                  <TableCell className="text-right font-bold text-emerald-700 text-base">
                                    Rs. {(payment.approvedAmount ?? payment.requestedAmount).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-sm">{(payment as any).walletMethod || ((payment as any).bankName ?? "Transfer")}</TableCell>
                                  <TableCell className="text-center">
                                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 h-8 w-8 p-0"
                                      onClick={() => handleDownloadCodPdf(payment)} title="Download PDF">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: All payment requests */}
              <TabsContent value="requests" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>My Payment Requests</CardTitle>
                    <CardDescription>Track the status of your submitted payment requests.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Account Info</TableHead>
                              <TableHead className="text-right">Requested</TableHead>
                              <TableHead className="text-right">Approved</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {!payments?.length ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payment requests found.</TableCell>
                              </TableRow>
                            ) : (
                              payments.map((payment) => (
                                <TableRow key={payment.id}>
                                  <TableCell className="font-medium">{format(new Date(payment.createdAt), "MMM d, yyyy")}</TableCell>
                                  <TableCell>
                                    <div className="text-sm max-w-[200px] truncate">{payment.bankAccountInfo}</div>
                                    {payment.referenceId && <div className="text-xs text-muted-foreground">Ref: {payment.referenceId}</div>}
                                  </TableCell>
                                  <TableCell className="text-right">Rs. {payment.requestedAmount.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{payment.approvedAmount ? `Rs. ${payment.approvedAmount.toLocaleString()}` : "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant={
                                      payment.status === "pending" ? "secondary" :
                                      payment.status === "approved" ? "default" :
                                      payment.status === "released" ? "outline" : "destructive"
                                    } className={payment.status === "released" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
                                      {payment.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[160px]">
                                    {(payment as any).adminNote
                                      ? <span className="text-xs text-blue-700 line-clamp-2">{(payment as any).adminNote}</span>
                                      : <span className="text-xs text-muted-foreground">—</span>}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Vendor Payment Requests</CardTitle>
                <CardDescription>History of all vendor payment requests and their status.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Account Info</TableHead>
                          <TableHead className="text-right">Requested</TableHead>
                          <TableHead className="text-right">Approved</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Remarks</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments?.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payment requests found.</TableCell>
                          </TableRow>
                        ) : (
                          payments?.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">{format(new Date(payment.createdAt), "MMM d, yyyy")}</TableCell>
                              <TableCell>{payment.vendorName}</TableCell>
                              <TableCell>
                                <div className="text-sm max-w-[200px] truncate">{payment.bankAccountInfo}</div>
                                {payment.referenceId && <div className="text-xs text-muted-foreground">Ref: {payment.referenceId}</div>}
                              </TableCell>
                              <TableCell className="text-right">Rs. {payment.requestedAmount.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{payment.approvedAmount ? `Rs. ${payment.approvedAmount.toLocaleString()}` : "—"}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  payment.status === 'pending' ? 'secondary' :
                                  payment.status === 'approved' ? 'default' :
                                  payment.status === 'released' ? 'outline' : 'destructive'
                                } className={payment.status === 'released' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>
                                  {payment.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[160px]">
                                {(payment as any).adminNote
                                  ? <span className="text-xs text-blue-700 line-clamp-2">{(payment as any).adminNote}</span>
                                  : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => openViewDialog(payment)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {payment.status === 'pending' && (
                                    <>
                                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setSelectedPayment(payment); setActionType('reject'); }}>Reject</Button>
                                      <Button size="sm" onClick={() => { setSelectedPayment(payment); setActionType('approve'); }}>Approve</Button>
                                    </>
                                  )}
                                  {payment.status === 'approved' && (
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelectedPayment(payment); setActionType('release'); }}>Mark Released</Button>
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
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Rider Commission Payments ── */}
        {isAdmin && (
          <TabsContent value="rider" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {riderPaymentsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : riderPayments.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <Truck className="h-10 w-10 mb-2 opacity-20" />
                    <p>No rider payment requests yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rider</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead className="text-right">Requested</TableHead>
                          <TableHead className="text-right">Approved</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ref / Date</TableHead>
                          <TableHead>Requested On</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {riderPayments.map(rp => (
                          <TableRow key={rp.id}>
                            <TableCell>
                              <div className="font-medium">{rp.riderName}</div>
                              <div className="text-xs text-muted-foreground">{rp.riderEmail}</div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div>{rp.bankName}</div>
                              <div className="text-muted-foreground text-xs">{rp.accountNumber}</div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">Rs. {rp.requestedAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{rp.approvedAmount ? `Rs. ${rp.approvedAmount.toLocaleString()}` : "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={riderPaymentStatusColor[rp.status] ?? ""}>
                                {rp.status === "released" && <CheckCircle className="mr-1 h-3 w-3" />}
                                {rp.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                                {rp.status.charAt(0).toUpperCase() + rp.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {rp.referenceId ? <div>Ref: {rp.referenceId}</div> : "—"}
                              {rp.paymentDate && <div className="text-xs">{rp.paymentDate}</div>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(rp.createdAt), "MMM d, yyyy")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
                                  onClick={() => { setViewingRiderPayment(rp); setRiderViewAdminNote(""); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {rp.status === "pending" && (
                                  <>
                                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50"
                                      onClick={() => { setSelectedRiderPayment(rp); setRiderActionType("reject"); setRiderReleaseDialogOpen(true); }}>
                                      Reject
                                    </Button>
                                    <Button size="sm"
                                      onClick={() => { setSelectedRiderPayment(rp); setRiderActionType("release"); setRiderReleaseDialogOpen(true); }}>
                                      Release
                                    </Button>
                                  </>
                                )}
                              </div>
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

      {/* Rider Payment Release/Reject Dialog */}
      <Dialog open={riderReleaseDialogOpen} onOpenChange={open => { if (!open) { setRiderReleaseDialogOpen(false); setSelectedRiderPayment(null); setRiderActionType(null); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleRiderAction}>
            <DialogHeader>
              <DialogTitle className={riderActionType === "release" ? "text-primary" : "text-red-600"}>
                {riderActionType === "release" ? "Release Commission Payment" : "Reject Payment Request"}
              </DialogTitle>
              <DialogDescription>
                Rider: <strong>{selectedRiderPayment?.riderName}</strong> — Requested: <strong>Rs. {selectedRiderPayment?.requestedAmount?.toLocaleString()}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {riderActionType === "release" && (
                <>
                  <div className="space-y-2">
                    <Label>Approved Amount (Rs.) *</Label>
                    <Input name="approvedAmount" type="number" defaultValue={selectedRiderPayment?.requestedAmount} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Reference / Txn ID *</Label>
                    <Input name="referenceId" required placeholder="e.g. NPSF2024123456" />
                  </div>
                  <div className="space-y-2">
                    <Label>Transfer Date *</Label>
                    <Input name="paymentDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Note (optional)</Label>
                    <Input name="releaseNote" placeholder="Optional note to rider" />
                  </div>
                </>
              )}
              {riderActionType === "reject" && (
                <div className="rounded-md bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                  This will reject the rider's payment request. They will be notified.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setRiderReleaseDialogOpen(false); setSelectedRiderPayment(null); setRiderActionType(null); }}>Cancel</Button>
              <Button type="submit" variant={riderActionType === "reject" ? "destructive" : "default"} disabled={riderActionPending}>
                {riderActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {riderActionType === "release" ? "Confirm Release" : "Reject Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor Request Payment Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent>
          <form onSubmit={handleRequestSubmit}>
            <DialogHeader>
              <DialogTitle>Request Payment</DialogTitle>
              <DialogDescription>
                Submit a payment request. Available balance: Rs. {codSummary?.pendingRelease?.toLocaleString() ?? 0}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Pay to Bank Account</Label>
                {bankAccounts && bankAccounts.length > 0 ? (
                  <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((acc: any) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.bankName} — {acc.accountNumber} ({acc.accountHolder})
                          {acc.isDefault ? " ★" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-destructive">
                    No bank accounts linked. Please add one using "Manage Bank Accounts".
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Requested Amount (Rs.)</Label>
                <Input
                  name="requestedAmount"
                  type="number"
                  min={1}
                  max={codSummary?.pendingRelease}
                  defaultValue={codSummary?.pendingRelease ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Note (Optional)</Label>
                <Textarea
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !selectedBankAccountId || !bankAccounts?.length}
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bank Accounts Management Dialog */}
      <Dialog open={isBankDialogOpen} onOpenChange={(open) => { setIsBankDialogOpen(open); if (!open) { setBankFormOpen(false); setEditingAccount(null); } }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Bank Accounts
            </DialogTitle>
            <DialogDescription>Your linked accounts for COD remittance.</DialogDescription>
          </DialogHeader>

          {!bankFormOpen ? (
            <>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {bankAccountsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : bankAccounts && bankAccounts.length > 0 ? (
                  bankAccounts.map((account: any) => (
                    <div key={account.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Building className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {account.bankName}
                            {account.isDefault && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Default</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {account.accountHolderName} · {account.accountNumber}
                            {account.branch ? ` · ${account.branch}` : ""}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEditBankForm(account)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No bank accounts added yet.</p>
                )}
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="outline" onClick={openAddBankForm}>
                  <Plus className="mr-2 h-4 w-4" /> Add New Account
                </Button>
                <Button variant="ghost" onClick={() => setIsBankDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={handleBankSave}>
              <div className="grid gap-4 py-2">
                <h3 className="font-medium text-sm">{editingAccount ? "Edit Account" : "New Bank Account"}</h3>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank / Wallet Name *</Label>
                  <Input id="bankName" name="bankName" defaultValue={editingAccount?.bankName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                  <Input id="accountHolderName" name="accountHolderName" defaultValue={editingAccount?.accountHolderName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input id="accountNumber" name="accountNumber" defaultValue={editingAccount?.accountNumber} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Input id="branch" name="branch" defaultValue={editingAccount?.branch} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="walletMethod">Wallet Method</Label>
                    <Input id="walletMethod" name="walletMethod" defaultValue={editingAccount?.walletMethod} />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    name="isDefault"
                    defaultChecked={editingAccount?.isDefault}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="isDefault" className="font-normal cursor-pointer">Set as default account for payments</Label>
                </div>
              </div>
              <DialogFooter className="sm:justify-between mt-4">
                <Button type="button" variant="ghost" onClick={() => { setBankFormOpen(false); setEditingAccount(null); }}>
                  ← Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsBankDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createBankMutation.isPending || updateBankMutation.isPending}>
                    {(createBankMutation.isPending || updateBankMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Payment Request Dialog */}
      <Dialog open={!!viewingPayment} onOpenChange={(open) => { if (!open) { setViewingPayment(null); setViewOrders([]); } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Payment Request Details
            </DialogTitle>
            <DialogDescription>
              Submitted on {viewingPayment && format(new Date(viewingPayment.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {viewingPayment && (
            <div className="space-y-5 py-2">
              {/* Party & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Vendor / Party</p>
                  <p className="font-semibold text-base">{viewingPayment.vendorName}</p>
                </div>
                <div className="rounded-lg border bg-primary/5 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Requested Amount</p>
                  <p className="font-bold text-xl text-primary">Rs. {viewingPayment.requestedAmount.toLocaleString()}</p>
                  {viewingPayment.approvedAmount && (
                    <p className="text-xs text-emerald-700">Approved: Rs. {viewingPayment.approvedAmount.toLocaleString()}</p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={
                  viewingPayment.status === 'pending' ? 'secondary' :
                  viewingPayment.status === 'approved' ? 'default' :
                  viewingPayment.status === 'released' ? 'outline' : 'destructive'
                } className={viewingPayment.status === 'released' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 capitalize' : 'capitalize'}>
                  {viewingPayment.status === 'released' && <CheckCircle className="mr-1 h-3 w-3" />}
                  {viewingPayment.status}
                </Badge>
                {viewingPayment.reviewedByName && (
                  <span className="text-xs text-muted-foreground">by {viewingPayment.reviewedByName}</span>
                )}
              </div>

              {/* Bank Account Details */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" /> Bank / Wallet Details
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-muted-foreground">Bank Name:</span>{" "}
                    <span className="font-medium">{viewingPayment.bankName ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Account Holder:</span>{" "}
                    <span className="font-medium">{viewingPayment.accountHolderName ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Account No:</span>{" "}
                    <span className="font-mono font-semibold">{viewingPayment.accountNumber ?? "—"}</span>
                  </div>
                  {viewingPayment.bankBranch && (
                    <div>
                      <span className="text-muted-foreground">Branch:</span>{" "}
                      <span className="font-medium">{viewingPayment.bankBranch}</span>
                    </div>
                  )}
                  {viewingPayment.walletMethod && (
                    <div>
                      <span className="text-muted-foreground">Wallet:</span>{" "}
                      <span className="font-medium">{viewingPayment.walletMethod}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vendor note */}
              {viewingPayment.note && (
                <div className="rounded-lg border bg-yellow-50 border-yellow-100 px-3 py-2 text-sm text-yellow-800">
                  <span className="font-medium">Vendor Note:</span> {viewingPayment.note}
                </div>
              )}

              {/* Release Info */}
              {viewingPayment.status === 'released' && viewingPayment.referenceId && (
                <div className="rounded-lg border bg-emerald-50 border-emerald-100 px-3 py-2 text-sm text-emerald-800 space-y-1">
                  <div><span className="font-medium">Txn Ref:</span> {viewingPayment.referenceId}</div>
                  {viewingPayment.paymentDate && <div><span className="font-medium">Transfer Date:</span> {viewingPayment.paymentDate}</div>}
                  {viewingPayment.releaseNote && <div><span className="font-medium">Note:</span> {viewingPayment.releaseNote}</div>}
                </div>
              )}

              {/* Linked Orders — COD breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Order Breakdown
                    {!viewOrdersLoading && viewOrders.length > 0 && (
                      <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-bold">{viewOrders.length}</span>
                    )}
                  </p>
                  {viewOrders.length > 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => downloadPaymentPdf(viewingPayment, viewOrders)}>
                      <Download className="h-3 w-3" /> Download PDF
                    </Button>
                  )}
                </div>
                {viewOrdersLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : viewOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">No orders linked to this payment request.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[260px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs py-2 w-8">SN</TableHead>
                            <TableHead className="text-xs py-2">Order #</TableHead>
                            <TableHead className="text-xs py-2">Customer</TableHead>
                            <TableHead className="text-xs py-2 text-right">COD</TableHead>
                            <TableHead className="text-xs py-2 text-right">Delivery</TableHead>
                            <TableHead className="text-xs py-2 text-right">Net</TableHead>
                            <TableHead className="text-xs py-2">Rider</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewOrders.map((o: any, idx: number) => (
                            <TableRow key={o.id} className="text-sm">
                              <TableCell className="py-1.5 text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="py-1.5 font-mono text-xs text-primary">{o.orderCode}</TableCell>
                              <TableCell className="py-1.5 text-xs">
                                <div>{o.customerName}</div>
                                <div className="text-muted-foreground">{o.customerPhone}</div>
                              </TableCell>
                              <TableCell className="py-1.5 text-right text-xs">{Number(o.codAmount).toLocaleString()}</TableCell>
                              <TableCell className="py-1.5 text-right text-xs text-red-600">-{Number(o.deliveryCharge).toLocaleString()}</TableCell>
                              <TableCell className="py-1.5 text-right text-xs font-semibold text-emerald-700">{Number(o.vendorPayable).toLocaleString()}</TableCell>
                              <TableCell className="py-1.5 text-xs text-muted-foreground">{o.riderName ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="border-t bg-muted/30 px-3 py-2 grid grid-cols-4 gap-1 text-xs">
                      <span className="text-muted-foreground col-span-1">{viewOrders.length} order{viewOrders.length !== 1 ? "s" : ""}</span>
                      <span className="text-right">COD: <strong>Rs. {viewOrders.reduce((s: number, o: any) => s + Number(o.codAmount), 0).toLocaleString()}</strong></span>
                      <span className="text-right text-red-600">Delivery: <strong>-Rs. {viewOrders.reduce((s: number, o: any) => s + Number(o.deliveryCharge), 0).toLocaleString()}</strong></span>
                      <span className="text-right text-emerald-700">Net: <strong>Rs. {viewOrders.reduce((s: number, o: any) => s + Number(o.vendorPayable), 0).toLocaleString()}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Note Section */}
          {viewingPayment && (
            <div className="px-1 pb-1 space-y-2">
              {viewingPayment.adminNote && (
                <div className="rounded-lg border bg-blue-50 border-blue-100 px-3 py-2 text-sm text-blue-800">
                  <span className="font-medium">Admin Note:</span> {viewingPayment.adminNote}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Send a note to vendor (no status change)</Label>
                <Textarea
                  placeholder="Type a note for the vendor..."
                  value={viewAdminNote}
                  onChange={e => setViewAdminNote(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!viewAdminNote.trim() || viewNoteSending}
                  onClick={async () => {
                    setViewNoteSending(true);
                    await sendAdminNote("vendor", viewingPayment.id, viewAdminNote, () => {});
                    setViewNoteSending(false);
                  }}
                >
                  {viewNoteSending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
                  Send Note
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => { setViewingPayment(null); setViewOrders([]); }}>Close</Button>
            {viewingPayment?.status === 'pending' && (
              <div className="flex gap-2">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setSelectedPayment(viewingPayment); setActionType('reject'); setViewingPayment(null); }}>
                  Reject
                </Button>
                <Button onClick={() => { setSelectedPayment(viewingPayment); setActionType('approve'); setViewingPayment(null); }}>
                  Approve
                </Button>
              </div>
            )}
            {viewingPayment?.status === 'approved' && (
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelectedPayment(viewingPayment); setActionType('release'); setViewingPayment(null); }}>
                Mark Released
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rider Payment Request View Dialog */}
      <Dialog open={!!viewingRiderPayment} onOpenChange={(open) => { if (!open) setViewingRiderPayment(null); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Rider Payment Request
            </DialogTitle>
            <DialogDescription>
              Submitted on {viewingRiderPayment && format(new Date(viewingRiderPayment.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {viewingRiderPayment && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rider</p>
                  <p className="font-semibold text-base">{viewingRiderPayment.riderName}</p>
                  <p className="text-xs text-muted-foreground">{viewingRiderPayment.riderEmail}</p>
                </div>
                <div className="rounded-lg border bg-primary/5 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Requested</p>
                  <p className="font-bold text-xl text-primary">Rs. {viewingRiderPayment.requestedAmount.toLocaleString()}</p>
                  {viewingRiderPayment.approvedAmount && (
                    <p className="text-xs text-emerald-700">Approved: Rs. {viewingRiderPayment.approvedAmount.toLocaleString()}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant="outline" className={riderPaymentStatusColor[viewingRiderPayment.status] ?? ""}>
                  {viewingRiderPayment.status === "released" && <CheckCircle className="mr-1 h-3 w-3" />}
                  {viewingRiderPayment.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                  {viewingRiderPayment.status.charAt(0).toUpperCase() + viewingRiderPayment.status.slice(1)}
                </Badge>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" /> Bank Details
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{viewingRiderPayment.bankName}</span></div>
                  <div><span className="text-muted-foreground">Account:</span> <span className="font-mono font-semibold">{viewingRiderPayment.accountNumber}</span></div>
                </div>
              </div>

              {viewingRiderPayment.note && (
                <div className="rounded-lg border bg-yellow-50 border-yellow-100 px-3 py-2 text-sm text-yellow-800">
                  <span className="font-medium">Rider Note:</span> {viewingRiderPayment.note}
                </div>
              )}

              {/* Commission Breakdown */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> Commission Breakdown
                  {viewingRiderPayment.commissions?.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-bold">{viewingRiderPayment.commissions.length}</span>
                  )}
                </p>
                {!viewingRiderPayment.commissions?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-3 border rounded-md">No commission records linked to this request.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs py-2">Order</TableHead>
                            <TableHead className="text-xs py-2">Customer</TableHead>
                            <TableHead className="text-xs py-2 text-right">Commission</TableHead>
                            <TableHead className="text-xs py-2">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingRiderPayment.commissions.map((c: any) => (
                            <TableRow key={c.id} className="text-sm">
                              <TableCell className="py-1.5 font-mono text-xs text-primary">{c.orderCode}</TableCell>
                              <TableCell className="py-1.5 text-xs truncate max-w-[100px]">{c.customerName}</TableCell>
                              <TableCell className="py-1.5 text-right font-semibold">Rs. {c.amount.toLocaleString()}</TableCell>
                              <TableCell className="py-1.5">
                                <Badge variant="outline" className={`text-xs ${c.status === "paid" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                                  {c.status === "paid" ? <CheckCircle className="mr-1 h-2.5 w-2.5" /> : null}
                                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="border-t bg-muted/30 px-3 py-2 flex justify-between text-sm">
                      <span className="text-muted-foreground">{viewingRiderPayment.commissions.length} order{viewingRiderPayment.commissions.length !== 1 ? "s" : ""}</span>
                      <span className="font-bold text-primary">
                        Total: Rs. {viewingRiderPayment.commissions.reduce((s: number, c: any) => s + c.amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {viewingRiderPayment.status === "released" && (viewingRiderPayment.referenceId || viewingRiderPayment.releaseNote) && (
                <div className="rounded-lg border bg-emerald-50 border-emerald-100 px-3 py-2 text-sm text-emerald-800 space-y-1">
                  {viewingRiderPayment.referenceId && <div><span className="font-medium">Ref:</span> {viewingRiderPayment.referenceId}</div>}
                  {viewingRiderPayment.paymentDate && <div><span className="font-medium">Date:</span> {viewingRiderPayment.paymentDate}</div>}
                  {viewingRiderPayment.releaseNote && <div><span className="font-medium">Note:</span> {viewingRiderPayment.releaseNote}</div>}
                </div>
              )}

              {/* Admin Note Section */}
              <div className="space-y-1.5 border-t pt-3">
                {viewingRiderPayment.adminNote && (
                  <div className="rounded-lg border bg-blue-50 border-blue-100 px-3 py-2 text-sm text-blue-800 mb-2">
                    <span className="font-medium">Admin Note:</span> {viewingRiderPayment.adminNote}
                  </div>
                )}
                <Label className="text-xs text-muted-foreground">Send a note to rider (no status change)</Label>
                <Textarea
                  placeholder="Type a note for the rider..."
                  value={riderViewAdminNote}
                  onChange={e => setRiderViewAdminNote(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!riderViewAdminNote.trim() || riderViewNoteSending}
                  onClick={async () => {
                    setRiderViewNoteSending(true);
                    await sendAdminNote("rider", viewingRiderPayment.id, riderViewAdminNote, () => {});
                    setRiderViewNoteSending(false);
                  }}
                >
                  {riderViewNoteSending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
                  Send Note
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setViewingRiderPayment(null)}>Close</Button>
            {viewingRiderPayment?.status === "pending" && (
              <div className="flex gap-2">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => { setSelectedRiderPayment(viewingRiderPayment); setRiderActionType("reject"); setRiderReleaseDialogOpen(true); setViewingRiderPayment(null); }}>
                  Reject
                </Button>
                <Button
                  onClick={() => { setSelectedRiderPayment(viewingRiderPayment); setRiderActionType("release"); setRiderReleaseDialogOpen(true); setViewingRiderPayment(null); }}>
                  Release
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Action Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent>
          <form onSubmit={handleActionConfirm}>
            <DialogHeader>
              <DialogTitle className="capitalize">{actionType} Payment Request</DialogTitle>
              <DialogDescription>
                {actionType === 'approve' && `Approve request for Rs. ${selectedPayment?.requestedAmount.toLocaleString()}`}
                {actionType === 'release' && `Mark Rs. ${selectedPayment?.approvedAmount?.toLocaleString()} as transferred.`}
                {actionType === 'reject' && `Reject this payment request.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {actionType === 'approve' && (
                <div className="space-y-2">
                  <Label>Approved Amount (Rs.)</Label>
                  <Input name="approvedAmount" type="number" defaultValue={selectedPayment?.requestedAmount} required />
                </div>
              )}
              {actionType === 'release' && (
                <>
                  <div className="space-y-2">
                    <Label>Bank Reference / Txn ID</Label>
                    <Input name="referenceId" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Transfer Date</Label>
                    <Input name="paymentDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Note (Optional)</Label>
                    <Input name="releaseNote" />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedPayment(null)}>Cancel</Button>
              <Button type="submit" variant={actionType === 'reject' ? 'destructive' : 'default'} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
