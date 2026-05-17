import z from "zod";

export const CreateContactSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email("Invalid email address"),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(5000),
});

export const ContactSubmissionStatusEnum = [
  "NEW",
  "READ",
  "REPLIED",
  "SPAM",
] as const;

export const GetContactSubmissionsQuerySchema = z.object({
  status: z.enum(ContactSubmissionStatusEnum).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const UpdateContactSubmissionSchema = z.object({
  status: z.enum(ContactSubmissionStatusEnum),
});
