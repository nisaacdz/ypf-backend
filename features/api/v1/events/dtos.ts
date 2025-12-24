import { Medium } from "@/shared/dtos";
import { EventStatus, EventType } from "@/shared/utils";

export type YPFEvent = {
  id: string;
  name: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location?: string;
  status: EventStatus;
  type: EventType;
  projectTitle?: string;
  welfareCaseTitle?: string;
  featuredMediumUrl?: string;
  chapterName?: string;
};

export type YPFEventDetail = {
  id: string;
  name: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location?: string;
  objective?: string;
  status: EventStatus;
  type: EventType;
  project?: {
    id: string;
    title: string;
    date: Date;
  };
  welfareCase?: {
    id: string;
    title: string;
    date?: Date;
  };
  chapter?: {
    id: string;
    name: string;
  };
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
};

export type YPFEventMedium = {
  id: string;
  caption?: string;
  isFeatured: boolean;
  medium: Medium;
};
