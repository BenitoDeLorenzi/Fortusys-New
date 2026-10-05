export type AppNotificationSeverity = "info" | "success" | "warning" | "danger";

export type AppNotification = {
  id: string;
  category: string;
  type: string;
  title: string;
  message: string;
  severity: AppNotificationSeverity;
  actorUserId: string | null;
  actorName: string | null;
  originLabel: string;
  originDescription: string;
  entityType: string | null;
  entityId: string | null;
  actionHref: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};
