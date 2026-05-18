import { Request } from "express";
import { and, eq, isNull } from "drizzle-orm";

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import type { AuthenticatedUser } from "@/shared/types";

export const PROGRAMS_RECORDS_ALIAS = "programs_records";
export const FINANCE_ALIAS = "finance";
export const HR_ALIAS = "hr";
export const WELFARE_ALIAS = "welfare";
export const MEDIA_ALIAS = "media";
export const GRAPHICS_ALIAS = "graphics";
export const SPONSORSHIP_ALIAS = "sponsorship";
export const LEGAL_ALIAS = "legal";
export const RECORDS_MGMT_ALIAS = "records_mgmt";

export type WorkspaceCommittee = {
  id: string;
  name: string;
  alias: string;
};

export async function getCommitteeByAlias(
  alias: string,
): Promise<WorkspaceCommittee | null> {
  const committee = await dbClient.db.query.Committees.findFirst({
    where: eq(schema.Committees.alias, alias),
  });
  if (!committee) return null;
  return {
    id: committee.id,
    name: committee.name,
    alias: committee.alias,
  };
}

export function isSystemAdmin(user: AuthenticatedUser | undefined): boolean {
  return Boolean(
    user?.profiles.includes("ADMIN") ||
      user?.roles.includes("ADMIN.SUPER_ADMIN") ||
      user?.roles.includes("ADMIN.REGULAR_ADMIN"),
  );
}

export function hasCommitteeTitle(
  user: AuthenticatedUser | undefined,
  committeeId: string,
  titleAlias: "committeechair" | "committeemember",
): boolean {
  return Boolean(user?.roles.includes(`MEMBER.${titleAlias}.${committeeId}`));
}

export function canAccessCommittee(
  user: AuthenticatedUser | undefined,
  committeeId: string,
): boolean {
  return Boolean(
    isSystemAdmin(user) ||
      hasCommitteeTitle(user, committeeId, "committeechair") ||
      hasCommitteeTitle(user, committeeId, "committeemember"),
  );
}

export async function canAccessCommitteeLive(
  user: AuthenticatedUser | undefined,
  committeeId: string,
): Promise<boolean> {
  if (!user) return false;
  if (canAccessCommittee(user, committeeId)) return true;
  if (await isSystemAdminLive(user)) return true;
  return (
    (await hasLiveCommitteeTitle(user, committeeId, "committeechair")) ||
    (await hasLiveCommitteeTitle(user, committeeId, "committeemember"))
  );
}

export function canManageCommittee(
  user: AuthenticatedUser | undefined,
  committeeId: string,
): boolean {
  return Boolean(
    isSystemAdmin(user) ||
      hasCommitteeTitle(user, committeeId, "committeechair"),
  );
}

export async function canManageCommitteeLive(
  user: AuthenticatedUser | undefined,
  committeeId: string,
): Promise<boolean> {
  if (!user) return false;
  if (canManageCommittee(user, committeeId)) return true;
  if (await isSystemAdminLive(user)) return true;
  return hasLiveCommitteeTitle(user, committeeId, "committeechair");
}

export async function canAccessWorkspaceRequest(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(req.Params?.alias);
  if (!committee) return false;
  return canAccessCommitteeLive(req.User, committee.id);
}

export async function canManageWorkspaceRequest(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(req.Params?.alias);
  if (!committee) return false;
  return canManageCommitteeLive(req.User, committee.id);
}

export async function canManageProgramsRecords(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(PROGRAMS_RECORDS_ALIAS);
  if (!committee) return isSystemAdmin(req.User);
  return canManageCommitteeLive(req.User, committee.id);
}

export async function canManageFinance(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(FINANCE_ALIAS);
  if (!committee) return isSystemAdmin(req.User);
  return canManageCommitteeLive(req.User, committee.id);
}

export async function canAccessFinance(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(FINANCE_ALIAS);
  if (!committee) return isSystemAdmin(req.User);
  return canAccessCommitteeLive(req.User, committee.id);
}

export async function canManageHr(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(HR_ALIAS);
  if (!committee) return isSystemAdmin(req.User);
  return canManageCommitteeLive(req.User, committee.id);
}

export async function canAccessHr(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(HR_ALIAS);
  if (!committee) return isSystemAdmin(req.User);
  return canAccessCommitteeLive(req.User, committee.id);
}

export async function isSystemAdminLive(user: AuthenticatedUser) {
  const admin = await dbClient.db.query.Admins.findFirst({
    where: and(
      eq(schema.Admins.constituentId, user.constituentId),
      isNull(schema.Admins.endedAt),
    ),
  });
  if (!admin) return false;

  const assignment = await dbClient.db.query.AdminRolesAssignments.findFirst({
    where: and(
      eq(schema.AdminRolesAssignments.adminId, admin.id),
      isNull(schema.AdminRolesAssignments.endedAt),
    ),
  });
  return Boolean(assignment);
}

async function hasLiveCommitteeTitle(
  user: AuthenticatedUser,
  committeeId: string,
  titleAlias: "committeechair" | "committeemember",
) {
  const rows = await dbClient.db
    .select({ id: schema.MemberTitlesAssignments.id })
    .from(schema.Members)
    .innerJoin(
      schema.CommitteeMemberships,
      eq(schema.CommitteeMemberships.memberId, schema.Members.id),
    )
    .innerJoin(
      schema.MemberTitlesAssignments,
      eq(schema.MemberTitlesAssignments.memberId, schema.Members.id),
    )
    .innerJoin(
      schema.MemberTitles,
      eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
    )
    .where(
      and(
        eq(schema.Members.constituentId, user.constituentId),
        isNull(schema.Members.endedAt),
        eq(schema.CommitteeMemberships.committeeId, committeeId),
        isNull(schema.CommitteeMemberships.endedAt),
        eq(schema.MemberTitles.committeeId, committeeId),
        eq(schema.MemberTitles.alias, titleAlias),
        isNull(schema.MemberTitlesAssignments.endedAt),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
