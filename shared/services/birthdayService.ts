import { sql, and, eq, isNotNull, gte, lte } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";
import * as mediaUtils from "@/shared/utils/files";
import { ApiError } from "@/shared/types";

/**
 * Birthday system.
 *
 * Two events per constituent per year:
 *   1. Three days before the birthday — heads-up email to the Graphics chair
 *      + members, pointing at a per-person page so the team can prep a card.
 *   2. On the birthday itself — supplemental email + SMS to the birthday
 *      person via the existing `notifyBirthday()` helper.
 *
 * Both are driven by the same daily `birthday-tick` cron job at 06:00
 * Africa/Accra. The job is idempotent: re-running on the same day fires
 * the same email batch — recipients dedupe inside `sendBulkEmail` because
 * we set a `singletonKey` per (date, mode, constituent).
 */

export type UpcomingBirthday = {
  constituentId: string;
  fullName: string;
  preferredName?: string;
  dateOfBirth: Date;
  age: number;
  daysUntil: number;
  photoUrl?: string;
  chapterName?: string;
  committeeName?: string;
  title?: string;
};

/**
 * Return active constituents whose birthday falls within `daysAhead` days
 * from today (inclusive). Compares month + day only, so birthdays land in
 * the same window every calendar year regardless of birth year.
 */
export async function fetchUpcomingBirthdays(
  daysAhead: number = 30,
): Promise<UpcomingBirthday[]> {
  // Reaching for raw SQL because date math on (year-agnostic) day-of-year
  // comparisons is awkward in pure Drizzle. The clause computes the next
  // occurrence of (month, day) relative to today, then filters within the
  // window. Wraps the year boundary safely.
  const rows = await dbClient.db.execute(sql`
    WITH base AS (
      SELECT
        c.id              AS constituent_id,
        c.first_name,
        c.last_name,
        c.preferred_name,
        c.date_of_birth,
        m.external_id     AS photo_external_id,
        date_part('year', age(c.date_of_birth)) AS current_age
      FROM core.constituents c
      LEFT JOIN core.media m ON m.id = c.profile_photo_id
      WHERE c.date_of_birth IS NOT NULL
    ),
    annual AS (
      SELECT
        b.*,
        (
          (date_trunc('year', current_date)
            + ((extract(month from b.date_of_birth) - 1)::int) * interval '1 month'
            + ((extract(day   from b.date_of_birth) - 1)::int) * interval '1 day')::date
        ) AS this_years_date
      FROM base b
    )
    SELECT
      a.constituent_id,
      a.first_name,
      a.last_name,
      a.preferred_name,
      a.date_of_birth,
      a.photo_external_id,
      CASE
        WHEN a.this_years_date >= current_date THEN a.this_years_date
        ELSE (a.this_years_date + interval '1 year')::date
      END AS next_birthday,
      CASE
        WHEN a.this_years_date >= current_date THEN (a.this_years_date - current_date)::int
        ELSE ((a.this_years_date + interval '1 year')::date - current_date)::int
      END AS days_until,
      a.current_age + CASE
        WHEN a.this_years_date >= current_date THEN 0
        ELSE 1
      END AS turning_age
    FROM annual a
    WHERE
      (a.this_years_date >= current_date AND a.this_years_date <= current_date + (${daysAhead} || ' days')::interval)
      OR
      ((a.this_years_date + interval '1 year')::date BETWEEN current_date AND current_date + (${daysAhead} || ' days')::interval)
    ORDER BY days_until ASC, a.first_name ASC
  `);

  // drizzle's .execute() returns the raw client result. postgres-js returns
  // an array-like.
  const list = (rows as unknown as Array<Record<string, unknown>>) ?? [];
  return list.map((r) => ({
    constituentId: r.constituent_id as string,
    fullName: `${r.first_name} ${r.last_name}`.trim(),
    preferredName: (r.preferred_name as string | null) ?? undefined,
    dateOfBirth: new Date(r.date_of_birth as string),
    age: Number(r.turning_age),
    daysUntil: Number(r.days_until),
    photoUrl: r.photo_external_id
      ? mediaUtils.generatePublicMediaUrl(r.photo_external_id as string, {
          resolution: 360,
        })
      : undefined,
  }));
}

