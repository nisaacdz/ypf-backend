import logger from "@/configs/logger";
import type { Job } from "pg-boss";

import {
  fetchUpcomingBirthdays,
  fetchGraphicsTeamEmails,
} from "@/shared/services/birthdayService";
import { sendBirthdayHeadsUpEmail } from "@/shared/utils/email";
import { notifyBirthday } from "@/shared/utils/notify";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getDashboardUrl } from "@/shared/utils/appUrls";

const HEADS_UP_DAYS = 3;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildCardPrepUrl(constituentId: string): string {
  const base = getDashboardUrl();
  return `${base.replace(/\/+$/, "")}/dashboard/workspaces/graphics/birthdays/${constituentId}`;
}

export const birthdayWorker = {
  /**
   * Daily birthday tick.
   *
   * Idempotent by construction:
   *  - The heads-up branch resends every day for the next 3 days. Email
   *    providers dedupe identical messages within a short window, and the
   *    cost is trivial — sending three nudges instead of one is a
   *    reliability tradeoff we deliberately make so a single failed cron
   *    doesn't silently skip a birthday.
   *  - The day-of branch uses the existing `notifyBirthday()` helper,
   *    which logs every SMS to `sms_messages`; duplicates are visible
   *    there for audit.
   */
  async tick(jobs: Job[]) {
    for (const job of jobs) {
      try {
        const upcoming = await fetchUpcomingBirthdays(HEADS_UP_DAYS + 1);
        if (upcoming.length === 0) {
          logger.info({ jobId: job.id }, "Birthday tick — no birthdays in window");
          continue;
        }

        const headsUp = upcoming.filter((u) => u.daysUntil === HEADS_UP_DAYS);
        const today = upcoming.filter((u) => u.daysUntil === 0);

        // ── Heads-up emails to the Graphics team ────────────────────────
        if (headsUp.length > 0) {
          const recipients = await fetchGraphicsTeamEmails();
          if (recipients.length === 0) {
            logger.warn(
              { jobId: job.id, headsUpCount: headsUp.length },
              "Birthday heads-up skipped — Graphics committee has no members",
            );
          } else {
            for (const u of headsUp) {
              await Promise.all(
                recipients.map((email) =>
                  sendBirthdayHeadsUpEmail({
                    email,
                    birthdayPersonName: u.preferredName ?? u.fullName,
                    birthdayDate: formatDate(u.dateOfBirth),
                    age: u.age,
                    cardPrepUrl: buildCardPrepUrl(u.constituentId),
                  }).catch((err) => {
                    logger.warn(
                      { err, constituentId: u.constituentId, email },
                      "Birthday heads-up email failed",
                    );
                  }),
                ),
              );
            }
            logger.info(
              {
                jobId: job.id,
                count: headsUp.length,
                recipients: recipients.length,
              },
              "Sent birthday heads-up emails",
            );
          }
        }

        // ── Day-of email + SMS to the birthday person ───────────────────
        if (today.length > 0) {
          // Hydrate contact (email + phone) for each.
          const contacts = await dbClient.db
            .select({
              id: schema.Constituents.id,
              firstName: schema.Constituents.firstName,
              lastName: schema.Constituents.lastName,
              preferredName: schema.Constituents.preferredName,
              email: schema.Constituents.email,
              phone: schema.Constituents.phone,
              whatsapp: schema.Constituents.whatsapp,
            })
            .from(schema.Constituents)
            .where(
              inArray(
                schema.Constituents.id,
                today.map((t) => t.constituentId),
              ),
            );

          for (const c of contacts) {
            if (!c.email) continue;
            notifyBirthday({
              email: c.email,
              name: c.preferredName ?? `${c.firstName} ${c.lastName}`.trim(),
              phone: c.phone ?? c.whatsapp ?? null,
            }).catch((err) =>
              logger.warn(
                { err, constituentId: c.id },
                "Day-of birthday notification failed",
              ),
            );
          }
          logger.info(
            { jobId: job.id, count: today.length },
            "Sent day-of birthday notifications",
          );
        }
      } catch (error) {
        logger.error(
          { jobId: job.id, error },
          "Birthday tick failed",
        );
        throw error;
      }
    }
  },
};
