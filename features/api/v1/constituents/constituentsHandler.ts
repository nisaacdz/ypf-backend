import * as constituentsService from "@/shared/services/constituentsService";
import { ApiResponse } from "@/shared/types";
import { GetConstituentsQuerySchema } from "./schemas";
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
