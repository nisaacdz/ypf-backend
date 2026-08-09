import dbClient from "@/configs/db";
import { Posts } from "@/db/schema/content";
import { Constituents, Documents, Media } from "@/db/schema/core";
import { Paginated } from "@/shared/dtos";
import { YPFPost, YPFPostDetail } from "@/features/api/v1/posts/dtos";
import {
  GetAdminPostsQuerySchema,
  GetPostsQuerySchema,
  CreatePostSchema,
  UpdatePostSchema,
} from "@/features/api/v1/posts/schemas";
import { ApiError } from "@/shared/types";
import { sanitizeRichHtml } from "@/shared/utils/htmlSanitize";
import {
  assertPublishable,
  readingMinutes,
  slugify,
} from "@/shared/utils/postContent";
import * as mediaUtils from "@/shared/utils/files";
import { and, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";

/** Cover thumbnails on list endpoints — full-size is wasted bytes in a grid. */
const LIST_COVER_WIDTH = 800;
const DETAIL_COVER_WIDTH = 1600;

type PostRow = {
  id: string;
  publicId: string;
  section: YPFPost["section"];
  slug: string;
  title: string;
  dek: string | null;
  excerpt: string | null;
  status: YPFPost["status"];
  publishedAt: Date | null;
  readingMinutes: number | null;
  tags: string[] | null;
  reportYear: number | null;
  isFeatured: boolean;
  coverExternalId: string | null;
  documentId: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorPreferredName: string | null;
  authorPhotoExternalId: string | null;
};

function authorName(row: PostRow): string | undefined {
  const first = row.authorPreferredName || row.authorFirstName;
  if (!first && !row.authorLastName) return undefined;
  return [first, row.authorLastName].filter(Boolean).join(" ");
}

function toPost(row: PostRow, coverWidth: number): YPFPost {
  const name = authorName(row);
  return {
    id: row.id,
    publicId: row.publicId,
    section: row.section,
    slug: row.slug,
    title: row.title,
    dek: row.dek ?? undefined,
    excerpt: row.excerpt ?? undefined,
    status: row.status,
    publishedAt: row.publishedAt ?? undefined,
    readingMinutes: row.readingMinutes ?? undefined,
    tags: row.tags ?? undefined,
    reportYear: row.reportYear ?? undefined,
    coverUrl: row.coverExternalId
      ? mediaUtils.generatePublicMediaUrl(row.coverExternalId, {
          resolution: coverWidth,
        })
      : undefined,
    isFeatured: row.isFeatured,
    author: name
      ? {
          name,
          avatarUrl: row.authorPhotoExternalId
            ? mediaUtils.generatePublicMediaUrl(row.authorPhotoExternalId, {
                resolution: 200,
              })
            : undefined,
        }
      : undefined,
    hasDocument: Boolean(row.documentId),
  };
}

/**
 * Media is joined twice — once for the post cover, once for the author's
 * profile photo — so both need aliases to coexist in one statement.
 */
const CoverMedia = alias(Media, "cover_media");
const Author = alias(Constituents, "author");
const AuthorPhoto = alias(Media, "author_photo");

const postColumns = {
  id: Posts.id,
  publicId: Posts.publicId,
  section: Posts.section,
  slug: Posts.slug,
  title: Posts.title,
  dek: Posts.dek,
  excerpt: Posts.excerpt,
  status: Posts.status,
  publishedAt: Posts.publishedAt,
  readingMinutes: Posts.readingMinutes,
  tags: Posts.tags,
  reportYear: Posts.reportYear,
  isFeatured: Posts.isFeatured,
  documentId: Posts.documentId,
  coverExternalId: CoverMedia.externalId,
  authorFirstName: Author.firstName,
  authorLastName: Author.lastName,
  authorPreferredName: Author.preferredName,
  authorPhotoExternalId: AuthorPhoto.externalId,
};

/** Shared FROM/JOIN chain for every post read. */
function selectPosts() {
  return dbClient.db
    .select(postColumns)
    .from(Posts)
    .leftJoin(CoverMedia, eq(Posts.coverMediaId, CoverMedia.id))
    .leftJoin(Author, eq(Posts.authorId, Author.id))
    .leftJoin(AuthorPhoto, eq(Author.profilePhotoId, AuthorPhoto.id));
}

function buildConditions(
  query: z.infer<typeof GetAdminPostsQuerySchema>,
  opts: { publishedOnly: boolean },
) {
  const conditions = [];

  if (opts.publishedOnly) {
    conditions.push(eq(Posts.status, "PUBLISHED"));
  } else if (query.status) {
    conditions.push(eq(Posts.status, query.status));
  }

  if (query.section) conditions.push(eq(Posts.section, query.section));
  if (query.year) conditions.push(eq(Posts.reportYear, query.year));
  if (query.tag) {
    // jsonb array containment — `tags @> '["mentorship"]'`.
    conditions.push(sql`${Posts.tags} @> ${JSON.stringify([query.tag])}::jsonb`);
  }
  if (query.search) {
    conditions.push(
      or(
        ilike(Posts.title, `%${query.search}%`),
        ilike(Posts.dek, `%${query.search}%`),
        ilike(Posts.excerpt, `%${query.search}%`),
      ),
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function fetchPosts(
  query: z.infer<typeof GetPostsQuerySchema> &
    Partial<z.infer<typeof GetAdminPostsQuerySchema>>,
  opts: { publishedOnly: boolean } = { publishedOnly: true },
): Promise<Paginated<YPFPost>> {
  const { page, pageSize } = query;
  const offset = (page - 1) * pageSize;
  const whereClause = buildConditions(
    query as z.infer<typeof GetAdminPostsQuerySchema>,
    opts,
  );

  const [rows, totalResult] = await Promise.all([
    selectPosts()
      .where(whereClause)
      // Drafts have no publishedAt, so fall back to createdAt for the admin list.
      .orderBy(desc(sql`coalesce(${Posts.publishedAt}, ${Posts.createdAt})`))
      .limit(pageSize)
      .offset(offset),
    dbClient.db.select({ value: count() }).from(Posts).where(whereClause),
  ]);

  return {
    items: (rows as PostRow[]).map((row) => toPost(row, LIST_COVER_WIDTH)),
    page,
    pageSize,
    total: totalResult[0]?.value ?? 0,
  };
}

/**
 * The post that headlines a section: the pinned one if an editor set it,
 * otherwise the most recently published.
 */
export async function fetchFeaturedPost(
  section: YPFPost["section"],
): Promise<YPFPost | null> {
  const rows = await selectPosts()
    .where(and(eq(Posts.section, section), eq(Posts.status, "PUBLISHED")))
    .orderBy(desc(Posts.isFeatured), desc(Posts.publishedAt))
    .limit(1);

  const row = (rows as PostRow[])[0];
  return row ? toPost(row, DETAIL_COVER_WIDTH) : null;
}

export async function fetchPostBySlug(
  slug: string,
  opts: { publishedOnly: boolean } = { publishedOnly: true },
): Promise<YPFPostDetail> {
  const conditions = [eq(Posts.slug, slug)];
  if (opts.publishedOnly) conditions.push(eq(Posts.status, "PUBLISHED"));

  const rows = await selectPosts()
    .where(and(...conditions))
    .limit(1);

  const row = (rows as PostRow[])[0];
  if (!row) throw new ApiError("Post not found", 404);

  // The heavy columns aren't in the shared select — fetch them only for detail.
  const extra = await dbClient.db.query.Posts.findFirst({
    where: eq(Posts.id, row.id),
    columns: {
      body: true,
      seoTitle: true,
      seoDescription: true,
      consentOnFile: true,
      createdAt: true,
      updatedAt: true,
      documentId: true,
    },
  });

  let documentSize: number | undefined;
  if (extra?.documentId) {
    const doc = await dbClient.db.query.Documents.findFirst({
      where: eq(Documents.id, extra.documentId),
      columns: { size: true },
    });
    documentSize = doc?.size;
  }

  return {
    ...toPost(row, DETAIL_COVER_WIDTH),
    body: extra?.body ?? undefined,
    seoTitle: extra?.seoTitle ?? undefined,
    seoDescription: extra?.seoDescription ?? undefined,
    documentUrl: extra?.documentId
      ? `/api/v1/posts/${row.slug}/document`
      : undefined,
    documentSize,
    consentOnFile: extra?.consentOnFile ?? false,
    createdAt: extra?.createdAt ?? new Date(),
    updatedAt: extra?.updatedAt ?? new Date(),
  };
}

/** Resolves the storage id behind a published post's PDF, for the redirect route. */
export async function fetchPostDocumentExternalId(
  slug: string,
): Promise<string> {
  const post = await dbClient.db.query.Posts.findFirst({
    where: and(eq(Posts.slug, slug), eq(Posts.status, "PUBLISHED")),
    columns: { documentId: true },
  });

  if (!post?.documentId) throw new ApiError("Document not found", 404);

  const doc = await dbClient.db.query.Documents.findFirst({
    where: eq(Documents.id, post.documentId),
    columns: { externalId: true },
  });

  if (!doc) throw new ApiError("Document not found", 404);
  return doc.externalId;
}

/** Appends -2, -3 … until the slug is free. */
async function uniqueSlug(base: string, excludePostId?: string) {
  let candidate = base || "post";
  let suffix = 1;

  for (;;) {
    const existing = await dbClient.db.query.Posts.findFirst({
      where: eq(Posts.slug, candidate),
      columns: { id: true },
    });
    if (!existing || existing.id === excludePostId) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function createPost(
  input: z.infer<typeof CreatePostSchema>,
): Promise<string> {
  const slug = await uniqueSlug(input.slug ?? slugify(input.title));
  const body = input.body ? sanitizeRichHtml(input.body) : undefined;

  assertPublishable({ ...input, body }, input.status);

  const [created] = await dbClient.db
    .insert(Posts)
    .values({
      section: input.section,
      slug,
      title: input.title,
      dek: input.dek,
      excerpt: input.excerpt,
      body,
      tags: input.tags,
      reportYear: input.reportYear,
      authorId: input.authorId,
      isFeatured: input.isFeatured ?? false,
      consentOnFile: input.consentOnFile ?? false,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      status: input.status,
      readingMinutes: readingMinutes(body),
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
    })
    .returning({ id: Posts.id });

  return created.id;
}

export async function updatePost(
  postId: string,
  updates: z.infer<typeof UpdatePostSchema>,
): Promise<void> {
  const existing = await dbClient.db.query.Posts.findFirst({
    where: eq(Posts.id, postId),
  });
  if (!existing) throw new ApiError("Post not found", 404);

  const merged = {
    section: updates.section ?? existing.section,
    body:
      updates.body !== undefined
        ? sanitizeRichHtml(updates.body)
        : existing.body,
    consentOnFile: updates.consentOnFile ?? existing.consentOnFile,
    reportYear: updates.reportYear ?? existing.reportYear,
  };
  const nextStatus = updates.status ?? existing.status;

  assertPublishable(merged, nextStatus);

  // Slugs are frozen once live — changing one breaks every shared link.
  let slug = existing.slug;
  if (updates.slug && updates.slug !== existing.slug) {
    if (existing.status === "PUBLISHED") {
      throw new ApiError(
        "The URL of a published post cannot be changed. Unpublish it first.",
        400,
      );
    }
    slug = await uniqueSlug(updates.slug, postId);
  }

  await dbClient.db
    .update(Posts)
    .set({
      section: merged.section,
      slug,
      title: updates.title ?? existing.title,
      dek: updates.dek ?? existing.dek,
      excerpt: updates.excerpt ?? existing.excerpt,
      body: merged.body,
      tags: updates.tags ?? existing.tags,
      reportYear: merged.reportYear,
      authorId: updates.authorId ?? existing.authorId,
      isFeatured: updates.isFeatured ?? existing.isFeatured,
      consentOnFile: merged.consentOnFile,
      seoTitle: updates.seoTitle ?? existing.seoTitle,
      seoDescription: updates.seoDescription ?? existing.seoDescription,
      status: nextStatus,
      readingMinutes: readingMinutes(merged.body ?? undefined),
      // Stamp the first publish; keep the original date on later edits.
      publishedAt:
        nextStatus === "PUBLISHED"
          ? (existing.publishedAt ?? new Date())
          : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(Posts.id, postId));

  // Only one post per section can headline it.
  if (updates.isFeatured) {
    await dbClient.db
      .update(Posts)
      .set({ isFeatured: false })
      .where(and(eq(Posts.section, merged.section), ne(Posts.id, postId)));
  }
}

export async function deletePost(postId: string): Promise<void> {
  const existing = await dbClient.db.query.Posts.findFirst({
    where: eq(Posts.id, postId),
    columns: { id: true },
  });
  if (!existing) throw new ApiError("Post not found", 404);

  await dbClient.db.delete(Posts).where(eq(Posts.id, postId));
}

export async function setPostCover(
  postId: string,
  mediumId: string,
): Promise<void> {
  await dbClient.db
    .update(Posts)
    .set({ coverMediaId: mediumId, updatedAt: new Date() })
    .where(eq(Posts.id, postId));
}

export async function setPostDocument(
  postId: string,
  documentId: string,
): Promise<void> {
  await dbClient.db
    .update(Posts)
    .set({ documentId, updatedAt: new Date() })
    .where(eq(Posts.id, postId));
}

export async function assertPostExists(postId: string): Promise<void> {
  const post = await dbClient.db.query.Posts.findFirst({
    where: eq(Posts.id, postId),
    columns: { id: true },
  });
  if (!post) throw new ApiError("Post not found", 404);
}
