import z from "zod";

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
