"use client";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter } from "next/navigation";
import { CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";
import { NotificationType } from "@/lib/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { useNotificationsSocket } from "@/lib/use-notifications-socket";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

const TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.TASK_UPDATE]: "Task Update",
  [NotificationType.PROJECT_UPDATE]: "Project Update",
  [NotificationType.APPROVAL_REQUEST]: "Approval Request",
  [NotificationType.DUE_DATE_REMINDER]: "Due Date Reminder",
  [NotificationType.TEAM_ANNOUNCEMENT]: "Team Announcement",
  [NotificationType.MENTION]: "Mention",
};

const TYPE_BADGE_VARIANTS: Record<NotificationType, BadgeProps["variant"]> = {
  [NotificationType.TASK_UPDATE]: "secondary",
  [NotificationType.PROJECT_UPDATE]: "outline",
  [NotificationType.APPROVAL_REQUEST]: "warning",
  [NotificationType.DUE_DATE_REMINDER]: "destructive",
  [NotificationType.TEAM_ANNOUNCEMENT]: "muted",
  [NotificationType.MENTION]: "default",
};

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}) {
  const created = new Date(notification.createdAt);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(notification);
      }}
      className={cn(
        "cursor-pointer border-l-4 transition-colors hover:bg-muted/40",
        notification.isRead ? "border-l-transparent" : "border-l-primary bg-accent/30",
      )}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <span
          className={cn(
            "mt-2 h-2 w-2 shrink-0 rounded-full",
            notification.isRead ? "bg-transparent" : "bg-primary",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant={TYPE_BADGE_VARIANTS[notification.type]}>
              {TYPE_LABELS[notification.type] ?? notification.type}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(created, { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{format(created, "PPpp")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className={cn("mt-1.5 text-sm", !notification.isRead && "font-semibold")}>{notification.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => api.get<Notification[]>("/notifications"),
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  useNotificationsSocket((raw) => {
    const notification = raw as Partial<Notification> | null;
    toast(notification?.title ?? "New notification");
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  });

  const handleOpen = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Notification Center</h1>
          <p className="text-sm text-muted-foreground">
            {notificationsQuery.isLoading
              ? "Loading your notifications…"
              : unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllReadMutation.mutate()}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
        >
          <CheckCheck className="h-4 w-4" />
          {markAllReadMutation.isPending ? "Marking all read…" : "Mark all read"}
        </Button>
      </div>

      {notificationsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8" />
            No notifications yet. We&apos;ll let you know when something needs your attention.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
