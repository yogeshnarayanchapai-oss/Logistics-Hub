import { useGetTicket, useAddTicketMessage, getGetTicketQueryKey, useUpdateTicket } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Send, Ticket as TicketIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const ticketId = parseInt(id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ticketData, isLoading } = useGetTicket(ticketId, {
    query: {
      enabled: !!ticketId,
      queryKey: getGetTicketQueryKey(ticketId)
    }
  });

  const [newMessage, setNewMessage] = useState("");

  const addMessageMutation = useAddTicketMessage({
    mutation: {
      onSuccess: () => {
        setNewMessage("");
        queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
        toast({ title: "Message sent" });
      },
      onError: () => {
        toast({ title: "Failed to send message", variant: "destructive" });
      }
    }
  });

  const updateTicketMutation = useUpdateTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
        toast({ title: "Ticket updated" });
      }
    }
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    addMessageMutation.mutate({
      id: ticketId,
      data: { message: newMessage }
    });
  };

  const handleStatusChange = (status: string) => {
    updateTicketMutation.mutate({
      id: ticketId,
      data: { status }
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!ticketData) {
    return <div>Ticket not found</div>;
  }

  const { ticket, messages } = ticketData;

  const getPriorityColor = (priority: string) => {
    if (priority === 'urgent') return "bg-red-100 text-red-800 border-red-200";
    if (priority === 'high') return "bg-orange-100 text-orange-800 border-orange-200";
    if (priority === 'medium') return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusColor = (status: string) => {
    if (status === 'open') return "bg-green-100 text-green-800";
    if (status === 'in_progress') return "bg-blue-100 text-blue-800";
    if (status === 'waiting_reply') return "bg-yellow-100 text-yellow-800";
    if (status === 'resolved') return "bg-gray-200 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/tickets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{ticket.subject}</h2>
              <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                {ticket.priority.toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              #{ticket.id} • Opened by {ticket.createdByName} on {format(new Date(ticket.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        {["admin", "manager"].includes(user?.role || "") && (
          <div className="flex items-center gap-2">
            <Select onValueChange={handleStatusChange} defaultValue={ticket.status}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Update Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_reply">Waiting Reply</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TicketIcon className="h-5 w-5 text-muted-foreground" />
                  Conversation
                </div>
                <Badge variant="secondary" className={`capitalize ${getStatusColor(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
              {messages.map((msg) => {
                const isCurrentUser = msg.userId === user?.id;
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isCurrentUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium">{isCurrentUser ? 'You' : msg.userName}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{msg.userRole}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdAt), "h:mm a")}</span>
                    </div>
                    <div className={`p-3 rounded-lg text-sm ${isCurrentUser ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                      <div className="whitespace-pre-wrap">{msg.message}</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <div className="p-4 border-t bg-card mt-auto">
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Type your message..." 
                  className="resize-none min-h-[60px]"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={ticket.status === 'closed'}
                />
                <Button 
                  className="h-auto shrink-0" 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || addMessageMutation.isPending || ticket.status === 'closed'}
                >
                  {addMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {ticket.status === 'closed' && (
                <p className="text-xs text-center text-muted-foreground mt-2">This ticket is closed. You cannot send new messages.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Category</div>
                <div className="font-medium capitalize">{ticket.category.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Priority</div>
                <div className="font-medium capitalize">{ticket.priority}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-medium capitalize">{ticket.status.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="font-medium">{format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last Updated</div>
                <div className="font-medium">{format(new Date(ticket.updatedAt), "MMM d, yyyy h:mm a")}</div>
              </div>
            </CardContent>
          </Card>

          {ticket.assignedToName && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                    {ticket.assignedToName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{ticket.assignedToName}</div>
                    <div className="text-xs text-muted-foreground">Assigned Agent</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
