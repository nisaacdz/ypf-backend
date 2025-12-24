import { ApiError, ApiResponse } from "@/shared/types";
import {
  GetWelfareCasesQuerySchema,
  CreateWelfareCaseSchema,
  UpdateWelfareCaseSchema,
} from "./schemas";
import z from "zod";
import { Paginated } from "@/shared/dtos";
import { YPFWelfareCase, YPFWelfareCaseDetail } from "./dtos";
import * as welfareService from "@/shared/services/welfareService";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getWelfareCases(
  query: z.infer<typeof GetWelfareCasesQuerySchema>,
): Promise<ApiResponse<Paginated<YPFWelfareCase>>> {
  const data = await welfareService.fetchWelfareCases(query);

  return {
    success: true,
    message: "Welfare cases fetched successfully",
    data,
  };
}

export async function getWelfareCase(
  welfareCaseId: string,
): Promise<ApiResponse<YPFWelfareCaseDetail>> {
  const data = await welfareService.fetchWelfareCaseById(welfareCaseId);

  return {
    success: true,
    message: "Welfare case fetched successfully",
    data,
  };
}

export async function createWelfareCase(
  newCase: z.infer<typeof CreateWelfareCaseSchema>,
): Promise<ApiResponse<string>> {
  const welfareCaseId = await welfareService.createWelfareCase(newCase);

  return {
    success: true,
    message: "Welfare case created successfully",
    data: welfareCaseId,
  };
}

export async function updateWelfareCase(
  welfareCaseId: string,
  updates: z.infer<typeof UpdateWelfareCaseSchema>,
): Promise<ApiResponse<null>> {
  await welfareService.updateWelfareCase(welfareCaseId, updates);

  return {
    success: true,
    message: "Welfare case updated successfully",
    data: null,
  };
}

export async function deleteWelfareCase(
  welfareCaseId: string,
): Promise<ApiResponse<null>> {
  await welfareService.deleteWelfareCase(welfareCaseId);

  return {
    success: true,
    message: "Welfare case deleted successfully",
    data: null,
  };
}

export async function addWelfareCaseBeneficiaries(
  welfareCaseId: string,
  beneficiaryIds: string[],
): Promise<ApiResponse<null>> {
  const welfareCase = await dbClient.db.query.WelfareCases.findFirst({
    where: eq(schema.WelfareCases.id, welfareCaseId),
    columns: { id: true },
  });

  if (!welfareCase) {
    throw new ApiError("Welfare case not found", 404);
  }

  await welfareService.addWelfareCaseBeneficiaries(
    welfareCaseId,
    beneficiaryIds,
  );

  return {
    success: true,
    message: "YPFWelfareCase beneficiaries added successfully",
    data: null,
  };
}

export async function removeWelfareCaseBeneficiary(
  welfareCaseId: string,
  beneficiaryId: string,
): Promise<ApiResponse<null>> {
  const welfareCase = await dbClient.db.query.WelfareCases.findFirst({
    where: eq(schema.WelfareCases.id, welfareCaseId),
    columns: { id: true },
  });

  if (!welfareCase) {
    throw new ApiError("Welfare case not found", 404);
  }

  await welfareService.removeWelfareCaseBeneficiary(
    welfareCaseId,
    beneficiaryId,
  );

  return {
    success: true,
    message: "Welfare case deleted successfully",
    data: null,
  };
}

export async function getWelfareCaseEvents(
  welfareCaseId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<
  ApiResponse<Paginated<import("@/features/api/v1/events/dtos").YPFEvent>>
> {
  const data = await welfareService.fetchWelfareCaseEvents(
    welfareCaseId,
    query,
  );

  return {
    success: true,
    message: "Welfare case events fetched successfully",
    data,
  };
}
