import { Medium } from "@/shared/dtos";
import { EventStatus, EventType } from "@/shared/utils";

export type YPFEvent = {
  id: string;
  name: string;
  description?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location?: string;
  objective?: string;
  status: EventStatus;
  type: EventType;
  projectTitle?: string;
  featuredMediumUrl?: string;
  chapterName?: string;
  // Count of guest + member rows in event_attendees for this event.
  // Used by the UMS Events table so admins see real registration numbers.
  attendeeCount: number;
};

export type YPFEventDetail = {
  id: string;
  name: string;
  description?: string;
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
  chapter?: {
    id: string;
    name: string;
  };
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  featuredDocuments?: {
    title: string;
    document: import("@/shared/dtos").Document;
  }[];
};

export type YPFEventMedium = {
  id: string;
  caption?: string;
  isFeatured: boolean;
  medium: Medium;
};
