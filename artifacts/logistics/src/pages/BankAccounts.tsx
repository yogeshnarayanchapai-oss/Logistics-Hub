import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListBankAccounts, useCreateBankAccount, useUpdateBankAccount, getListBankAccountsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function BankAccounts() {
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const vendorId = isVendor && user?.vendorId ? user.vendorId : undefined;
  
  const { data: bankAccounts, isLoading } = useListBankAccounts({ vendorId });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateBankAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBankAccountsQueryKey() });
        toast({ title: "Bank account added successfully" });
        setIsDialogOpen(false);
      }
    }
  });

  const updateMutation = useUpdateBankAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBankAccountsQueryKey() });
        toast({ title: "Bank account updated successfully" });
        setIsDialogOpen(false);
      }
    }
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      vendorId: isVendor && user.vendorId ? user.vendorId : Number(formData.get("vendorId")),
      accountHolderName: formData.get("accountHolderName") as string,
      bankName: formData.get("bankName") as string,
      branch: formData.get("branch") as string || null,
      accountNumber: formData.get("accountNumber") as string,
      walletMethod: formData.get("walletMethod") as string || null,
      remarks: formData.get("remarks") as string || null,
      isDefault: formData.get("isDefault") === "on"
    };

    if (editingAccount) {
      // Create a clean payload without vendorId for update
      const { vendorId: _, ...updateData } = data;
      updateMutation.mutate({ id: editingAccount.id, data: updateData });
    } else {
      createMutation.mutate({ data });
    }
  };

  const openNewDialog = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (account: any) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bank Accounts</h2>
          <p className="text-muted-foreground">Manage accounts for COD remittance.</p>
        </div>
        <Button onClick={openNewDialog}><Plus className="mr-2 h-4 w-4" /> Add Account</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Linked Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank / Wallet</TableHead>
                    <TableHead>Account Holder</TableHead>
                    <TableHead>Account Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No bank accounts found.</TableCell>
                    </TableRow>
                  ) : (
                    bankAccounts?.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {account.bankName}
                          </div>
                          {account.walletMethod && <div className="text-xs text-muted-foreground">{account.walletMethod}</div>}
                        </TableCell>
                        <TableCell>{account.accountHolderName}</TableCell>
                        <TableCell>
                          <div className="text-sm">{account.accountNumber}</div>
                          {account.branch && <div className="text-xs text-muted-foreground">Branch: {account.branch}</div>}
                        </TableCell>
                        <TableCell>
                          {account.isDefault ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">Default</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(account)}>Edit</Button>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingAccount ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
              <DialogDescription>
                {editingAccount ? "Update the account details below." : "Enter details for the new bank or wallet account."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!isVendor && !editingAccount && (
                <div className="space-y-2">
                  <Label htmlFor="vendorId">Vendor ID *</Label>
                  <Input id="vendorId" name="vendorId" type="number" required />
                </div>
              )}
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
              <div className="flex items-center space-x-2 mt-2">
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
