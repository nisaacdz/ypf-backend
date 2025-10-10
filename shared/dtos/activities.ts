import { Media } from "./core";
import { EventStatus, ProjectStatus } from ".";

export type Project = {
  id: string;
  title: string;
  abstract: string;
  startedAt: string;
  endedAt?: string;
  status: ProjectStatus;
  featuredPhotoUrl?: string; // findOne 1
};

export type ProjectDetail = {
  id: string;
  title: string;
  abstract: string;
  objective: string | null;
  startedAt: string;
  endedAt?: string;
  status: ProjectStatus;
  budget: string | null;
  featuredPhotos: {
    id: string;
    caption: string;
    media: Media;
  }[]; // limited to 5
  chapter: {
    id: string;
    name: string;
  } | null;
};

export type Event = {
  id: string;
  eventName: string;
  eventDate: string;
  eventLocation: string | null;
  status: EventStatus;
  project?: {
    id: string;
    name: string;
  };
};

export type EventDetail = {
  id: string;
  eventName: string;
  eventDate: string;
  location: string | null;
  objectives: string | null; // markdown style?
  status: EventStatus;
  project: {
    id: string;
    name: string;
  } | null;
  participantCount: number;
  featuredPhotos: Media[]; // limited to 5
};
