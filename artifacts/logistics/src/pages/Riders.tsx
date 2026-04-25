import { useState, useRef, KeyboardEvent, useCallback } from "react";
import { useListRiders, useCreateRider, useUpdateRider, useListStations, getListRidersQueryKey, getListUsersQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Search, Truck, Pencil, ToggleLeft, ToggleRight, MoreHorizontal, X, CreditCard, Building, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

function AreaTagsInput({ defaultValue }: { defaultValue?: string | null }) {
  const [tags, setTags] = useState<string[]>(() =>
    defaultValue ? defaultValue.split(",").map(t => t.trim()).filter(Boolean) : []
  );
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const newTags = raw.split(",").map(t => t.trim()).filter(Boolean);
    setTags(prev => {
      const combined = [...prev];
      newTags.forEach(t => { if (!combined.includes(t)) combined.push(t); });
      return combined;
    });
    setInputVal("");
  };

  const removeTag = (idx: number) => setTags(prev => prev.filter((_, i) => i !== idx));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputVal.trim()) addTag(inputVal);
    } else if (e.key === "Backspace" && !inputVal && tags.length) {
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = () => {
    if (inputVal.trim()) addTag(inputVal);
  };

  return (
    <div
      className="min-h-[38px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm cursor-text flex flex-wrap gap-1.5 focus-within:ring-1 focus-within:ring-ring"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
          {tag}
          <button type="button" onClick={() => removeTag(i)} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputVal}
        onChange={e => {
          const val = e.target.value;
          if (val.includes(",")) { addTag(val); }
          else setInputVal(val);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? "Type area name, press Enter or comma…" : ""}
        className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground text-sm"
      />
      <input type="hidden" name="coverageArea" value={tags.join(", ")} />
    </div>
  );
}

