import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetConstituentsQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const OnboardConstituentSchema = z.object({
  id: z.uuid({ message: "Invalid constituent ID format." }),
});

export const InviteConstituentSchema = z.object({
  firstName: z.string().min(1, "First name is required.").max(100),
  lastName: z.string().min(1, "Last name is required.").max(100),
  preferredName: z.string().max(150).nullable().optional(),
  email: z.email("Please enter a valid email address."),
  phone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  campus: z.string().max(150).nullable().optional(),
  occupation: z.string().max(150).nullable().optional(),
  chapterId: z.uuid("Invalid chapter ID.").nullable().optional(),
});

/**
 * Editable subset of `Constituents`. Chapter / role / dues assignment lives
 * elsewhere (chapter detail, member titles, dues drawer) so this schema
 * intentionally stays narrow — only direct constituent columns.
 *
 * All fields are optional so the People drawer can save partial diffs
 * without re-sending unchanged fields.
 */
export const UpdateConstituentSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    preferredName: z.string().max(150).nullable().optional(),
    email: z.email().nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    whatsapp: z.string().max(40).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    region: z.string().max(100).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    campus: z.string().max(150).nullable().optional(),
    occupation: z.string().max(150).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });
