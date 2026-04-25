import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wallet, TrendingUp, CreditCard, Plus, Trash2, Send, CheckCircle, Clock, XCircle, DollarSign } from "lucide-react";
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
  const [commissions, setCommissions] = useState<any[]>([]);
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
      setCommissions(Array.isArray(commData.entries) ? commData.entries : []);
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

  const fmtAmt = (n: number) => `Rs. ${n.toLocaleString("en-NP")}`;

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

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Payment Requests</TabsTrigger>
          <TabsTrigger value="banks">Bank Accounts</TabsTrigger>
          <TabsTrigger value="commissions">Commission Log</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : commissions.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">No commissions yet</p>
                  <p className="text-sm mt-1">Commissions are added automatically after each successful delivery.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.orderCode || `#${c.orderId}`}</TableCell>
                          <TableCell className="text-right font-bold text-green-700">{fmtAmt(c.amount)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{format(new Date(c.createdAt), "dd MMM yyyy HH:mm")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardContent className="p-0">
              {paymentRequests.length === 0 ? (
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
