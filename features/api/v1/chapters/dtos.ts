import { Medium } from "@/shared/dtos";

// exclude archivedAt non null from lists
export type YPFChapter = {
  id: string;
  name: string;
  country: string;
  featuredPhotoUrl?: string;
  memberCount: number;
  foundingDate: Date;
  // Currently-assigned chapter lead / head constituent ids and display
  // names. Populated from MemberTitlesAssignments via MemberTitles where
  // chapter_id = this chapter and alias in ('chapterlead','chapterhead').
  // Either may be null when no one holds the role. Used by the chapters
  // table to render an "Assigned to <name>" tag instead of "Unassigned"
  // once leadership is set via the chapter detail page.
  leadConstituentId?: string;
  leadName?: string;
  headConstituentId?: string;
  headName?: string;
};

export type YPFChapterDetail = {
  id: string;
  name: string;
  country: string;
  description?: string;
  foundingDate: Date;
  // from chaptermedia table, filter isFeatured = true, sort by latest, limit to 5
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[]; // all featured ChapterMedia -- don't worry it won't be plenty -- average of 1.5 max of 5
  isActive: boolean; // true if archived at is null
  parentChapter?: {
    id: string;
    name: string;
  };
};
