import { ApiResponse } from "@/shared/types";
import {
  GetPartnershipsQuerySchema,
  CreatePartnershipSchema,
  UpdatePartnershipSchema,
} from "./schemas";
import {
  YPFPartnership,
  YPFPartnershipDetail,
  YPFPartnershipMutation,
} from "./dtos";
import { Paginated } from "@/shared/dtos";
import z from "zod";
import * as partnershipsService from "@/shared/services/partnershipsService";

/**
 * Get paginated list of partnerships
 */
export async function getPartnerships(
  query: z.infer<typeof GetPartnershipsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFPartnership>>> {
  const result = await partnershipsService.getPartnerships(query);
  return { success: true, data: result };
}

/**
 * Get a single partnership by ID
 */
export async function getPartnership(
  id: string,
): Promise<ApiResponse<YPFPartnershipDetail>> {
  const result = await partnershipsService.getPartnershipById(id);
  return { success: true, data: result };
}

/**
 * Create a new partnership
 */
export async function createPartnership(
  data: z.infer<typeof CreatePartnershipSchema>,
): Promise<ApiResponse<YPFPartnershipMutation>> {
  const result = await partnershipsService.createPartnership(data);
  return {
    success: true,
    data: {
      id: result.id,
      message: "Partnership created successfully",
    },
  };
}

/**
 * Update an existing partnership
 */
export async function updatePartnership(
  id: string,
  data: z.infer<typeof UpdatePartnershipSchema>,
): Promise<ApiResponse<YPFPartnershipMutation>> {
  const result = await partnershipsService.updatePartnership(id, data);
  return {
    success: true,
    data: {
      id: result.id,
      message: "Partnership updated successfully",
    },
  };
}

/**
 * Delete a partnership
 */
export async function deletePartnership(
  id: string,
): Promise<ApiResponse<{ message: string }>> {
  await partnershipsService.deletePartnership(id);
  return {
    success: true,
    data: {
      message: "Partnership deleted successfully",
    },
  };
}
