import { MembershipType as MembershipTypeEnum, MediaType as MediaTypeEnum, EventStatus, ProjectStatus } from "@/db/schema/enums";

export type Paginated<T> = {
  data: T[];
  pageSize: number; // the page size used
  page: number; // the current page
  total: number; // total number of items
};

export type Notification = {
    id: string;
    title: string;
    content: string;
    isRead: boolean;
    createdAt: string;
};

export type MembershipType = (typeof MembershipTypeEnum.enumValues)[number];
export type MediaType = (typeof MediaTypeEnum.enumValues)[number];
export type EventStatus = (typeof EventStatus.enumValues)[number];
export type ProjectStatus = (typeof ProjectStatus.enumValues)[number];
