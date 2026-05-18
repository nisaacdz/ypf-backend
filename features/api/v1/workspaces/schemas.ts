import z from "zod";
import { AllowedDocumentsMimeTypes } from "@/shared/middlewares/multipart";

export const WorkspaceAliasParamsSchema = z.object({
  alias: z.string().min(1),
});

export const WorkspaceReportQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format")
    .optional(),
});

export const WorkspaceReportsQuerySchema = WorkspaceReportQuerySchema;

export const SubmitWorkspaceDocumentSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format")
    .optional(),
  kind: z.enum(["PLAN", "REPORT"]),
  body: z.string().default(""),
  documentName: z.string().max(160, "Document name is too long").optional(),
  documentUrl: z.url("Enter a valid document URL").optional(),
}).refine(
  (value) => value.body.trim().length >= 10 || Boolean(value.documentUrl),
  {
    message: "Type at least 10 characters or attach a document link",
    path: ["body"],
  },
);

export const WorkspaceNotesQuerySchema = z.object({
  committeeId: z.uuid("Invalid committee ID"),
  entityType: z.enum(["program", "event", "workspace"]).optional(),
  entityId: z.uuid("Invalid entity ID").optional(),
});

export const CreateWorkspaceNoteSchema = z.object({
  committeeId: z.uuid("Invalid committee ID"),
  entityType: z.enum(["program", "event", "workspace"]),
  entityId: z.uuid("Invalid entity ID").optional(),
  body: z.string().min(1, "Note body is required"),
});

export const UpdateWorkspaceNoteSchema = z.object({
  body: z.string().min(1, "Note body is required"),
});

export const WorkspaceAttachmentsQuerySchema = z.object({
  committeeId: z.uuid("Invalid committee ID"),
  noteId: z.uuid("Invalid workspace record ID"),
});

export const CreateWorkspaceAttachmentSchema = z.object({
  committeeId: z.uuid("Invalid committee ID"),
  noteId: z.uuid("Invalid workspace record ID"),
  label: z.string().max(120, "Attachment label is too long").optional(),
});

export const UploadWorkspaceAttachmentFileSchema = z.object({
  size: z
    .number()
    .max(10 * 1024 * 1024, "Workspace attachments cannot exceed 10MB")
    .positive({ message: "File size must be a positive number." }),
  mimeType: z.enum(Object.keys(AllowedDocumentsMimeTypes), {
    error: () => ({
      message:
        "Invalid file type. Upload PDF, Word, Excel, PowerPoint, PNG, or JPG files.",
    }),
  }),
});

const BudgetLineSchema = z.object({
  description: z.string().min(2, "Line description is required").max(160),
  category: z.string().max(80).optional(),
  amount: z.number().positive("Line amount must be positive"),
  notes: z.string().max(400).optional(),
});

export const FinanceLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format")
    .optional(),
});

export const CreateFinanceExpenditureSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("GHS"),
  description: z.string().min(3, "Description is required").max(240),
  category: z.string().max(80).optional(),
  timestamp: z.iso.datetime().optional(),
});

export const CreateFinanceBudgetSchema = z.object({
  title: z.string().min(3, "Budget title is required").max(160),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("GHS"),
  rationale: z.string().min(10, "Add a short rationale").max(1200),
  lines: z.array(BudgetLineSchema).min(1, "Add at least one budget line"),
});

export const ReviewFinanceBudgetSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(800).optional(),
});
