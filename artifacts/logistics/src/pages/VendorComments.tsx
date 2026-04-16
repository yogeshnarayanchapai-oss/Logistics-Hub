import { useState } from "react";
import { useListVendorComments, useAddOrderComment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useRolePrefix } from "@/lib/use-role-prefix";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Search, MessageSquare, Filter, CornerDownRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function VendorComments() {
  const [search, setSearch] = useState("");
  const prefix = useRolePrefix();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments, isLoading, refetch } = useListVendorComments();

  const [replyTarget, setReplyTarget] = useState<{ orderId: number; orderCode: string; originalComment: string } | null>(null);
  const [replyText, setReplyText] = useState("");

  const replyMutation = useAddOrderComment({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ["listVendorComments"] });
        refetch();
        toast({ title: "Reply sent" });
        setReplyTarget(null);
        setReplyText("");
      },
      onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
    },
  });

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
                  <TableHead className="w-16 text-right pr-4 font-semibold text-foreground">Reply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, i) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="pl-4 text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`${prefix}/orders/${c.orderId}`}>
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
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        title="Reply to this comment"
                        onClick={() => {
                          setReplyTarget({ orderId: c.orderId, orderCode: c.orderCode, originalComment: c.comment });
                          setReplyText("");
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={!!replyTarget} onOpenChange={(open) => { if (!open) { setReplyTarget(null); setReplyText(""); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CornerDownRight className="h-5 w-5 text-blue-500" />
              Reply to Comment
            </DialogTitle>
            <DialogDescription>
              Order <strong>{replyTarget?.orderCode}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="rounded-md bg-muted/50 border px-3 py-2">
              <p className="text-xs text-muted-foreground font-medium mb-1">Original comment:</p>
              <p className="text-sm italic">{replyTarget?.originalComment}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-text">Your Reply</Label>
              <Textarea
                id="reply-text"
                rows={4}
                placeholder="Type your reply here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplyTarget(null); setReplyText(""); }}>Cancel</Button>
            <Button
              disabled={!replyText.trim() || replyMutation.isPending}
              onClick={() => {
                if (!replyTarget || !replyText.trim()) return;
                replyMutation.mutate({ orderId: replyTarget.orderId, data: { content: replyText.trim() } });
              }}
            >
              {replyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CornerDownRight className="mr-2 h-4 w-4" />}
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
