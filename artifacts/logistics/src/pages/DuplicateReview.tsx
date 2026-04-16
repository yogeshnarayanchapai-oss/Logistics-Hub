import { useListOrders, useHandleDuplicateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function DuplicateReview() {
  const { data, isLoading } = useListOrders({ duplicateOnly: true, limit: 50 });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "continue" | null>(null);
  const [note, setNote] = useState("");

  const handleDuplicateMutation = useHandleDuplicateOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ title: "Order duplicate status updated" });
        setSelectedOrderId(null);
        setActionType(null);
        setNote("");
      }
    }
  });

  const confirmAction = () => {
    if (!selectedOrderId || !actionType) return;
    
    handleDuplicateMutation.mutate({
      id: selectedOrderId,
      data: {
        action: actionType,
        note: note || undefined
      }
    });
  };

  const openActionDialog = (orderId: number, type: "approve" | "reject" | "continue") => {
    setSelectedOrderId(orderId);
    setActionType(type);
    setNote("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Duplicate Review</h2>
        <p className="text-muted-foreground">Review and manage orders flagged as potential duplicates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Flagged Orders
          </CardTitle>
          <CardDescription>
            These orders have matching phone numbers or addresses with recent active orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No duplicate flagged orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <Link href={`/orders/${order.id}`} className="text-primary hover:underline">
                            {order.orderCode}
                          </Link>
                          <div className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d, h:mm a")}</div>
                        </TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell>{order.customerPhone}</TableCell>
                        <TableCell>
                          <div className="text-sm">{order.duplicateReason}</div>
                          {order.matchedOrderId && (
                            <Link href={`/orders/${order.matchedOrderId}`} className="text-xs text-primary flex items-center mt-1">
                              View Matched Order <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            order.duplicateConfidence === 'high' ? 'bg-red-100 text-red-800' :
                            order.duplicateConfidence === 'medium' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.duplicateConfidence?.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={() => openActionDialog(order.id, "reject")}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                              onClick={() => openActionDialog(order.id, "continue")}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Allow
                            </Button>
                          </div>
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

      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "reject" ? "Reject Duplicate Order" : 
               actionType === "continue" ? "Allow Order (Not a Duplicate)" : 
               "Confirm Action"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "reject" ? 
                "This will mark the order as cancelled and notify the vendor that it's a duplicate." : 
                "This will clear the duplicate flag and allow the order to proceed normally."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Add a note (optional)</label>
              <Textarea 
                placeholder="Reason for this action..." 
                value={note} 
                onChange={(e) => setNote(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrderId(null)}>Cancel</Button>
            <Button 
              variant={actionType === "reject" ? "destructive" : "default"}
              onClick={confirmAction}
              disabled={handleDuplicateMutation.isPending}
            >
              {handleDuplicateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
