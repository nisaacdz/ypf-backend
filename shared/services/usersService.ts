import {
  and,
  eq,
  or,
  lte,
  gte,
  isNull,
  getTableColumns,
  sql,
} from "drizzle-orm";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";
import { Users } from "@/db/schema/app";
import { AnyPgColumn, unionAll } from "drizzle-orm/pg-core";
import { Profile } from "@/configs/authorizer";

const allColumns = getTableColumns(Users);

const excludedColumns = [
  "password",
  "googleId",
  "appleId",
  "facebookId",
] as const;

const columns = Object.fromEntries(
  Object.keys(allColumns)
    .filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (col) => !excludedColumns.includes(col as any),
    )
    .map((col) => [col, true]),
) as {
  [K in Exclude<
    keyof typeof allColumns,
    (typeof excludedColumns)[number]
  >]: true;
};

export async function getUserById(userId: string) {
  const user = await pgPool.db.query.Users.findFirst({
    columns,
    with: {
      constituent: true,
    },
    where: eq(schema.Users.id, userId),
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
}

/**
 * [REWRITTEN] Fetches the current, active roles and titles for a constituent.
 * This function queries both Admin roles and Member titles and formats them
 * into a single array of strings for use in a JWT.
 * Examples: ["ADMIN.SUPER_ADMIN", "MEMBER.President.*", "MEMBER.Chapter-Lead.<uuid>"]
 *
 * @param constituentId The ID of the constituent.
 * @returns A promise that resolves to an array of formatted role strings.
 */
export async function getConstituentRoles(constituentId: string) {
  const now = new Date();

  // 1. Fetch Admin Roles
  const adminRolesQuery = pgPool.db
    .select({
      role: sql<string>`CONCAT('ADMIN.', ${schema.AdminRolesAssignments.role})`,
    })
    .from(schema.Admins)
    .innerJoin(
      schema.AdminRolesAssignments,
      eq(schema.Admins.id, schema.AdminRolesAssignments.adminId),
    )
    .where(
      and(
        eq(schema.Admins.constituentId, constituentId),
        lte(schema.Admins.startedAt, now),
        or(isNull(schema.Admins.endedAt), gte(schema.Admins.endedAt, now)),
        lte(schema.AdminRolesAssignments.startedAt, now),
        or(
          isNull(schema.AdminRolesAssignments.endedAt),
          gte(schema.AdminRolesAssignments.endedAt, now),
        ),
      ),
    );

  const memberTitlesQuery = pgPool.db
    .select({
      role: sql<string>`
        CONCAT('MEMBER.', ${schema.MemberTitles.title},
          CASE
            WHEN ${schema.MemberTitles.chapterId} IS NOT NULL THEN CONCAT('.', ${schema.MemberTitles.chapterId})
            WHEN ${schema.MemberTitles.committeeId} IS NOT NULL THEN CONCAT('.', ${schema.MemberTitles.committeeId})
            ELSE ''
          END
        )
      `,
    })
    .from(schema.Members)
    .innerJoin(
      schema.MemberTitlesAssignments,
      eq(schema.Members.id, schema.MemberTitlesAssignments.memberId),
    )
    .innerJoin(
      schema.MemberTitles,
      eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
    )
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.Members.startedAt, now),
        or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
        lte(schema.MemberTitlesAssignments.startedAt, now),
        or(
          isNull(schema.MemberTitlesAssignments.endedAt),
          gte(schema.MemberTitlesAssignments.endedAt, now),
        ),
      ),
    );

  const [adminRoles, memberTitles] = await Promise.all([
    adminRolesQuery,
    memberTitlesQuery,
  ]);

  const allRoles = [
    ...adminRoles.map((r) => r.role),
    ...memberTitles.map((r) => r.role),
  ];

  return allRoles;
}

interface ITimeBoundProfileTable {
  constituentId: AnyPgColumn;
  startedAt: AnyPgColumn;
  endedAt: AnyPgColumn;
}

export async function getConstituentProfiles(
  constituentId: string,
): Promise<Profile[]> {
  const db = pgPool.db;
  const activeCheck = (table: ITimeBoundProfileTable) =>
    and(
      eq(table.constituentId, constituentId),
      lte(table.startedAt, sql`now()`),
      or(isNull(table.endedAt), gte(table.endedAt, sql`now()`)),
    );

  const memberQuery = db
    .select({ profile: sql<Profile>`'MEMBER'` })
    .from(schema.Members)
    .where(activeCheck(schema.Members))
    .limit(1);

  const adminQuery = db
    .select({ profile: sql<Profile>`'ADMIN'` })
    .from(schema.Admins)
    .where(activeCheck(schema.Admins))
    .limit(1);

  const volunteerQuery = db
    .select({ profile: sql<Profile>`'VOLUNTEER'` })
    .from(schema.Volunteers)
    .where(activeCheck(schema.Volunteers))
    .limit(1);

  const auditorQuery = db
    .select({ profile: sql<Profile>`'AUDITOR'` })
    .from(schema.Auditors)
    .where(activeCheck(schema.Auditors))
    .limit(1);

  const donorQuery = db
    .select({ profile: sql<Profile>`'DONOR'` })
    .from(schema.Donors)
    .where(eq(schema.Donors.constituentId, constituentId))
    .limit(1);

  const result = await unionAll(
    memberQuery,
    adminQuery,
    volunteerQuery,
    auditorQuery,
    donorQuery,
  );

  return result.map((row) => row.profile);
}

/**
 * Finds a user by their email address and joins their constituent data.
 *
 * @param email The email to search for.
 * @returns A promise that resolves to the user object (with constituent data) or undefined if not found.
 */
export async function findUserByEmail(email: string) {
  const [user] = await pgPool.db
    .select({
      id: schema.Users.id,
      email: schema.Users.email,
      username: schema.Users.username,
      googleId: schema.Users.googleId,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
    })
    .from(schema.Users)
    .leftJoin(
      schema.Constituents,
      eq(schema.Users.constituentId, schema.Constituents.id),
    )
    .where(eq(schema.Users.email, email));

  return user;
}
