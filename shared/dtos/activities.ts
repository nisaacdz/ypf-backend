import { Medium } from "./core";
import { EventStatus, ProjectStatus } from ".";

export type Project = {
  id: string;
  title: string;
  abstract?: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: ProjectStatus;
  featuredPhotoUrl?: string;
  chapterName?: string;
};

export type ProjectDetail = {
  id: string;
  title: string;
  abstract?: string;
  description?: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: ProjectStatus;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  chapter?: {
    id:string;
    name: string;
  };
};

export type Event = {
  id: string;
  name: string;
  scheduledStart: string;
  scheduledEnd: string;

  location?: string;
  status: EventStatus;
  project?: {
    id: string;
    title: string;
  };
};

export type EventDetail = {
  id: string;
  name: string;
  scheduledStart: string;
  scheduledEnd: string;
  location?: string;
  objective?: string;
  status: EventStatus;
  project?: {
    id: string;
    title: string;
  };
  participantCount: number;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
};