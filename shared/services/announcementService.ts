import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { TargetingFilter } from "@/shared/types/targeting";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { JobNames, JobPriority } from "@/shared/jobs/types/definitions";
import logger from "@/configs/logger";

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
  const [announcement] = await dbClient.db
    .insert(schema.Announcements)
    .values({
      title: input.title,
      content: input.content,
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
        expireInHours: 24,
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
 * announcements (not expired) that have been routed to them via
 * `constituent_announcements`. Includes per-recipient read state.
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
    eq(schema.ConstituentAnnouncements.constituentId, constituentId),
    eq(schema.Announcements.status, "PUBLISHED"),
    or(
      isNull(schema.Announcements.expiresAt),
      gt(schema.Announcements.expiresAt, new Date()),
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
      isRead: schema.ConstituentAnnouncements.isRead,
      readAt: schema.ConstituentAnnouncements.readAt,
    })
    .from(schema.ConstituentAnnouncements)
    .innerJoin(
      schema.Announcements,
      eq(
        schema.ConstituentAnnouncements.announcementId,
        schema.Announcements.id,
      ),
    )
    .where(baseWhere)
    .orderBy(desc(schema.Announcements.publishedAt))
    .limit(pageSize)
    .offset(offset);

  const [{ count }] = await dbClient.db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.ConstituentAnnouncements)
    .innerJoin(
      schema.Announcements,
      eq(
        schema.ConstituentAnnouncements.announcementId,
        schema.Announcements.id,
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
