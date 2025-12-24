import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { TargetingFilter } from "@/shared/types/targeting";
import { resolveAudience } from "./targetResolver";
import { sendAnnouncementEmail } from "@/shared/utils/email";
import { eq, inArray, and } from "drizzle-orm";
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

export async function publishAnnouncement(announcementId: string) {
  // TODO: Implement this
  // const [announcement] = await dbClient.db
  //   .select()
  //   .from(schema.Announcements)
  //   .where(eq(schema.Announcements.id, announcementId));
  // if (!announcement) {
  //   throw new Error("Announcement not found");
  // }
  // // 1. Resolve Audience
  // const constituentsSet = await resolveAudience(announcement.targetCriteria);
  // const constituents = Array.from(constituentsSet);
  // if (constituents.length === 0) {
  //   logger.info(`No constituents found for announcement ${announcementId}`);
  //   return;
  // }
  // // 2. Create ConstituentAnnouncements (Inbox entries)
  // // We need to handle potential duplicates if we run this multiple times,
  // // but the unique constraint (announcementId, constituentId) handles it at DB level.
  // // However, Drizzle's `onConflictDoNothing` is useful here.
  // const inboxEntries = constituents.map((cid) => ({
  //   announcementId: announcement.id,
  //   constituentId: cid.id,
  //   isRead: false,
  //   emailSent: false,
  // }));
  // const chunkSize = 1000;
  // for (let i = 0; i < inboxEntries.length; i += chunkSize) {
  //   const chunk = inboxEntries.slice(i, i + chunkSize);
  //   await dbClient.db
  //     .insert(schema.ConstituentAnnouncements)
  //     .values(chunk)
  //     .onConflictDoNothing()
  //     .execute();
  // }
  // const finalEmails: string[] = [];
  // const seenConstituents = new Set<string>();
  // for (const contact of contacts) {
  //   if (!seenConstituents.has(contact.constituentId)) {
  //     finalEmails.push(contact.email);
  //     seenConstituents.add(contact.constituentId);
  //   }
  // }
  // // 4. Fire and Forget Email Sending
  // // We wrap in try-catch to not block the response, but since this function is likely called
  // // by a background job or an admin endpoint, we might want to await it or at least log.
  // // The user said "fire (without awaiting)".
  // (async () => {
  //   try {
  //     await sendAnnouncementEmail(
  //       finalEmails,
  //       announcement.title,
  //       announcement.content,
  //     );
  //     // Update status to PUBLISHED if not already
  //     await dbClient.db
  //       .update(schema.Announcements)
  //       .set({ status: "PUBLISHED", publishedAt: new Date() })
  //       .where(eq(schema.Announcements.id, announcementId));
  //     // Update emailSent flag for the constituents who were on the list
  //     // We can do this by matching announcementId and constituentId
  //     if (seenConstituents.size > 0) {
  //       await dbClient.db
  //         .update(schema.ConstituentAnnouncements)
  //         .set({ emailSent: true })
  //         .where(
  //           and(
  //             eq(
  //               schema.ConstituentAnnouncements.announcementId,
  //               announcementId,
  //             ),
  //             inArray(
  //               schema.ConstituentAnnouncements.constituentId,
  //               Array.from(seenConstituents),
  //             ),
  //           ),
  //         );
  //     }
  //   } catch (error) {
  //     logger.error(
  //       error,
  //       `Failed to send announcement emails for ${announcementId}`,
  //     );
  //   }
  // })();
}
