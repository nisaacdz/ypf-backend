import { MembershipType } from "@/db/schema/enums";
import z from "zod";

export const AuthenticatedUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  roles: z.array(z.string().min(1)), // active roles
  memberships: z.array(z.enum(MembershipType.enumValues)) // active memberships
});

export const UsernameAndPasswordSchema = z.object({
  username: z.string(),
  password: z.string().min(4).max(55)
})

export const AuthCodeSchema = z.object({
  code: z.string()
})

export const OtpSchema = z.object({
  otp: z.string().min(6).max(6)
})

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
