import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
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
import { Loader2, Plus, Search, User, Pencil, Trash2, ToggleLeft, ToggleRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: users, isLoading } = useListUsers({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "User created successfully" }); setIsDialogOpen(false); }
    }
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "User updated successfully" }); setIsDialogOpen(false); }
    }
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "User deleted" }); setDeleteTarget(null); },
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
      role: formData.get("role") as any,
      password: formData.get("password") as string,
      status: formData.get("status") as string || "active",
      stationId: formData.get("stationId") ? Number(formData.get("stationId")) : null
    };

    if (editingUser) {
      const updateData: any = { ...data };
      if (!updateData.password) delete updateData.password;
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate({ data });
    }
  };

  const toggleStatus = (u: any) => {
    const newStatus = u.status === "active" ? "inactive" : "active";
    updateMutation.mutate(
      { id: u.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `User ${newStatus === "active" ? "activated" : "deactivated"}` });
        }
      }
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800";
      case "manager": return "bg-orange-100 text-orange-800";
      case "staff": return "bg-blue-100 text-blue-800";
      case "vendor": return "bg-purple-100 text-purple-800";
      case "rider": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const isSelf = (u: any) => u.id === currentUser?.id;
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Users</h2>
          <p className="text-muted-foreground">Manage roles and access control.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingUser(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search users..."
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
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!users?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found.</TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id} className={u.status === "inactive" ? "opacity-60" : ""}>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {u.name}
                            {isSelf(u) && (
                              <Badge variant="outline" className="text-xs px-1 py-0">You</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{u.email}</div>
                          <div className="text-xs text-muted-foreground">{u.phone}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getRoleColor(u.role)}>{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "default" : "secondary"}>{u.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isAdmin && (
                                <DropdownMenuItem className="cursor-pointer" onClick={() => { setEditingUser(u); setIsDialogOpen(true); }}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                              )}
                              {isAdmin && !isSelf(u) && (
                                <DropdownMenuItem
                                  className={`cursor-pointer ${u.status === "active" ? "text-orange-600 focus:text-orange-700" : "text-green-700 focus:text-green-700"}`}
                                  onClick={() => toggleStatus(u)}
                                  disabled={updateMutation.isPending}
                                >
                                  {u.status === "active"
                                    ? <><ToggleRight className="mr-2 h-4 w-4" /> Deactivate</>
                                    : <><ToggleLeft className="mr-2 h-4 w-4" /> Activate</>}
                                </DropdownMenuItem>
                              )}
                              {isAdmin && !isSelf(u) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget({ id: u.id, name: u.name })}
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
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "Update the user details below." : "Enter details for the new user account."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" defaultValue={editingUser?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <select
                    id="role" name="role"
                    defaultValue={editingUser?.role || "staff"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="vendor">Vendor</option>
                    <option value="rider">Rider</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingUser?.email} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editingUser?.phone} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{editingUser ? "Password (leave blank to keep current)" : "Password *"}</Label>
                <Input id="password" name="password" type="password" required={!editingUser} />
              </div>
              {editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status" name="status"
                    defaultValue={editingUser.status}
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
            <AlertDialogTitle>Delete User</AlertDialogTitle>
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
