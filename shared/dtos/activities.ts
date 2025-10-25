import { Medium } from "./core";
import { EventStatus, ProjectStatus } from ".";

export type YPFProject = {
  id: string;
  title: string;
  abstract?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: ProjectStatus;
  featuredPhotoUrl?: string;
  chapterName?: string;
};

export type YPFProjectDetail = {
  id: string;
  title: string;
  abstract?: string;
  description?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: ProjectStatus;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  chapter?: {
    id: string;
    name: string;
  };
};

export type YPFEvent = {
  id: string;
  name: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  location?: string;
  status: EventStatus;
  project?: {
    id: string;
    title: string;
  };
};

export type YPFEventDetail = {
  id: string;
  name: string;
  scheduledStart: Date;
  scheduledEnd: Date;
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

export type YPFEventMedium = {
  id: number;
  caption?: string;
  isFeatured: boolean;
  medium: Medium;
};

export type YPFProjectMedium = {
  id: string;
  caption?: string;
  isFeatured: boolean;
  medium: Medium;
};
