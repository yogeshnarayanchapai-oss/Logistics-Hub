import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useChangePassword,
  useListBankAccounts, useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount,
  getListBankAccountsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Phone, MapPin, Building2, Truck, Shield, Plus, Pencil, Trash2, Building, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function VendorBankSection({ vendorId }: { vendorId: number }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useListBankAccounts({ vendorId });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListBankAccountsQueryKey() });

  const createMutation = useCreateBankAccount({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Bank account added" }); setIsFormOpen(false); setEditingAccount(null); }
    }
  });
  const updateMutation = useUpdateBankAccount({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Bank account updated" }); setIsFormOpen(false); setEditingAccount(null); }
    }
  });
  const deleteMutation = useDeleteBankAccount({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Account removed" }); setDeleteTarget(null); },
      onError: () => { toast({ title: "Delete failed", variant: "destructive" }); setDeleteTarget(null); }
    }
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      accountHolderName: fd.get("accountHolderName") as string,
      bankName: fd.get("bankName") as string,
      branch: fd.get("branch") as string || null,
      accountNumber: fd.get("accountNumber") as string,
      walletMethod: fd.get("walletMethod") as string || null,
      remarks: fd.get("remarks") as string || null,
      isDefault: fd.get("isDefault") === "on",
    };
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: payload });
    } else {
      createMutation.mutate({ data: { ...payload, vendorId } });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-4 w-4" /> My Bank Accounts
              </CardTitle>
              <CardDescription>Accounts used for receiving COD payments.</CardDescription>
            </div>
            <Button size="sm" onClick={() => { setEditingAccount(null); setIsFormOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !accounts?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No bank accounts linked yet.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank / Wallet</TableHead>
                    <TableHead>Account No.</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell>
                        <div className="font-medium">{acc.bankName}</div>
                        <div className="text-xs text-muted-foreground">{acc.accountHolderName}</div>
                        {acc.walletMethod && <div className="text-xs text-muted-foreground">{acc.walletMethod}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{acc.accountNumber}</TableCell>
                      <TableCell>{acc.branch || "—"}</TableCell>
                      <TableCell>
                        {acc.isDefault && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingAccount(acc); setIsFormOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget({ id: acc.id, name: acc.bankName })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      {/* Add / Edit form */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) { setIsFormOpen(false); setEditingAccount(null); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingAccount ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
              <DialogDescription>
                {editingAccount ? "Update account details below." : "Add a new payment account."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="p-bankName">Bank / Wallet Name *</Label>
                <Input id="p-bankName" name="bankName" defaultValue={editingAccount?.bankName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-accountHolderName">Account Holder Name *</Label>
                <Input id="p-accountHolderName" name="accountHolderName" defaultValue={editingAccount?.accountHolderName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-accountNumber">Account Number *</Label>
                <Input id="p-accountNumber" name="accountNumber" defaultValue={editingAccount?.accountNumber} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-branch">Branch</Label>
                  <Input id="p-branch" name="branch" defaultValue={editingAccount?.branch} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-walletMethod">Wallet Method</Label>
                  <Input id="p-walletMethod" name="walletMethod" placeholder="e.g. eSewa" defaultValue={editingAccount?.walletMethod} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-remarks">Remarks</Label>
                <Input id="p-remarks" name="remarks" defaultValue={editingAccount?.remarks} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="p-isDefault" name="isDefault"
                  defaultChecked={editingAccount?.isDefault}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <Label htmlFor="p-isDefault" className="font-normal cursor-pointer">Set as default account</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); setEditingAccount(null); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Bank Account</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.name}</strong> from your accounts?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useChangePassword({
    mutation: {
      onSuccess: () => {
        toast({ title: "Password changed successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      },
      onError: (error: any) => {
        toast({
          title: "Failed to change password",
          description: error.message || "Please check your current password",
          variant: "destructive"
        });
      }
    }
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ data: { currentPassword, newPassword } });
  };

  if (!user) return null;

  const getRoleIcon = () => {
    switch (user.role) {
      case 'admin': return <Shield className="h-5 w-5 text-red-500" />;
      case 'vendor': return <Building2 className="h-5 w-5 text-purple-500" />;
      case 'rider': return <Truck className="h-5 w-5 text-green-500" />;
      case 'manager': return <Shield className="h-5 w-5 text-orange-500" />;
      default: return <User className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Your Profile</h2>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{user.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getRoleIcon()}
                  <span className="capitalize text-sm font-medium">{user.role}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{user.phone}</p>
                  </div>
                </div>
              )}

              {user.stationName && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Assigned Station</p>
                    <p className="text-sm text-muted-foreground">{user.stationName}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t">
                <div className="flex-1">
                  <p className="text-sm font-medium">Account Status</p>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                    {user.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Bank accounts — vendor only */}
      {user.role === "vendor" && user.vendorId && (
        <VendorBankSection vendorId={user.vendorId} />
      )}
    </div>
  );
}
