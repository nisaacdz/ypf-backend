import { Paginated } from ".";

export type Notification = {
  id: string;
  type: "ANNOUNCEMENT" | "APP";
  title: string;
  isRead: boolean;
};

export type FetchNotifications = Paginated<Notification> & { unread: number };

export type NotificationDetail = {
  id: string;
  type: "ANNOUNCEMENT" | "APP";
  title: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
};
