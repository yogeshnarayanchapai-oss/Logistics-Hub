import { useGetOrder, useListOrderComments, useAddOrderComment, useUpdateOrderStatus, useAssignOrder, useListRiders, getGetOrderQueryKey, getListOrderCommentsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRolePrefix } from "@/lib/use-role-prefix";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Send, MapPin, Package, User, Clock, AlertTriangle, Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const prefix = useRolePrefix();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orderData, isLoading: orderLoading } = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId)
    }
  });

  const { data: comments, isLoading: commentsLoading } = useListOrderComments(orderId, {
    query: {
      enabled: !!orderId,
      queryKey: getListOrderCommentsQueryKey(orderId)
    }
  });

  const [newComment, setNewComment] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"all" | "internal" | "vendor" | "rider">("all");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [followupDate, setFollowupDate] = useState(() => new Date().toISOString().split("T")[0]);

  const addCommentMutation = useAddOrderComment({
    mutation: {
      onSuccess: () => {
        setNewComment("");
        queryClient.invalidateQueries({ queryKey: getListOrderCommentsQueryKey(orderId) });
        toast({ title: "Comment added" });
      },
      onError: () => {
        toast({ title: "Failed to add comment", variant: "destructive" });
      }
    }
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate({
      id: orderId,
      data: { content: newComment, visibility: commentVisibility }
    });
  };

  const updateStatusMutation = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        setPendingStatus(null);
        toast({ title: "Status updated" });
      }
    }
  });

  const handleStatusUpdate = (status: string, date?: string) => {
    if (status === "followup") {
      setPendingStatus("followup");
      return;
    }
    updateStatusMutation.mutate({ id: orderId, data: { status } });
  };

  const confirmFollowup = () => {
    updateStatusMutation.mutate({ id: orderId, data: { status: "followup", followupDate } as any });
  };

  const { data: riders } = useListRiders({ status: "active" }, {
    query: {
      enabled: ["admin", "manager", "station"].includes(user?.role || "")
    }
  });

  const assignRiderMutation = useAssignOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        toast({ title: "Rider assigned" });
      }
    }
  });

  const handleAssignRider = (riderId: string) => {
    assignRiderMutation.mutate({ id: orderId, data: { riderId: parseInt(riderId, 10) } });
  };

  if (orderLoading || commentsLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!orderData) {
    return <div>Order not found</div>;
  }

  const { order, statusHistory } = orderData;

  const isRider = user?.role === "rider";

  if (isRider && order.riderId !== user?.riderId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Order Not Assigned to You</h3>
          <p className="text-sm text-muted-foreground mt-1">You can only view and update orders assigned to you.</p>
        </div>
        <Link href={`${prefix}/orders`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Deliveries
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`${prefix}/orders`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight">{order.orderCode}</h2>
              <StatusBadge status={order.status} />
              {order.duplicateFlag && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Duplicate Flagged
                </Badge>
              )}
              {(order as any).followupDate && order.status === "followup" && (
                <Badge className="flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                  <Clock className="h-3 w-3" />
                  Followup: {format(new Date((order as any).followupDate), "MMM d, yyyy")}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">Created on {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRider ? (
            <div className="flex items-center gap-2">
              {pendingStatus === "followup" ? (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-amber-50 border-amber-200">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-amber-800 font-medium">Followup date:</span>
                  <input
                    type="date"
                    value={followupDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="text-sm border-0 bg-transparent text-amber-900 focus:outline-none"
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={confirmFollowup} disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPendingStatus(null)}>Cancel</Button>
                </div>
              ) : (
                <Select onValueChange={handleStatusUpdate} value={order.status}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="picked_up">Picked Up</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed_delivery">Failed Delivery</SelectItem>
                    <SelectItem value="followup">Follow Up</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <>
              {["admin", "manager"].includes(user?.role || "") && (
                <Select onValueChange={handleStatusUpdate} defaultValue={order.status}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Update Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="picked_for_delivery">Picked Up</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed_delivery">Failed Delivery</SelectItem>
                    <SelectItem value="reschedule">Reschedule</SelectItem>
                    <SelectItem value="return_pending">Return Pending</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {["admin", "manager", "station"].includes(user?.role || "") && (() => {
                const orderAreaText = [order.area, order.city, order.district, order.address]
                  .filter(Boolean).join(" ").toLowerCase();
                const suggested = (riders ?? []).filter(r => {
                  if (!r.coverageArea) return false;
                  return r.coverageArea.split(",").map(k => k.trim().toLowerCase()).some(kw => kw && orderAreaText.includes(kw));
                });
                const others = (riders ?? []).filter(r => !suggested.find(s => s.id === r.id));
                return (
                  <Select onValueChange={handleAssignRider} value={order.riderId?.toString() || ""}>
                    <SelectTrigger className="w-[210px]">
                      <SelectValue placeholder="Assign Rider" />
                      {suggested.length > 0 && !order.riderId && (
                        <span className="ml-1 flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{suggested.length}
                        </span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {suggested.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="flex items-center gap-1 text-amber-700">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Suggested for this area
                          </SelectLabel>
                          {suggested.map(r => (
                            <SelectItem key={r.id} value={r.id.toString()}>
                              ⭐ {r.name} ({r.assignedCount} assigned)
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {others.length > 0 && (
                        <SelectGroup>
                          {suggested.length > 0 && <SelectLabel className="text-muted-foreground">Other Riders</SelectLabel>}
                          {others.map(r => (
                            <SelectItem key={r.id} value={r.id.toString()}>{r.name} ({r.assignedCount} assigned)</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                );
              })()}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
                  <User className="mr-2 h-4 w-4" /> Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-medium text-base">{order.customerName}</div>
                <div className="text-sm">{order.customerPhone}</div>
                {order.alternatePhone && <div className="text-sm">{order.alternatePhone}</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
                  <Package className="mr-2 h-4 w-4" /> Package Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-medium text-base">{order.productName}</div>
                <div className="text-sm">Qty: {order.quantity} {order.productSku ? `| SKU: ${order.productSku}` : ''}</div>
                <div className="text-sm font-medium mt-1">COD: Rs. {order.codAmount.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" /> Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-base">{order.address}</div>
              <div className="text-sm text-muted-foreground">
                {[order.landmark, order.area, order.city, order.district].filter(Boolean).join(", ")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusHistory.map((history, i) => (
                  <div key={history.id} className="flex gap-4 relative">
                    {i !== statusHistory.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                    )}
                    <div className="relative z-10 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{history.status.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(history.createdAt), "MMM d, h:mm a")}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">by {history.changedByName}</div>
                      {history.note && <div className="text-sm mt-1 bg-muted p-2 rounded-md">{history.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center text-muted-foreground">
                <Clock className="mr-2 h-4 w-4" /> Logistics Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Vendor</div>
                <div className="font-medium">{order.vendorName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Assigned Station</div>
                <div className="font-medium">{order.stationName || "Not assigned"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Assigned Rider</div>
                <div className="font-medium">{order.riderName || "Not assigned"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Delivery Charge</div>
                <div className="font-medium">Rs. {order.deliveryCharge.toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[500px]">
            <CardHeader>
              <CardTitle>Comments</CardTitle>
              <CardDescription>Order updates and communication</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {comments?.map((comment) => (
                <div key={comment.id} className={`p-3 rounded-lg text-sm ${comment.visibility === 'internal' ? 'bg-amber-50 border border-amber-100' : 'bg-muted'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{comment.userName}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(comment.createdAt), "MMM d, h:mm a")}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{comment.content}</div>
                  {comment.visibility !== 'all' && (
                    <div className="text-[10px] mt-2 font-medium uppercase text-muted-foreground">{comment.visibility} ONLY</div>
                  )}
                </div>
              ))}
              {comments?.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">No comments yet</div>
              )}
            </CardContent>
            <div className="p-4 border-t bg-card mt-auto space-y-3">
              {["admin", "manager"].includes(user?.role || "") && (
                <Select value={commentVisibility} onValueChange={(v: any) => setCommentVisibility(v)}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Visible to everyone</SelectItem>
                    <SelectItem value="internal">Internal only</SelectItem>
                    <SelectItem value="vendor">Vendor & Internal</SelectItem>
                    <SelectItem value="rider">Rider & Internal</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Textarea 
                placeholder="Type a comment..." 
                className="resize-none min-h-[80px]"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button 
                className="w-full" 
                onClick={handleAddComment}
                disabled={!newComment.trim() || addCommentMutation.isPending}
              >
                {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Post Comment
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
