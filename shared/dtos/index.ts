import { GenderEnum, MediumTypeEnum } from "@/db/schema/core";
import {
  EventStatusEnum,
  EventTypeEnum,
  ProjectStatusEnum,
} from "@/db/schema/activities";

export * from "./core";
export * from "./shop";
export * from "./events";
export * from "./projects";
export * from "./applications";

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
export type EventStatus = (typeof EventStatusEnum.enumValues)[number];
export type ProjectStatus = (typeof ProjectStatusEnum.enumValues)[number];
export type EventType = (typeof EventTypeEnum.enumValues)[number];
export type Gender = (typeof GenderEnum.enumValues)[number];
