import { useState } from "react";
import { useListRiders, useCreateRider, useUpdateRider, useDeleteRider, useListStations, getListRidersQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Plus, Search, Truck, Pencil, Trash2, ToggleLeft, ToggleRight, MapPin, Phone, Mail, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRidersQueryKey() });

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

  const deleteMutation = useDeleteRider({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Rider deleted" }); setDeleteTarget(null); },
      onError: () => { toast({ title: "Delete failed", variant: "destructive" }); setDeleteTarget(null); }
    }
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string || null,
      vehicleNumber: formData.get("vehicleNumber") as string || null,
      stationId: formData.get("stationId") ? Number(formData.get("stationId")) : null,
      status: formData.get("status") as string || "active"
    };
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

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : !riders?.length ? (
            <div className="text-center py-12 text-muted-foreground">No riders found.</div>
          ) : (
            <div className="divide-y">
              {riders.map((rider) => (
                <div
                  key={rider.id}
                  className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors ${rider.status === "inactive" ? "opacity-60" : ""}`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>

                  {/* Name + contact */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{rider.name}</span>
                      <Badge
                        variant={rider.status === "active" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {rider.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {rider.email}
                      </span>
                      {rider.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {rider.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Station + Vehicle */}
                  <div className="hidden md:flex flex-col items-start gap-0.5 min-w-[130px]">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {rider.stationName || "No station"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      {rider.vehicleNumber || "—"}
                    </span>
                  </div>

                  {/* Today's workload */}
                  <div className="hidden sm:flex flex-col items-center min-w-[80px]">
                    <span className="text-lg font-bold text-primary leading-none">{rider.deliveredToday}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Today</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => { setEditingRider(rider); setIsDialogOpen(true); }}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 px-3 text-xs ${rider.status === "active" ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "text-green-600 border-green-200 hover:bg-green-50"}`}
                        onClick={() => toggleStatus(rider)}
                        disabled={updateMutation.isPending}
                      >
                        {rider.status === "active"
                          ? <><ToggleRight className="h-3 w-3 mr-1" /> Deactivate</>
                          : <><ToggleLeft className="h-3 w-3 mr-1" /> Activate</>}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50"
                        onClick={() => setDeleteTarget({ id: rider.id, name: rider.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
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
            <AlertDialogTitle>Delete Rider</AlertDialogTitle>
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
