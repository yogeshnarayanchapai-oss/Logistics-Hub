import { useState } from "react";
import { useListVendorComments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, MessageSquare, Filter } from "lucide-react";
import { format } from "date-fns";

export default function VendorComments() {
  const [search, setSearch] = useState("");

  const { data: comments, isLoading, refetch } = useListVendorComments();

  const filtered = (comments ?? []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.orderCode.toLowerCase().includes(s) || c.comment.toLowerCase().includes(s);
  });

  const formatDate = (iso: string) => {
    try {
      return format(new Date(iso), "MMMM d, yyyy, h:mm aaa");
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Today's Comments</h2>
        <p className="text-muted-foreground">All order comments added today for your orders.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 w-full sm:w-80">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search SN / Comment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { setSearch(""); refetch(); }}
            >
              <Filter className="h-4 w-4" /> Clear Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
              <p className="font-medium">No comments today</p>
              <p className="text-sm mt-1">Comments on your orders will appear here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 pl-4 font-semibold text-foreground">S.No</TableHead>
                  <TableHead className="font-semibold text-foreground">Order</TableHead>
                  <TableHead className="font-semibold text-foreground">Comment</TableHead>
                  <TableHead className="font-semibold text-foreground">Added on</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, i) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="pl-4 text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/orders/${c.orderId}`}>
                        <span className="text-primary font-medium hover:underline cursor-pointer">
                          {c.orderCode}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <p className="text-sm leading-snug">{c.comment}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(c.addedOn)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
