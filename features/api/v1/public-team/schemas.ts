import z from "zod";

export const CreateTeamMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  bio: z.string().max(1000).optional(),
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  constituentId: z.uuid().nullable().optional(),
});

export const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial();

export const ReorderTeamSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        position: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export const UploadTeamPhotoSchema = z
  .object({
    size: z.number().positive(),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"], {
      error: () => ({
        message: "Only PNG, JPEG, and WEBP images are allowed.",
      }),
    }),
  })
  .refine((d) => d.size <= 10 * 1024 * 1024, {
    message: "Photo cannot exceed 10MB.",
    path: ["size"],
  });
