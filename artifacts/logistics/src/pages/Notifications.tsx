import { useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCircle2, Check } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Notifications() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data: notifications, isLoading } = useListNotifications({ unreadOnly: unreadOnly || undefined });
  const queryClient = useQueryClient();

  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    }
  });

  const markAllReadMutation = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    }
  });

  const handleMarkRead = (id: number) => {
    markReadMutation.mutate({ id });
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground">Stay updated on your logistics operations.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch id="unread" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
            <Label htmlFor="unread">Unread only</Label>
          </div>
          <Button variant="outline" onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending || !notifications?.some(n => !n.isRead)}>
            {markAllReadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Mark all as read
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Your Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="divide-y">
              {notifications?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No notifications found.</p>
                </div>
              ) : (
                notifications?.map((notification) => (
                  <div key={notification.id} className={`p-4 flex gap-4 transition-colors hover:bg-muted/50 ${!notification.isRead ? 'bg-primary/5' : ''}`}>
                    <div className="mt-1">
                      {notification.isRead ? (
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm ${!notification.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                          {notification.title}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.message}
                      </p>
                      {!notification.isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-0 mt-2 text-primary hover:text-primary/80 hover:bg-transparent"
                          onClick={() => handleMarkRead(notification.id)}
                          disabled={markReadMutation.isPending}
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
