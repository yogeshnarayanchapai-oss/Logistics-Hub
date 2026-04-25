import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wallet, TrendingUp, CreditCard, Plus, Trash2, Send, CheckCircle, Clock, XCircle, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  released: "bg-green-100 text-green-700 border-green-300",
  rejected: "bg-red-100 text-red-700 border-red-300",
};

const statusIcon: Record<string, any> = {
  pending: Clock,
  released: CheckCircle,
  rejected: XCircle,
};

export default function RiderPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const token = () => localStorage.getItem("authToken");

  const [summary, setSummary] = useState({ totalEarned: 0, totalReleased: 0, pendingBalance: 0, totalOrders: 0 });
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [commRes, bankRes, payRes] = await Promise.all([
        fetch(`${BASE}/api/rider-commissions`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${BASE}/api/rider-bank-accounts`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${BASE}/api/rider-payment-requests`, { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      const commData = await commRes.json();
      const bankData = await bankRes.json();
      const payData = await payRes.json();
      setSummary(commData.summary ?? { totalEarned: 0, totalReleased: 0, pendingBalance: 0, totalOrders: 0 });
      setBankAccounts(Array.isArray(bankData) ? bankData : []);
      setPaymentRequests(Array.isArray(payData) ? payData : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddBank = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/rider-bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          accountHolderName: fd.get("accountHolderName"),
          bankName: fd.get("bankName"),
          branch: fd.get("branch") || null,
          accountNumber: fd.get("accountNumber"),
          walletMethod: fd.get("walletMethod") || null,
          remarks: fd.get("remarks") || null,
          isDefault: bankAccounts.length === 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: "Bank account added" });
      setBankDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: err.message || "Failed to add account", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleDeleteBank = async (id: number) => {
    try {
      await fetch(`${BASE}/api/rider-bank-accounts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      toast({ title: "Account removed" });
      fetchAll();
    } catch { toast({ title: "Failed to remove account", variant: "destructive" }); }
  };

  const handleRequestPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBankId || !requestAmount || Number(requestAmount) <= 0) {
      toast({ title: "Select bank account and enter amount", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/rider-payment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ bankAccountId: selectedBankId, requestedAmount: Number(requestAmount), note: requestNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: "Payment request submitted" });
      setRequestDialogOpen(false);
      setRequestAmount("");
      setRequestNote("");
      fetchAll();
    } catch (err: any) {
      toast({ title: err.message || "Failed to submit request", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const downloadRiderPdf = (request: any) => {
    const commissions: any[] = request.commissions ?? [];
    const total = commissions.reduce((s: number, c: any) => s + Number(c.amount), 0);

    const rows = commissions.map((c: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${c.orderCode}</td>
        <td>${c.customerName ?? "—"}</td>
        <td>${c.productName ?? "—"}</td>
        <td class="num">Rs. ${Number(c.amount).toLocaleString()}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Commission Statement - ${user?.name ?? "Rider"}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
        h2 { margin: 0 0 4px; } p { margin: 2px 0; color: #555; }
        .header { margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #d1d5db; font-size: 11px; }
        td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
        .num { text-align: right; }
        tfoot td { font-weight: bold; background: #f9fafb; }
        .meta { display: flex; gap: 40px; margin-top: 12px; font-size: 11px; color: #6b7280; }
      </style></head><body>
      <div class="header">
        <h2>Commission Payment Statement</h2>
        <p>Rider: <strong>${request.riderName}</strong></p>
        <p>Request Date: ${new Date(request.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
        ${request.referenceId ? `<p>Transfer Ref: <strong>${request.referenceId}</strong></p>` : ""}
        ${request.paymentDate ? `<p>Payment Date: ${request.paymentDate}</p>` : ""}
        ${request.approvedAmount ? `<p>Amount Paid: <strong>Rs. ${Number(request.approvedAmount).toLocaleString()}</strong></p>` : ""}
        <p>Bank: ${request.bankName} &nbsp;|&nbsp; Account: ${request.accountNumber}</p>
      </div>
      <table>
        <thead><tr><th>SN</th><th>Order #</th><th>Customer</th><th>Product</th><th class="num">Commission</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="4">Total (${commissions.length} orders)</td>
          <td class="num">Rs. ${total.toLocaleString()}</td>
        </tr></tfoot>
      </table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const fmtAmt = (n: number) => `Rs. ${n.toLocaleString("en-NP")}`;

  const releasedRequests = paymentRequests.filter(r => r.status === "released");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground">Your commission earnings and payment history.</p>
        </div>
        <Button onClick={() => setRequestDialogOpen(true)} disabled={bankAccounts.length === 0 || summary.pendingBalance <= 0}>
          <Send className="mr-2 h-4 w-4" /> Request Payment
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{fmtAmt(summary.totalEarned)}</div>
            <p className="text-xs text-muted-foreground">{summary.totalOrders} deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Released</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{fmtAmt(summary.totalReleased)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
            <Wallet className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{fmtAmt(summary.pendingBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bank Accounts</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bankAccounts.length}</div>
            <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setBankDialogOpen(true)}>+ Add account</Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received"><CheckCircle className="mr-1.5 h-4 w-4" /> Received Payments</TabsTrigger>
          <TabsTrigger value="requests"><Send className="mr-1.5 h-4 w-4" /> Payment Requests</TabsTrigger>
          <TabsTrigger value="banks"><CreditCard className="mr-1.5 h-4 w-4" /> Bank Accounts</TabsTrigger>
        </TabsList>

        {/* ── Received / Released Payments ── */}
        <TabsContent value="received">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : releasedRequests.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">No payments received yet</p>
                  <p className="text-sm mt-1">Payments released by admin will appear here with full breakdown.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">S.No</TableHead>
                        <TableHead>Transfer ID / Ref</TableHead>
                        <TableHead>Payment Date</TableHead>
                        <TableHead className="text-right">Amount (Rs.)</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead className="text-center">Orders</TableHead>
                        <TableHead className="text-center">PDF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {releasedRequests.map((r, idx) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-mono font-semibold">{r.referenceId || "—"}</div>
                            {r.releaseNote && <div className="text-xs text-muted-foreground mt-0.5">{r.releaseNote}</div>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.paymentDate ? r.paymentDate : format(new Date(r.createdAt), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-700 text-base">
                            Rs. {(r.approvedAmount ?? r.requestedAmount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{r.bankName}</div>
                            <div className="text-xs text-muted-foreground">{r.accountNumber}</div>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {r.commissions?.length ?? 0}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 h-8 w-8 p-0"
                              onClick={() => downloadRiderPdf(r)} title="Download PDF">
                              <Download className="h-4 w-4" />
                            </Button>
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

        {/* ── Payment Requests ── */}
        <TabsContent value="requests">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : paymentRequests.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <Send className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">No payment requests yet</p>
                  <p className="text-sm mt-1">Click "Request Payment" to withdraw your commission balance.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentRequests.map(r => {
                        const Icon = statusIcon[r.status] ?? Clock;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-semibold">{fmtAmt(r.requestedAmount)}</TableCell>
                            <TableCell className="text-sm">
                              <div>{r.bankName}</div>
                              <div className="text-muted-foreground text-xs">{r.accountNumber}</div>
                            </TableCell>
                            <TableCell>{r.approvedAmount ? fmtAmt(r.approvedAmount) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusColor[r.status] ?? ""}>
                                <Icon className="mr-1 h-3 w-3" />
                                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">{r.referenceId || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{format(new Date(r.createdAt), "dd MMM yyyy")}</TableCell>
                            <TableCell className="max-w-[160px]">
                              {r.adminNote
                                ? <span className="text-xs text-blue-700 line-clamp-2">{r.adminNote}</span>
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
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

        {/* ── Bank Accounts ── */}
        <TabsContent value="banks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base">My Bank Accounts</CardTitle>
              <Button size="sm" onClick={() => setBankDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Account
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {bankAccounts.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground pb-6">
                  <CreditCard className="h-10 w-10 mb-2 opacity-20" />
                  <p>No bank accounts added yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Holder</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bankAccounts.map(acc => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.accountHolderName}</TableCell>
                          <TableCell>
                            <div>{acc.bankName}</div>
                            {acc.branch && <div className="text-xs text-muted-foreground">{acc.branch}</div>}
                          </TableCell>
                          <TableCell>{acc.accountNumber}</TableCell>
                          <TableCell>{acc.walletMethod || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteBank(acc.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
      </Tabs>

      {/* Add Bank Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <form onSubmit={handleAddBank}>
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
              <DialogDescription>Add a bank account to receive your commission payments.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                <Input id="accountHolderName" name="accountHolderName" required placeholder="Full name as on bank account" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name *</Label>
                  <Input id="bankName" name="bankName" required placeholder="e.g. NIC Asia" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input id="branch" name="branch" placeholder="e.g. Kathmandu" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number *</Label>
                <Input id="accountNumber" name="accountNumber" required placeholder="e.g. 0075291234567890" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="walletMethod">Mobile Wallet (optional)</Label>
                <Input id="walletMethod" name="walletMethod" placeholder="e.g. eSewa 9841234567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Input id="remarks" name="remarks" placeholder="Optional note" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBankDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Payment Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleRequestPayment}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <Send className="h-5 w-5" /> Request Commission Payment
              </DialogTitle>
              <DialogDescription>
                Pending balance: <strong className="text-amber-700">{`Rs. ${summary.pendingBalance.toLocaleString("en-NP")}`}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Bank Account *</Label>
                <select
                  value={selectedBankId}
                  onChange={e => setSelectedBankId(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Select account —</option>
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.bankName} — {acc.accountNumber}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reqAmt">Amount (Rs.) *</Label>
                <Input
                  id="reqAmt" type="number" min="1" max={summary.pendingBalance}
                  value={requestAmount} onChange={e => setRequestAmount(e.target.value)}
                  placeholder={`Max: ${summary.pendingBalance}`} required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reqNote">Note (optional)</Label>
                <Input id="reqNote" value={requestNote} onChange={e => setRequestNote(e.target.value)} placeholder="Optional message to admin" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
