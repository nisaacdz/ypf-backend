import * as committeesService from "@/shared/services/committeesService";
import { ApiResponse } from "@/shared/types";
import {
  GetCommitteesQuerySchema,
  GetConstituentCommitteesQuerySchema,
  GetCommitteeLeadershipQuerySchema,
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