export default function Riders() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: riders, isLoading } = useListRiders({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: stations } = useListStations();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const token = () => localStorage.getItem("authToken");

  const [bankRider, setBankRider] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankAddOpen, setBankAddOpen] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);

  const openBankDialog = useCallback(async (rider: any) => {
    setBankRider(rider);
    setBankAccounts([]);
    setBankLoading(true);
    try {
      const res = await fetch(`${BASE}/api/rider-bank-accounts?riderId=${rider.id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setBankAccounts(Array.isArray(data) ? data : []);
    } finally { setBankLoading(false); }
  }, [BASE]);

  const handleAddBankAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBankSaving(true);
    try {
      const res = await fetch(`${BASE}/api/rider-bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          riderId: bankRider.id,
          accountHolderName: fd.get("accountHolderName"),
          bankName: fd.get("bankName"),
          branch: fd.get("branch") || null,
          accountNumber: fd.get("accountNumber"),
          walletMethod: fd.get("walletMethod") || null,
          isDefault: bankAccounts.length === 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast({ title: "Bank account added" });
      setBankAddOpen(false);
      const updated = await fetch(`${BASE}/api/rider-bank-accounts?riderId=${bankRider.id}`, { headers: { Authorization: `Bearer ${token()}` } });
      setBankAccounts(await updated.json());
    } catch (err: any) {
      toast({ title: err.message || "Failed to add account", variant: "destructive" });
    } finally { setBankSaving(false); }
  };

  const handleDeleteBankAccount = async (id: number) => {
    try {
      await fetch(`${BASE}/api/rider-bank-accounts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      toast({ title: "Account removed" });
      setBankAccounts(prev => prev.filter(a => a.id !== id));
    } catch { toast({ title: "Failed to remove account", variant: "destructive" }); }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListRidersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  };

  const createMutation = useCreateRider({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Rider created successfully" }); setIsDialogOpen(false); }
    }
  });

  const updateMutation = useUpdateRider({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Rider updated successfully" }); setIsDialogOpen(false); }
    }
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string || null,
      vehicleNumber: formData.get("vehicleNumber") as string || null,
      stationId: formData.get("stationId") ? Number(formData.get("stationId")) : null,
      status: formData.get("status") as string || "active",
      coverageArea: (formData.get("coverageArea") as string)?.trim() || null,
      commissionRate: Number(formData.get("commissionRate") ?? 0),
    };
    if (!editingRider) {
      data.password = formData.get("password") as string;
    }
    if (editingRider) {
      updateMutation.mutate({ id: editingRider.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const toggleStatus = (rider: any) => {
    const newStatus = rider.status === "active" ? "inactive" : "active";
    updateMutation.mutate(
      { id: rider.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `Rider ${newStatus === "active" ? "activated" : "deactivated"}` });
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
          <h2 className="text-2xl font-bold tracking-tight">Riders</h2>
          <p className="text-muted-foreground">Manage delivery personnel.</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingRider(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Rider
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search riders..."
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
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Workload</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!riders?.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No riders found.</TableCell>
                    </TableRow>
                  ) : (
                    riders.map((rider) => (
                      <TableRow key={rider.id} className={rider.status === "inactive" ? "opacity-60" : ""}>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            {rider.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{rider.email}</div>
                          <div className="text-xs text-muted-foreground">{rider.phone}</div>
                        </TableCell>
                        <TableCell>{rider.stationName || "—"}</TableCell>
                        <TableCell>{rider.vehicleNumber || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700">{rider.deliveredToday} Today</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rider.status === "active" ? "default" : "secondary"}>{rider.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canManage && (
                                <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingRider(rider); setIsDialogOpen(true); }}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="cursor-pointer" onClick={() => { setBankAddOpen(false); openBankDialog(rider); }}>
                                <CreditCard className="mr-2 h-4 w-4" /> Bank Accounts
                              </DropdownMenuItem>
                              {canManage && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className={`cursor-pointer ${rider.status === "active" ? "text-orange-600 focus:text-orange-700" : "text-green-700 focus:text-green-700"}`}
                                    onClick={() => toggleStatus(rider)}
                                    disabled={updateMutation.isPending}
                                  >
                                    {rider.status === "active"
                                      ? <><ToggleRight className="mr-2 h-4 w-4" /> Deactivate</>
                                      : <><ToggleLeft className="mr-2 h-4 w-4" /> Activate</>}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
              <DialogTitle>{editingRider ? "Edit Rider" : "Add New Rider"}</DialogTitle>
              <DialogDescription>
                {editingRider ? "Update the rider's details below." : "Enter details for the new delivery person."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" defaultValue={editingRider?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingRider?.email} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editingRider?.phone} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                  <Input id="vehicleNumber" name="vehicleNumber" defaultValue={editingRider?.vehicleNumber} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stationId">Station</Label>
                  <select
                    id="stationId" name="stationId"
                    defaultValue={editingRider?.stationId || ""}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">None</option>
                    {stations?.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {editingRider && (
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status" name="status"
                      defaultValue={editingRider.status}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionRate">Commission per Delivery (Rs.)</Label>
                <Input
                  id="commissionRate" name="commissionRate" type="number" min="0" step="0.01"
                  defaultValue={editingRider?.commissionRate ?? 0}
                  placeholder="e.g. 50"
                />
                <p className="text-xs text-muted-foreground">Amount earned by the rider per successful delivery.</p>
              </div>
              <div className="space-y-2">
                <Label>Coverage Area</Label>
                <AreaTagsInput key={editingRider?.id ?? "new"} defaultValue={editingRider?.coverageArea} />
                <p className="text-xs text-muted-foreground">Type an area name then press Enter or comma to add it as a tag. Riders will be suggested when order areas match.</p>
              </div>
              {!editingRider && (
                <div className="space-y-2">
                  <Label htmlFor="password">Login Password *</Label>
                  <Input id="password" name="password" type="password" required placeholder="Password for rider login account" />
                  <p className="text-xs text-muted-foreground">A login account will be auto-created for this rider.</p>
                </div>
              )}
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

      {/* Rider Bank Accounts Dialog */}
      <Dialog open={!!bankRider} onOpenChange={(open) => { if (!open) { setBankRider(null); setBankAddOpen(false); } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Bank Accounts — {bankRider?.name}
            </DialogTitle>
            <DialogDescription>View and manage this rider's linked bank accounts.</DialogDescription>
          </DialogHeader>

          {!bankAddOpen ? (
            <>
              <div className="space-y-3 max-h-72 overflow-y-auto py-1">
                {bankLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : bankAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No bank accounts added yet.</p>
                ) : (
                  bankAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Building className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {acc.bankName}
                            {acc.isDefault && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Default</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {acc.accountHolderName} · {acc.accountNumber}
                            {acc.branch ? ` · ${acc.branch}` : ""}
                            {acc.walletMethod ? ` · ${acc.walletMethod}` : ""}
                          </div>
                        </div>
                      </div>
                      {canManage && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteBankAccount(acc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
              <DialogFooter className="sm:justify-between">
                {canManage && (
                  <Button variant="outline" onClick={() => setBankAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Account
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setBankRider(null)}>Close</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={handleAddBankAccount}>
              <div className="grid gap-4 py-2">
                <h3 className="font-medium text-sm">New Bank Account</h3>
                <div className="space-y-2">
                  <Label htmlFor="ba-holder">Account Holder Name *</Label>
                  <Input id="ba-holder" name="accountHolderName" required defaultValue={bankRider?.name} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ba-bank">Bank Name *</Label>
                    <Input id="ba-bank" name="bankName" required placeholder="e.g. NIC Asia" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ba-branch">Branch</Label>
                    <Input id="ba-branch" name="branch" placeholder="e.g. Kathmandu" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ba-account">Account Number *</Label>
                  <Input id="ba-account" name="accountNumber" required placeholder="e.g. 0075291234567890" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ba-wallet">Mobile Wallet (optional)</Label>
                  <Input id="ba-wallet" name="walletMethod" placeholder="e.g. eSewa 9841234567" />
                </div>
              </div>
              <DialogFooter className="sm:justify-between mt-4">
                <Button type="button" variant="ghost" onClick={() => setBankAddOpen(false)}>← Back</Button>
                <Button type="submit" disabled={bankSaving}>
                  {bankSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Account
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
