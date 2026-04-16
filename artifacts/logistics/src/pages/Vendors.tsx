import { useState } from "react";
import { useListVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, getListVendorsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Search, Store, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Vendors() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: vendors, isLoading } = useListVendors({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });

  const createMutation = useCreateVendor({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Vendor created successfully" }); setIsDialogOpen(false); }
    }
  });

  const updateMutation = useUpdateVendor({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Vendor updated successfully" }); setIsDialogOpen(false); }
    }
  });

  const deleteMutation = useDeleteVendor({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Vendor deleted" }); setDeleteTarget(null); },
      onError: () => { toast({ title: "Delete failed", variant: "destructive" }); setDeleteTarget(null); }
    }
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      businessName: formData.get("businessName") as string || null,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string || null,
      address: formData.get("address") as string || null,
      vendorCode: formData.get("vendorCode") as string,
      deliveryCharge: Number(formData.get("deliveryCharge")),
      status: formData.get("status") as string || "active"
    };
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const toggleStatus = (vendor: any) => {
    const newStatus = vendor.status === "active" ? "inactive" : "active";
    updateMutation.mutate(
      { id: vendor.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `Vendor ${newStatus === "active" ? "activated" : "deactivated"}` });
        }
      }
    );
  };

  const isAdmin = user?.role === "admin";
  const canManage = ["admin", "manager"].includes(user?.role || "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendors</h2>
          <p className="text-muted-foreground">Manage merchants and clients.</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingVendor(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Vendor
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Delivery Charge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!vendors?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No vendors found.</TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((vendor) => (
                      <TableRow key={vendor.id} className={vendor.status === "inactive" ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{vendor.vendorCode}</TableCell>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            {vendor.name}
                          </div>
                          {vendor.businessName && <div className="text-xs text-muted-foreground">{vendor.businessName}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{vendor.email}</div>
                          <div className="text-xs text-muted-foreground">{vendor.phone}</div>
                        </TableCell>
                        <TableCell>Rs. {vendor.deliveryCharge}</TableCell>
                        <TableCell>
                          <Badge variant={vendor.status === "active" ? "default" : "secondary"}>
                            {vendor.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && (
                              <Button variant="ghost" size="sm" onClick={() => { setEditingVendor(vendor); setIsDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Button>
                            )}
                            {canManage && (
                              <Button
                                variant="ghost" size="sm"
                                className={vendor.status === "active" ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                                onClick={() => toggleStatus(vendor)}
                                disabled={updateMutation.isPending}
                              >
                                {vendor.status === "active"
                                  ? <><ToggleRight className="h-3.5 w-3.5 mr-1" /> Deactivate</>
                                  : <><ToggleLeft className="h-3.5 w-3.5 mr-1" /> Activate</>}
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget({ id: vendor.id, name: vendor.name })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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

      {/* Edit / Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingVendor ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
              <DialogDescription>
                {editingVendor ? "Update the vendor's details below." : "Enter details for the new vendor."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" defaultValue={editingVendor?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendorCode">Vendor Code *</Label>
                  <Input id="vendorCode" name="vendorCode" defaultValue={editingVendor?.vendorCode} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingVendor?.email} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editingVendor?.phone} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input id="businessName" name="businessName" defaultValue={editingVendor?.businessName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={editingVendor?.address} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deliveryCharge">Delivery Charge (Rs.) *</Label>
                  <Input id="deliveryCharge" name="deliveryCharge" type="number" defaultValue={editingVendor?.deliveryCharge || 100} required />
                </div>
                {editingVendor && (
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status" name="status" defaultValue={editingVendor.status}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
