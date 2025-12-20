import { Medium } from "../core";
import { ProjectStatus } from "..";

export type YPFProject = {
  id: string;
  title: string;
  abstract?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: ProjectStatus;
  featuredMediumUrl?: string;
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

export type YPFProjectMedium = {
  id: string;
  caption?: string;
  isFeatured: boolean;
  medium: Medium;
};
