import { useState } from "react";
import { useListStations, useCreateStation, useUpdateStation, getListStationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Stations() {
  const { data: stations, isLoading } = useListStations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateStation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStationsQueryKey() });
        toast({ title: "Station created successfully" });
        setIsDialogOpen(false);
      }
    }
  });

  const updateMutation = useUpdateStation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStationsQueryKey() });
        toast({ title: "Station updated successfully" });
        setIsDialogOpen(false);
      }
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
      status: formData.get("status") as string || "active"
    };

    if (editingStation) {
      updateMutation.mutate({ id: editingStation.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const openNewDialog = () => {
    setEditingStation(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (station: any) => {
    setEditingStation(station);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Service Stations</h2>
          <p className="text-muted-foreground">Manage logistics hubs and delivery zones.</p>
        </div>
        <Button onClick={openNewDialog}><Plus className="mr-2 h-4 w-4" /> Add Station</Button>
      </div>

      <Card>
        <CardContent className="p-0">
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
                    <TableHead>Assigned Riders</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stations?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No stations found.</TableCell>
                    </TableRow>
                  ) : (
                    stations?.map((station) => (
                      <TableRow key={station.id}>
                        <TableCell className="font-medium">{station.code}</TableCell>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {station.name}
                          </div>
                          {station.address && <div className="text-xs text-muted-foreground">{station.address}</div>}
                        </TableCell>
                        <TableCell>{station.areaCoverage || "-"}</TableCell>
                        <TableCell>{station.riderCount}</TableCell>
                        <TableCell>
                          <Badge variant={station.status === 'active' ? 'default' : 'secondary'}>{station.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(station)}>Edit</Button>
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
              {editingStation && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select 
                    id="status" 
                    name="status" 
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
