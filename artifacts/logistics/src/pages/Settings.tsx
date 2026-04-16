import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Plus, Pencil, Trash2, Phone, User2, Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useListSupportContacts, useCreateSupportContact, useUpdateSupportContact,
  useDeleteSupportContact, getListSupportContactsQueryKey, type SupportContact,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading: contactsLoading } = useListSupportContacts();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SupportContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportContact | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListSupportContactsQueryKey() });

  const createMutation = useCreateSupportContact({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Contact added" }); setIsDialogOpen(false); },
      onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateSupportContact({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Contact updated" }); setIsDialogOpen(false); setEditingContact(null); },
      onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteSupportContact({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Contact removed" }); setDeleteTarget(null); },
      onError: () => toast({ title: "Failed to remove contact", variant: "destructive" }),
    },
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      department: formData.get("department") as string,
      phone: formData.get("phone") as string,
    };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (contact: SupportContact) => {
    setEditingContact(contact);
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingContact(null);
    setIsDialogOpen(true);
  };

  const handleSettingsSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Settings saved successfully" });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">Configure global application preferences.</p>
      </div>

      <form onSubmit={handleSettingsSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>General Configuration</CardTitle>
            <CardDescription>Basic system settings and defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" defaultValue="SwiftShip Logistics" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input id="supportEmail" defaultValue="support@swiftship.com" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input id="currency" defaultValue="NPR (Rs.)" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" defaultValue="Asia/Kathmandu" disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order & Delivery</CardTitle>
            <CardDescription>Rules for order processing and delivery logic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-assign Orders</Label>
                <p className="text-sm text-muted-foreground">Automatically route orders to stations based on area coverage.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Strict Duplicate Checking</Label>
                <p className="text-sm text-muted-foreground">Flag orders with similar phone numbers within 48 hours.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-2 pt-2">
              <Label htmlFor="defaultDeliveryCharge">Default Base Delivery Charge (Rs.)</Label>
              <Input id="defaultDeliveryCharge" type="number" defaultValue="100" className="max-w-xs" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </form>

      {/* Support Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" /> Support Contacts
              </CardTitle>
              <CardDescription className="mt-1">
                These contacts are shown to vendors and riders in the Support Tickets page so they can reach the right person for help.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contactsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !contacts || contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <User2 className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No support contacts yet. Add one so vendors and riders know who to call.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <User2 className="h-3.5 w-3.5" />
                      </div>
                      {contact.name}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Building2 className="h-3.5 w-3.5" /> {contact.department}
                      </span>
                    </TableCell>
                    <TableCell>
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary text-sm font-medium hover:underline">
                        <Phone className="h-3.5 w-3.5" /> {contact.phone}
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(contact)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(contact)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) { setIsDialogOpen(false); setEditingContact(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "Add Support Contact"}</DialogTitle>
            <DialogDescription>This person's details will be shown to vendors and riders for help.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" placeholder="e.g. Ram Sharma" required defaultValue={editingContact?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" placeholder="e.g. Rider Support, Vendor Relations" required defaultValue={editingContact?.department ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" placeholder="e.g. 9800000000" required defaultValue={editingContact?.phone ?? ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingContact(null); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingContact ? "Update" : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Support Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.name}</strong> from the support contacts list?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
