import { Medium } from "../core";
import { EventStatus, EventType } from "..";

export type YPFEvent = {
  id: string;
  name: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location?: string;
  status: EventStatus;
  type: EventType;
  projectTitle?: string;
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
