import * as committeesService from "@/shared/services/committeesService";
import { ApiResponse } from "@/shared/types";
import { GetCommitteesQuerySchema } from "@/shared/validators/core";
import { Paginated, YPFCommittee, DetailedCommittee } from "@/shared/dtos";
import z from "zod";

export async function getCommittees(
  query: z.infer<typeof GetCommitteesQuerySchema>,
): Promise<ApiResponse<Paginated<YPFCommittee>>> {
  const data = await committeesService.getCommittees(query);
  return { success: true, data };
}

export async function getCommittee(
  committeeId: string,
): Promise<ApiResponse<DetailedCommittee>> {
  const data = await committeesService.getCommitteeById(committeeId);
  return { success: true, data };
}
