import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Activity } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useListAuditLogs({
    page,
    limit,
    action: search || undefined
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
        <p className="text-muted-foreground">System-wide activity tracking and security logs.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex w-full md:w-1/3 items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full"
            />
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
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No audit logs found.</TableCell>
                    </TableRow>
                  ) : (
                    data?.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                        </TableCell>
                        <TableCell>
                          {log.userName ? (
                            <div>
                              <div className="font-medium">{log.userName}</div>
                              <div className="text-xs text-muted-foreground capitalize">{log.userRole}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase font-mono text-[10px]">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-medium">
                            <Activity className="h-3 w-3 text-muted-foreground" />
                            {log.entity}
                            {log.entityId && <span className="text-muted-foreground font-normal">#{log.entityId}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.description}</div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {data && data.total > limit && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data.total)} of {data.total} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Temporary Button definition for pagination since it's not imported at the top
import { Button } from "@/components/ui/button";
