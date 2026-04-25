import { useState } from "react";
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
import { Loader2, Plus, DollarSign, Wallet, CreditCard, Building, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
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

      <Card>
        <CardHeader>
          <CardTitle>Payment Requests</CardTitle>
          <CardDescription>History of all payment requests and their status.</CardDescription>
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
                    {!isVendor && <TableHead>Vendor</TableHead>}
                    <TableHead>Account Info</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead>Status</TableHead>
                    {!isVendor && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isVendor ? 5 : 7} className="text-center py-8 text-muted-foreground">No payment requests found.</TableCell>
                    </TableRow>
                  ) : (
                    payments?.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {format(new Date(payment.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        {!isVendor && <TableCell>{payment.vendorName}</TableCell>}
                        <TableCell>
                          <div className="text-sm max-w-[200px] truncate">{payment.bankAccountInfo}</div>
                          {payment.referenceId && <div className="text-xs text-muted-foreground">Ref: {payment.referenceId}</div>}
                        </TableCell>
                        <TableCell className="text-right">Rs. {payment.requestedAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {payment.approvedAmount ? `Rs. ${payment.approvedAmount.toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            payment.status === 'pending' ? 'secondary' : 
                            payment.status === 'approved' ? 'default' : 
                            payment.status === 'released' ? 'outline' : 'destructive'
                          } className={payment.status === 'released' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        {!isVendor && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
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
