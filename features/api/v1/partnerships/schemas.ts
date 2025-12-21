import { z } from "zod";
import { PaginationQuery } from "@/shared/validators";
import { PartnershipTypeEnum } from "@/db/schema/finance";
import { AllowedDocumentsMimeTypes } from "@/shared/middlewares/multipart";

/**
 * Query schema for listing partnerships
 */
export const GetPartnershipsQuerySchema = z.object({
  ...PaginationQuery.shape,
  partnershipType: z.enum(PartnershipTypeEnum.enumValues).optional(),
  projectId: z.uuid().optional(),
  eventId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

/**
 * Schema for validating contract document file upload
 */
export const UploadContractDocumentSchema = z.object({
  size: z
    .number()
    .max(10 * 1024 * 1024, "File size must be less than 10MB")
    .positive({ message: "File size must be a positive number." }),
  mimeType: z.enum(
    Object.keys(AllowedDocumentsMimeTypes) as [string, ...string[]],
    {
      message: "Invalid file type. Only PDF, DOC, and images are allowed.",
    },
  ),
});

/**
 * Schema for creating a new partnership
 */
export const CreatePartnershipSchema = z.object({
  organizationId: z.uuid("Invalid organization ID"),
  partnershipType: z.enum(PartnershipTypeEnum.enumValues, {
    message: `Invalid partnership type. Must be ${PartnershipTypeEnum.enumValues.join(", ")}`,
  }),
  projectId: z.uuid("Invalid project ID").optional(),
  eventId: z.uuid("Invalid event ID").optional(),
  startedAt: z.coerce.date({ message: "Invalid start date" }),
  endedAt: z.coerce.date({ message: "Invalid end date" }).optional(),
  value: z
    .number()
    .positive("Value must be a positive number")
    .optional()
    .transform((val) => val?.toFixed(2)),
  metadata: z.string().optional(),
});

/**
 * Schema for updating an existing partnership
 */
export const UpdatePartnershipSchema = z
  .object({
    partnershipType: z.enum(PartnershipTypeEnum.enumValues).optional(),
    projectId: z.uuid().nullish(),
    eventId: z.uuid().nullish(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().nullish(),
    value: z
      .number()
      .positive()
      .optional()
      .transform((val) => val?.toFixed(2)),
    metadata: z.string().nullish(),
    contractDocumentId: z.uuid().nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });
