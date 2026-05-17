import * as committeesService from "@/shared/services/committeesService";
import { ApiResponse } from "@/shared/types";
import {
  GetCommitteesQuerySchema,
  GetConstituentCommitteesQuerySchema,
  GetCommitteeLeadershipQuerySchema,
  EnrollCommitteeSchema,
  UnenrollCommitteeSchema,
} from "./schemas";
import { Paginated } from "@/shared/dtos";
import { YPFCommittee, YPFCommitteeDetail } from "./dtos";
import { YPFMember } from "@/features/api/v1/members/dtos";
import z from "zod";

export async function getCommittees(
  query: z.infer<typeof GetCommitteesQuerySchema>,
): Promise<ApiResponse<Paginated<YPFCommittee>>> {
  const data = await committeesService.getCommittees(query);
  return { success: true, data };
}

export async function getCommittee(
  committeeId: string,
): Promise<ApiResponse<YPFCommitteeDetail>> {
  const data = await committeesService.getCommitteeById(committeeId);
  return { success: true, data };
}

export async function getCommitteesByConstituentId(
  constituentId: string,
  query: z.infer<typeof GetConstituentCommitteesQuerySchema>,
): Promise<ApiResponse<Paginated<YPFCommittee>>> {
  const data = await committeesService.getCommitteesByConstituentId(
    constituentId,
    query,
  );
  return { success: true, data };
}

export async function getLeadership(
  committeeId: string,
  query: z.infer<typeof GetCommitteeLeadershipQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await committeesService.getCommitteeLeadership(
    committeeId,
    query,
  );
  return { success: true, data };
}

export async function enrollToCommittee(
  committeeId: string,
  body: z.infer<typeof EnrollCommitteeSchema>,
): Promise<ApiResponse<{ membershipId: string }>> {
  const membershipId = await committeesService.enrollToCommittee(
    committeeId,
    body.constituentId,
    body.startedAt ? new Date(body.startedAt) : undefined,
    body.titleAlias,
  );
  return { success: true, data: { membershipId } };
}

export async function unenrollFromCommittee(
  committeeId: string,
  body: z.infer<typeof UnenrollCommitteeSchema>,
): Promise<ApiResponse<null>> {
  await committeesService.unenrollFromCommittee(
    committeeId,
    body.constituentId,
  );
  return { success: true, data: null };
}
