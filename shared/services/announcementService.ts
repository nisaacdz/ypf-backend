import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { TargetingFilter } from "@/shared/types/targeting";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { JobNames, JobPriority } from "@/shared/jobs/types/definitions";
import logger from "@/configs/logger";
import { sanitizeRichHtml } from "@/shared/utils/htmlSanitize";

export type CreateAnnouncementInput = {
  title: string;
  content: string;
  targetCriteria: TargetingFilter;
  authorId: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt?: Date;
  expiresAt?: Date;
};

export async function createAnnouncement(input: CreateAnnouncementInput) {
  // Sanitize on the way in so the stored body is already safe — both the
  // in-app rendering and the email/SMS fan-out trust this column. Doing it
  // here (rather than at every read site) keeps the trust boundary explicit.
  const safeContent = sanitizeRichHtml(input.content);

  const [announcement] = await dbClient.db
    .insert(schema.Announcements)
    .values({
      title: input.title,
      content: safeContent,
      targetCriteria: input.targetCriteria,
      authorId: input.authorId,
      status: input.status || "DRAFT",
      publishedAt: input.publishedAt,
      expiresAt: input.expiresAt,
    })
    .returning();

  return announcement;
}

/**
 * Queues announcement for publication via job system
 */
export async function publishAnnouncement(announcementId: string) {
  try {
    // Queue the job with high priority
    const jobId = await jobDispatcher.client.send(
      JobNames.PUBLISH_ANNOUNCEMENT,
      { announcementId },
      {
        priority: JobPriority.HIGH,
        retryLimit: 2,
        retryDelay: 300, // 5 minutes
        expireInHours: 23,
      },
    );

    logger.info(
      { announcementId, jobId },
      "Queued announcement for publishing",
    );

    return { jobId };
  } catch (error) {
    logger.error(
      { announcementId, error },
      "Failed to queue announcement for publishing",
    );
    throw error;
  }
}

/**
 * Returns the authenticated constituent's announcement feed: PUBLISHED
 * announcements (not expired) that have either been routed to them via
 * `constituent_announcements` or were authored by them. Authored announcements
 * appear immediately, even before the async publishing worker creates inbox
 * entries.
 *
 * Used by `GET /api/v1/announcements`.
 */
export async function getConstituentAnnouncements(
  constituentId: string,
  query: { page?: number; pageSize?: number } = {},
) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 50, 100);
  const offset = (page - 1) * pageSize;

  const baseWhere = and(
    eq(schema.Announcements.status, "PUBLISHED"),
    or(
      isNull(schema.Announcements.expiresAt),
      gt(schema.Announcements.expiresAt, new Date()),
    ),
    or(
      eq(schema.ConstituentAnnouncements.constituentId, constituentId),
      eq(schema.Announcements.authorId, constituentId),
    ),
  );

  const rows = await dbClient.db
    .select({
      id: schema.Announcements.id,
      title: schema.Announcements.title,
      content: schema.Announcements.content,
      status: schema.Announcements.status,
      publishedAt: schema.Announcements.publishedAt,
      expiresAt: schema.Announcements.expiresAt,
      isRead: sql<boolean>`coalesce(${schema.ConstituentAnnouncements.isRead}, true)`,
      readAt: schema.ConstituentAnnouncements.readAt,
    })
    .from(schema.Announcements)
    .leftJoin(
      schema.ConstituentAnnouncements,
      and(
        eq(
          schema.ConstituentAnnouncements.announcementId,
          schema.Announcements.id,
        ),
        eq(schema.ConstituentAnnouncements.constituentId, constituentId),
      ),
    )
    .where(baseWhere)
    .orderBy(desc(schema.Announcements.publishedAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await dbClient.db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.Announcements)
    .leftJoin(
      schema.ConstituentAnnouncements,
      and(
        eq(
          schema.ConstituentAnnouncements.announcementId,
          schema.Announcements.id,
        ),
        eq(schema.ConstituentAnnouncements.constituentId, constituentId),
      ),
    )
    .where(baseWhere);

  return {
    items: rows,
    page,
    pageSize,
    total: count,
  };
}

export async function getConstituentAnnouncementById(
  constituentId: string,
  announcementId: string,
) {
  const [row] = await dbClient.db
    .select({
      id: schema.Announcements.id,
      title: schema.Announcements.title,
      content: schema.Announcements.content,
      status: schema.Announcements.status,
      publishedAt: schema.Announcements.publishedAt,
      expiresAt: schema.Announcements.expiresAt,
      isRead: sql<boolean>`coalesce(${schema.ConstituentAnnouncements.isRead}, true)`,
      readAt: schema.ConstituentAnnouncements.readAt,
    })
    .from(schema.Announcements)
    .leftJoin(
      schema.ConstituentAnnouncements,
      and(
        eq(
          schema.ConstituentAnnouncements.announcementId,
          schema.Announcements.id,
        ),
        eq(schema.ConstituentAnnouncements.constituentId, constituentId),
      ),
    )
    .where(
      and(
        eq(schema.Announcements.id, announcementId),
        eq(schema.Announcements.status, "PUBLISHED"),
        or(
          isNull(schema.Announcements.expiresAt),
          gt(schema.Announcements.expiresAt, new Date()),
        ),
        or(
          eq(schema.ConstituentAnnouncements.constituentId, constituentId),
          eq(schema.Announcements.authorId, constituentId),
        ),
      ),
    );

  return row ?? null;
}

export async function markConstituentAnnouncementRead(
  constituentId: string,
  announcementId: string,
) {
  await dbClient.db
    .update(schema.ConstituentAnnouncements)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(schema.ConstituentAnnouncements.constituentId, constituentId),
        eq(schema.ConstituentAnnouncements.announcementId, announcementId),
      ),
    );
}

export async function updateAnnouncement(
  announcementId: string,
  updates: Partial<{
    title: string;
    content: string;
    targetCriteria: TargetingFilter;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    publishedAt: Date;
    expiresAt: Date | null;
  }>,
) {
  // Re-sanitize content on edit so updates can't smuggle script tags in.
  const safeUpdates =
    updates.content !== undefined
      ? { ...updates, content: sanitizeRichHtml(updates.content) }
      : updates;

  const [announcement] = await dbClient.db
    .update(schema.Announcements)
    .set({ ...safeUpdates, updatedAt: new Date() })
    .where(eq(schema.Announcements.id, announcementId))
    .returning({ id: schema.Announcements.id });

  return announcement;
}

export async function archiveAnnouncement(announcementId: string) {
  await updateAnnouncement(announcementId, { status: "ARCHIVED" });
}
