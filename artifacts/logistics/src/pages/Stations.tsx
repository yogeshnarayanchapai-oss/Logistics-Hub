import { useState, useMemo } from "react";
import { useListStations, useCreateStation, useUpdateStation, useDeleteStation, getListStationsQueryKey } from "@workspace/api-client-react";
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
import { Loader2, Plus, MapPin, Pencil, Trash2, ToggleLeft, ToggleRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Stations() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: allStations, isLoading } = useListStations();

  const stations = useMemo(() => {
    if (!allStations) return [];
    if (statusFilter === "all") return allStations;
    return allStations.filter((s) => s.status === statusFilter);
  }, [allStations, statusFilter]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStationsQueryKey() });

  const createMutation = useCreateStation({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Station created successfully" }); setIsDialogOpen(false); }
    }
  });

  const updateMutation = useUpdateStation({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Station updated successfully" }); setIsDialogOpen(false); }
    }
  });

  const deleteMutation = useDeleteStation({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Station deleted" }); setDeleteTarget(null); },
      onError: () => { toast({ title: "Delete failed", variant: "destructive" }); setDeleteTarget(null); }
    }
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      code: formData.get("code") as string,
      address: formData.get("address") as string || null,
      areaCoverage: formData.get("areaCoverage") as string || null,
      deliveryCharge: Number(formData.get("deliveryCharge")) || 0,
      status: formData.get("status") as string || "active"
    };
    if (editingStation) {
      updateMutation.mutate({ id: editingStation.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const toggleStatus = (station: any) => {
    const newStatus = station.status === "active" ? "inactive" : "active";
    updateMutation.mutate(
      { id: station.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `Station ${newStatus === "active" ? "activated" : "deactivated"}` });
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
          <h2 className="text-2xl font-bold tracking-tight">Service Stations</h2>
          <p className="text-muted-foreground">Manage logistics hubs and delivery zones.</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditingStation(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Station
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-end">
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

        <CardContent className="p-0 pt-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Station Name</TableHead>
                    <TableHead>Area Coverage</TableHead>
                    <TableHead className="text-right">Delivery Charge</TableHead>
                    <TableHead>Assigned Riders</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!stations.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No stations found.</TableCell>
                    </TableRow>
                  ) : (
                    stations.map((station) => (
                      <TableRow key={station.id} className={station.status === "inactive" ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{station.code}</TableCell>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {station.name}
                          </div>
                          {station.address && <div className="text-xs text-muted-foreground">{station.address}</div>}
                        </TableCell>
                        <TableCell>{(station as any).areaCoverage || "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          Rs. {((station as any).deliveryCharge ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell>{(station as any).riderCount}</TableCell>
                        <TableCell>
                          <Badge variant={station.status === "active" ? "default" : "secondary"}>{station.status}</Badge>
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
                                <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingStation(station); setIsDialogOpen(true); }}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                              )}
                              {canManage && (
                                <DropdownMenuItem
                                  className={`cursor-pointer ${station.status === "active" ? "text-orange-600 focus:text-orange-700" : "text-green-700 focus:text-green-700"}`}
                                  onClick={() => toggleStatus(station)}
                                  disabled={updateMutation.isPending}
                                >
                                  {station.status === "active"
                                    ? <><ToggleRight className="mr-2 h-4 w-4" /> Deactivate</>
                                    : <><ToggleLeft className="mr-2 h-4 w-4" /> Activate</>}
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget({ id: station.id, name: station.name })}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
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
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingStation ? "Edit Station" : "Add New Station"}</DialogTitle>
              <DialogDescription>
                {editingStation ? "Update the station details below." : "Enter details for the new logistics hub."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" defaultValue={editingStation?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input id="code" name="code" defaultValue={editingStation?.code} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={editingStation?.address} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="areaCoverage">Area Coverage (comma separated)</Label>
                <Input id="areaCoverage" name="areaCoverage" defaultValue={editingStation?.areaCoverage} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryCharge">Delivery Charge (Rs.) *</Label>
                <Input
                  id="deliveryCharge" name="deliveryCharge" type="number" min="0"
                  defaultValue={(editingStation as any)?.deliveryCharge ?? 0}
                  required
                />
              </div>
              {editingStation && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status" name="status"
                    defaultValue={editingStation.status}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Station</AlertDialogTitle>
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
