import * as constituentsService from "@/shared/services/constituentsService";
import { ApiResponse } from "@/shared/types";
import {
  GetConstituentsQuerySchema,
  OnboardConstituentSchema,
  UpdateConstituentSchema,
} from "./schemas";
import { Paginated } from "@/shared/dtos";
import { YPFConstituent, YPFConstituentDetail } from "./dtos";
import z from "zod";

export async function getConstituents(
  query: z.infer<typeof GetConstituentsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFConstituent>>> {
  const data = await constituentsService.getConstituents(query);
  return { success: true, data };
}

export async function getConstituent(
  constituentId: string,
): Promise<ApiResponse<YPFConstituentDetail | null>> {
  const data = await constituentsService.getDetailedConstituent(constituentId);
  return { success: true, data };
}

export async function onboardConstituent(
  body: z.infer<typeof OnboardConstituentSchema>,
  dashboardUrl: string,
): Promise<ApiResponse<string>> {
  const { id } = await constituentsService.onboardConstituent(
    body.id,
    dashboardUrl,
  );
  return { success: true, data: id };
}

export async function updateConstituent(
  constituentId: string,
  body: z.infer<typeof UpdateConstituentSchema>,
): Promise<ApiResponse<null>> {
  await constituentsService.updateConstituent(constituentId, body);
  return { success: true, data: null };
}