/**
 * Full detail for a single constituent's birthday card prep page.
 * Includes chapter + committee + title for extra context.
 */
export async function fetchBirthdayDetail(
  constituentId: string,
): Promise<UpcomingBirthday | null> {
  const [row] = await dbClient.db
    .select({
      constituentId: schema.Constituents.id,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      dateOfBirth: schema.Constituents.dateOfBirth,
      photoExternalId: schema.Media.externalId,
    })
    .from(schema.Constituents)
    .leftJoin(
      schema.Media,
      eq(schema.Media.id, schema.Constituents.profilePhotoId),
    )
    .where(eq(schema.Constituents.id, constituentId))
    .limit(1);

  if (!row || !row.dateOfBirth) return null;

  // Compute age + days-until from the row's DOB.
  const dob = new Date(row.dateOfBirth);
  const now = new Date();
  const thisYearBirthday = new Date(
    now.getFullYear(),
    dob.getMonth(),
    dob.getDate(),
  );
  const nextBirthday =
    thisYearBirthday >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
      ? thisYearBirthday
      : new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
  const daysUntil = Math.round(
    (nextBirthday.getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  const turningAge =
    nextBirthday.getFullYear() - new Date(row.dateOfBirth).getFullYear();

  // Pull current chapter / committee / title (best-effort — soft-fail on
  // absence so the page still renders for constituents not in either).
  const [extra] = await dbClient.db.execute(sql`
    SELECT
      (SELECT ch.name FROM core.chapters ch
        JOIN core.chapter_memberships cm ON cm.chapter_id = ch.id
        JOIN core.members me ON me.id = cm.member_id
        WHERE me.constituent_id = ${constituentId}
          AND (cm.ended_at IS NULL OR cm.ended_at > now())
        ORDER BY cm.started_at DESC LIMIT 1) AS chapter_name,
      (SELECT co.name FROM core.committees co
        JOIN core.committee_memberships cmm ON cmm.committee_id = co.id
        JOIN core.members me ON me.id = cmm.member_id
        WHERE me.constituent_id = ${constituentId}
          AND (cmm.ended_at IS NULL OR cmm.ended_at > now())
        ORDER BY cmm.started_at DESC LIMIT 1) AS committee_name,
      (SELECT mt.title FROM core.member_titles mt
        JOIN core.member_titles_assignments mta ON mta.title_id = mt.id
        JOIN core.members me ON me.id = mta.member_id
        WHERE me.constituent_id = ${constituentId}
          AND (mta.ended_at IS NULL OR mta.ended_at > now())
        ORDER BY mt._level ASC LIMIT 1) AS title
  `);

  const extras = (extra as Record<string, string | null> | undefined) ?? {};

  return {
    constituentId: row.constituentId,
    fullName: `${row.firstName} ${row.lastName}`.trim(),
    preferredName: row.preferredName ?? undefined,
    dateOfBirth: dob,
    age: turningAge,
    daysUntil,
    photoUrl: row.photoExternalId
      ? mediaUtils.generatePublicMediaUrl(row.photoExternalId, {
          resolution: 720,
        })
      : undefined,
    chapterName: (extras.chapter_name as string | null) ?? undefined,
    committeeName: (extras.committee_name as string | null) ?? undefined,
    title: (extras.title as string | null) ?? undefined,
  };
}

/**
 * Resolve the email recipients for the heads-up: current Graphics chair +
 * all current Graphics members. Returns a deduped list of email addresses.
 */
export async function fetchGraphicsTeamEmails(): Promise<string[]> {
  const rows = await dbClient.db.execute(sql`
    SELECT DISTINCT c.email
    FROM core.constituents c
    JOIN core.members m ON m.constituent_id = c.id
    JOIN core.committee_memberships cm ON cm.member_id = m.id
    JOIN core.committees co ON co.id = cm.committee_id
    WHERE co.alias = 'graphics'
      AND (cm.ended_at IS NULL OR cm.ended_at > now())
      AND c.email IS NOT NULL
  `);
  const list = (rows as unknown as Array<{ email: string }>) ?? [];
  return Array.from(new Set(list.map((r) => r.email).filter(Boolean)));
}
