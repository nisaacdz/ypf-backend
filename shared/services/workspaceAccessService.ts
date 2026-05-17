import { Request } from "express";
import { eq } from "drizzle-orm";

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import type { AuthenticatedUser } from "@/shared/types";

export const PROGRAMS_RECORDS_ALIAS = "programs_records";

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

export function canManageCommittee(
  user: AuthenticatedUser | undefined,
  committeeId: string,
): boolean {
  return Boolean(
    isSystemAdmin(user) ||
      hasCommitteeTitle(user, committeeId, "committeechair"),
  );
}

export async function canAccessWorkspaceRequest(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(req.Params?.alias);
  if (!committee) return false;
  return canAccessCommittee(req.User, committee.id);
}

export async function canManageWorkspaceRequest(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(req.Params?.alias);
  if (!committee) return false;
  return canManageCommittee(req.User, committee.id);
}

export async function canManageProgramsRecords(req: Request) {
  if (!req.User) return false;
  const committee = await getCommitteeByAlias(PROGRAMS_RECORDS_ALIAS);
  if (!committee) return isSystemAdmin(req.User);
  return canManageCommittee(req.User, committee.id);
}
