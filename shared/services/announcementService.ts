import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { AudienceRule } from "@/shared/types/targeting";
import { resolveAudience } from "./targetResolver";
import { sendAnnouncementEmail } from "@/shared/utils/email";
import { eq, inArray, and } from "drizzle-orm";
import logger from "@/configs/logger";

export type CreateAnnouncementInput = {
  title: string;
  content: string;
  targetCriteria: AudienceRule;
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

export async function publishAnnouncement(announcementId: string) {
  const [announcement] = await dbClient.db
    .select()
    .from(schema.Announcements)
    .where(eq(schema.Announcements.id, announcementId));

  if (!announcement) {
    throw new Error("Announcement not found");
  }

  // 1. Resolve Audience
  const constituentIdsSet = await resolveAudience(announcement.targetCriteria);
  const constituentIds = Array.from(constituentIdsSet);

  if (constituentIds.length === 0) {
    logger.info(`No constituents found for announcement ${announcementId}`);
    return;
  }

  // 2. Create ConstituentAnnouncements (Inbox entries)
  // We need to handle potential duplicates if we run this multiple times,
  // but the unique constraint (announcementId, constituentId) handles it at DB level.
  // However, Drizzle's `onConflictDoNothing` is useful here.

  const inboxEntries = constituentIds.map((cid) => ({
    announcementId: announcement.id,
    constituentId: cid,
    isRead: false,
    emailSent: false, // We'll update this after sending? Or assume sent?
    // Actually, we track email sending separately or just fire-and-forget.
    // Let's mark emailSent as false initially.
  }));

  // Batch insert
  // Postgres has a limit on parameters, so we might need to chunk if list is huge.
  // For now, assuming reasonable size or Drizzle handles it.
  // If huge, we should chunk. Let's chunk by 1000.
  const chunkSize = 1000;
  for (let i = 0; i < inboxEntries.length; i += chunkSize) {
    const chunk = inboxEntries.slice(i, i + chunkSize);
    await dbClient.db
      .insert(schema.ConstituentAnnouncements)
      .values(chunk)
      .onConflictDoNothing()
      .execute();
  }

  // 3. Fetch Emails
  // We only want to send emails to those we just targeted.
  // And we prioritize primary email.
  const contacts = await dbClient.db
    .select({
      constituentId: schema.ContactInformations.constituentId,
      email: schema.ContactInformations.value,
      isPrimary: schema.ContactInformations.isPrimary,
    })
    .from(schema.ContactInformations)
    .where(
      and(
        inArray(schema.ContactInformations.constituentId, constituentIds),
        eq(schema.ContactInformations.contactType, "EMAIL"),
      ),
    );

  // Deduplicate and prioritize primary
  const emailMap = new Map<string, string>();
  for (const contact of contacts) {
    // If we haven't seen this constituent yet, OR if this is a primary email (overwriting non-primary), set it.
    // Note: If we already have a primary email, we don't overwrite.
    // If we have a non-primary, and this is primary, we overwrite.
    // If we have a non-primary, and this is non-primary, we don't care (keep first).

    const existing = emailMap.get(contact.constituentId);
    if (!existing) {
      emailMap.set(contact.constituentId, contact.email);
    } else if (contact.isPrimary) {
      // We need to know if the existing one was primary.
      // The query doesn't guarantee order unless we sort.
      // Let's sort the contacts array first: Primary first.
      // Then we can just take the first one we see.
    }
  }

  // Better approach: Sort contacts by isPrimary desc
  contacts.sort((a, b) => {
    if (a.isPrimary === b.isPrimary) return 0;
    return a.isPrimary ? -1 : 1;
  });

  const finalEmails: string[] = [];
  const seenConstituents = new Set<string>();

  for (const contact of contacts) {
    if (!seenConstituents.has(contact.constituentId)) {
      finalEmails.push(contact.email);
      seenConstituents.add(contact.constituentId);
    }
  }

  // 4. Fire and Forget Email Sending
  // We wrap in try-catch to not block the response, but since this function is likely called
  // by a background job or an admin endpoint, we might want to await it or at least log.
  // The user said "fire (without awaiting)".

  (async () => {
    try {
      await sendAnnouncementEmail(
        finalEmails,
        announcement.title,
        announcement.content,
      );

      // Update status to PUBLISHED if not already
      await dbClient.db
        .update(schema.Announcements)
        .set({ status: "PUBLISHED", publishedAt: new Date() })
        .where(eq(schema.Announcements.id, announcementId));

      // Update emailSent flag for the constituents who were on the list
      // We can do this by matching announcementId and constituentId
      if (seenConstituents.size > 0) {
        await dbClient.db
          .update(schema.ConstituentAnnouncements)
          .set({ emailSent: true })
          .where(
            and(
              eq(
                schema.ConstituentAnnouncements.announcementId,
                announcementId,
              ),
              inArray(
                schema.ConstituentAnnouncements.constituentId,
                Array.from(seenConstituents),
              ),
            ),
          );
      }
    } catch (error) {
      logger.error(
        error,
        `Failed to send announcement emails for ${announcementId}`,
      );
    }
  })();
}
