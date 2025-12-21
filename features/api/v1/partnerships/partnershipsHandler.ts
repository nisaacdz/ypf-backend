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
import * as fileUtils from "@/shared/utils/files";
import * as documentsService from "@/shared/services/documentsService";

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
 * Create a new partnership with optional contract document
 */
export async function createPartnership({
  data,
  contractDocument,
}: {
  data: z.infer<typeof CreatePartnershipSchema>;
  contractDocument?: Express.Multer.File;
}): Promise<ApiResponse<YPFPartnershipMutation>> {
  let contractDocumentId: string | undefined;

  // Upload contract document if provided
  if (contractDocument) {
    const documentMeta = await fileUtils.storeDocumentFile(contractDocument);
    const uploadedDoc = await documentsService.uploadDocument(documentMeta);
    contractDocumentId = uploadedDoc.id;
  }

  const result = await partnershipsService.createPartnership({
    ...data,
    contractDocumentId,
  });

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
