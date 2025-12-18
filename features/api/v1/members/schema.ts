import { z } from "zod";

export const createMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  chapterId: z.string().uuid().optional(),
  // Add other fields as needed
});

export const updateMemberSchema = createMemberSchema.partial();

export const assignRoleSchema = z.object({
  role: z.string(), 
});

export const assignTitleSchema = z.object({
  title: z.string(),
});
