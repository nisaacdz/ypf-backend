import z from "zod";

export const AuthTokenValidationSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  roles: z.array(z.string().min(1)),
});

export type AuthenticatedUser = z.infer<typeof AuthTokenValidationSchema>;
