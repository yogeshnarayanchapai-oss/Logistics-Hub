import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plus, Pencil, Trash2, Phone, User2, Building2, Loader2, Palette, Upload, X, Check } from "lucide-react";
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
import { useBranding, type Branding } from "@/lib/branding";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branding, setBranding } = useBranding();

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

  // ── General settings state ──
  const [rateMode, setRateMode] = useState<"default" | "custom">("default");
  const [defaultDeliveryCharge, setDefaultDeliveryCharge] = useState(100);
  const [generalLoading, setGeneralLoading] = useState(true);
  const [generalSaving, setGeneralSaving] = useState(false);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const token = localStorage.getItem("auth_token");
    fetch(`${base}/api/settings/general`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setRateMode(d.rateMode ?? "default");
        setDefaultDeliveryCharge(d.defaultDeliveryCharge ?? 100);
      })
      .catch(() => {})
      .finally(() => setGeneralLoading(false));
  }, []);

  const saveGeneralSettings = async () => {
    setGeneralSaving(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${base}/api/settings/general`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rateMode, defaultDeliveryCharge }),
      });
      if (!res.ok) throw new Error();
      toast({
        title: "Settings saved",
        description: rateMode === "default"
          ? `All stations updated to Rs. ${defaultDeliveryCharge} delivery charge.`
          : "Each station will use its own individually configured rate.",
      });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setGeneralSaving(false);
    }
  };

  // ── Branding tab state ──
  const [brandingForm, setBrandingForm] = useState<Branding>({ ...branding });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Logo must be under 2 MB", variant: "destructive" }); return; }
    const b64 = await toBase64(file);
    setBrandingForm((f) => ({ ...f, logoUrl: b64 }));
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) { toast({ title: "Favicon must be under 512 KB", variant: "destructive" }); return; }
    const b64 = await toBase64(file);
    setBrandingForm((f) => ({ ...f, faviconUrl: b64 }));
  };

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${base}/api/settings/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(brandingForm),
      });
      if (!res.ok) throw new Error();
      setBranding(brandingForm);
      toast({ title: "Branding saved", description: "All users will see the new branding." });
    } catch {
      toast({ title: "Failed to save branding", variant: "destructive" });
    } finally {
      setBrandingSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">Configure global application preferences.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="contacts">Support Contacts</TabsTrigger>
        </TabsList>

        {/* ── General Tab ── */}
        <TabsContent value="general">
          <div className="space-y-6">
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

                {/* ── Delivery Rate Mode ── */}
                <div className="pt-2 space-y-3">
                  <Label className="text-base">Delivery Charge Rate</Label>
                  <p className="text-sm text-muted-foreground -mt-1">Choose how delivery charges are applied across service stations.</p>

                  {generalLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Default option */}
                      <button
                        type="button"
                        onClick={() => setRateMode("default")}
                        className={`relative flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all ${
                          rateMode === "default"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        {rateMode === "default" && (
                          <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </span>
                        )}
                        <span className="font-semibold text-sm">Default Rate</span>
                        <span className="text-xs text-muted-foreground">
                          One global rate applied to all service stations. Saving will update every station's charge.
                        </span>
                        {rateMode === "default" && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground shrink-0">Rs.</span>
                            <Input
                              type="number"
                              min={0}
                              value={defaultDeliveryCharge}
                              onChange={(e) => setDefaultDeliveryCharge(Number(e.target.value))}
                              className="h-8 max-w-[120px] text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs text-muted-foreground">per delivery</span>
                          </div>
                        )}
                      </button>

                      {/* Custom option */}
                      <button
                        type="button"
                        onClick={() => setRateMode("custom")}
                        className={`relative flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all ${
                          rateMode === "custom"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        {rateMode === "custom" && (
                          <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </span>
                        )}
                        <span className="font-semibold text-sm">Custom Rate</span>
                        <span className="text-xs text-muted-foreground">
                          Each service station uses its own individually configured delivery charge. Rates are set per station.
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveGeneralSettings} disabled={generalSaving || generalLoading}>
                {generalSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Branding Tab ── */}
        <TabsContent value="branding">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" /> Brand Identity
                </CardTitle>
                <CardDescription>
                  Customize the company name, colors, logo, and favicon shown to all users including vendors and riders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="brandCompanyName">Company Name</Label>
                  <Input
                    id="brandCompanyName"
                    value={brandingForm.companyName}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, companyName: e.target.value }))}
                    placeholder="e.g. SwiftShip"
                    className="max-w-sm"
                  />
                  <p className="text-xs text-muted-foreground">Shown in the sidebar, login page, and browser tab.</p>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={brandingForm.primaryColor}
                          onChange={(e) => setBrandingForm((f) => ({ ...f, primaryColor: e.target.value }))}
                          className="h-10 w-14 rounded border border-input cursor-pointer p-0.5 bg-transparent"
                        />
                      </div>
                      <Input
                        value={brandingForm.primaryColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBrandingForm((f) => ({ ...f, primaryColor: v }));
                        }}
                        className="font-mono max-w-[120px]"
                        placeholder="#dc2626"
                        maxLength={7}
                      />
                      <div className="h-8 w-8 rounded-full border border-border" style={{ background: brandingForm.primaryColor }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for sidebar background, buttons, badges.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandingForm.secondaryColor}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                        className="h-10 w-14 rounded border border-input cursor-pointer p-0.5 bg-transparent"
                      />
                      <Input
                        value={brandingForm.secondaryColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBrandingForm((f) => ({ ...f, secondaryColor: v }));
                        }}
                        className="font-mono max-w-[120px]"
                        placeholder="#f3f4f6"
                        maxLength={7}
                      />
                      <div className="h-8 w-8 rounded-full border border-border" style={{ background: brandingForm.secondaryColor }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for secondary buttons and muted backgrounds.</p>
                  </div>
                </div>

                {/* Logo */}
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                      {brandingForm.logoUrl ? (
                        <img src={brandingForm.logoUrl} alt="logo preview" className="h-full w-full object-contain p-1" />
                      ) : (
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                          <Upload className="mr-2 h-3.5 w-3.5" />
                          Upload Logo
                        </Button>
                        {brandingForm.logoUrl && (
                          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                            onClick={() => setBrandingForm((f) => ({ ...f, logoUrl: null }))}>
                            <X className="mr-1 h-3.5 w-3.5" /> Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">PNG, JPG, SVG. Max 2 MB. Shown in the sidebar header.</p>
                    </div>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>

                {/* Favicon */}
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                      {brandingForm.faviconUrl ? (
                        <img src={brandingForm.faviconUrl} alt="favicon preview" className="h-full w-full object-contain" />
                      ) : (
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()}>
                          <Upload className="mr-2 h-3.5 w-3.5" />
                          Upload Favicon
                        </Button>
                        {brandingForm.faviconUrl && (
                          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                            onClick={() => setBrandingForm((f) => ({ ...f, faviconUrl: null }))}>
                            <X className="mr-1 h-3.5 w-3.5" /> Remove
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">ICO, PNG. Max 512 KB. Shown in the browser tab icon.</p>
                    </div>
                  </div>
                  <input ref={faviconInputRef} type="file" accept="image/x-icon,image/png,image/gif" className="hidden" onChange={handleFaviconUpload} />
                </div>

                {/* Live preview strip */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/40 border-b border-border">Live Preview — Sidebar Header</div>
                  <div className="flex items-center gap-3 px-5 py-4" style={{ background: brandingForm.primaryColor }}>
                    {brandingForm.logoUrl ? (
                      <img src={brandingForm.logoUrl} alt="logo" className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                        {brandingForm.companyName.charAt(0)}
                      </div>
                    )}
                    <span className="text-white font-bold text-lg">{brandingForm.companyName || "Company Name"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveBranding} disabled={brandingSaving}>
                {brandingSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Branding
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Support Contacts Tab ── */}
        <TabsContent value="contacts">
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
        </TabsContent>
      </Tabs>

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
