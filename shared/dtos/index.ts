import {
  MediumType as MediumTypeEnum,
  EventStatus,
  ProjectStatus,
} from "@/db/schema/enums";

export * from "./core";
export * from "./shop";
export * from "./activities";

export type Paginated<T> = {
  items: T[];
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

export type MediumType = (typeof MediumTypeEnum.enumValues)[number];
export type EventStatus = (typeof EventStatus.enumValues)[number];
export type ProjectStatus = (typeof ProjectStatus.enumValues)[number];
