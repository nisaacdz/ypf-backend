import {
  boolean,
  integer,
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { Constituents, Documents, Media, citext } from "./core";

/**
 * Public-facing editorial content — the three publication sections on the
 * website: Annual Report, Our Research, and Stories of Transformation.
 *
 * Deliberately separate from `activities` (projects/events, which are things
 * the org *does*) and from `app.announcements` (an internal, authenticated,
 * per-recipient feed). Posts here are anonymous-readable once PUBLISHED.
 */
export const content = pgSchema("content");

export const PostSectionEnum = content.enum("post_section", [
  "ANNUAL_REPORT",
  "RESEARCH",
  "STORY",
]);

export const PostStatusEnum = content.enum("post_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export const Posts = content.table(
  "posts",
  {
    id: uuid().defaultRandom().primaryKey(),
    publicId: text("public_id")
      .default(sql`'YPFB-' || generate_alphanumeric_combination(8)`)
      .unique()
      .notNull(),

    section: PostSectionEnum().notNull(),

    /**
     * The public URL key (`/stories/:slug`). Case-insensitive so
     * `/stories/Her-First-Term` and `/stories/her-first-term` resolve to the
     * same post rather than 404-ing. Frozen once the post is PUBLISHED —
     * changing it breaks live links and anything already shared.
     */
    slug: citext("slug").notNull().unique(),

    title: text().notNull(),
    /** Standfirst — the sentence under the headline on the article page. */
    dek: text(),
    /** Card copy on the section index. Falls back to a body excerpt. */
    excerpt: text(),
    /** Sanitised HTML from the UMS editor. Never store raw editor output. */
    body: text(),

    status: PostStatusEnum().default("DRAFT").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Computed on save (words / 200) so the client never has to guess. */
    readingMinutes: integer("reading_minutes"),

    tags: jsonb("tags").$type<string[]>(),
    /** ANNUAL_REPORT only — the year the report covers. */
    reportYear: integer("report_year"),

    coverMediaId: uuid("cover_media_id").references(() => Media.id, {
      onDelete: "set null",
    }),
    /** ANNUAL_REPORT only — the downloadable PDF. */
    documentId: uuid("document_id").references(() => Documents.id, {
      onDelete: "set null",
    }),
    authorId: uuid("author_id").references(() => Constituents.id, {
      onDelete: "set null",
    }),

    /** Pins the post to the section hero instead of the newest one. */
    isFeatured: boolean("is_featured").notNull().default(false),

    /**
     * Safeguarding gate for Stories of Transformation. Those posts are about
     * real, often vulnerable people — sometimes children — so a story cannot
     * be moved to PUBLISHED until written consent is on file.
     */
    consentOnFile: boolean("consent_on_file").notNull().default(false),

    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Drives every public list query: section feed, newest first.
    index("idx_posts_section_status_published").on(
      table.section,
      table.status,
      table.publishedAt,
    ),
  ],
);

/**
 * Inline/gallery imagery belonging to a post. Cascades so images are cleaned
 * up with the post, mirroring `activities.project_media`.
 */
export const PostMedia = content.table("post_media", {
  id: uuid().defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => Posts.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Media.id, {
    onDelete: "cascade",
  }),
  caption: text(),
});

export const postsRelations = relations(Posts, ({ one, many }) => ({
  coverMedium: one(Media, {
    fields: [Posts.coverMediaId],
    references: [Media.id],
  }),
  document: one(Documents, {
    fields: [Posts.documentId],
    references: [Documents.id],
  }),
  author: one(Constituents, {
    fields: [Posts.authorId],
    references: [Constituents.id],
  }),
  media: many(PostMedia),
}));

export const postMediaRelations = relations(PostMedia, ({ one }) => ({
  post: one(Posts, {
    fields: [PostMedia.postId],
    references: [Posts.id],
  }),
  medium: one(Media, {
    fields: [PostMedia.mediumId],
    references: [Media.id],
  }),
}));
