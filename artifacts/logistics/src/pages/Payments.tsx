import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListPaymentRequests, useCreatePaymentRequest, useUpdatePaymentRequest, useGetCodSummary, getListPaymentRequestsQueryKey, getGetCodSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, DollarSign, Wallet, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Payments() {
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const vendorId = isVendor && user?.vendorId ? user.vendorId : undefined;
  
  const { data: payments, isLoading } = useListPaymentRequests({ vendorId });
  const { data: codSummary } = useGetCodSummary({ query: { vendorId } });
  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "release" | null>(null);
  
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

  const handleRequestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      bankAccountId: Number(formData.get("bankAccountId")),
      requestedAmount: Number(formData.get("requestedAmount")),
      note: formData.get("note") as string || null
    };

    createMutation.mutate({ data });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments & Remittances</h2>
          <p className="text-muted-foreground">Manage COD releases and payment requests.</p>
        </div>
        {isVendor && (
          <Button onClick={() => setIsRequestDialogOpen(true)} disabled={!codSummary || codSummary.pendingRelease <= 0}>
            <Plus className="mr-2 h-4 w-4" /> Request Payment
          </Button>
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
