import variables from "@/configs/env";
import z from "zod";
import { Profiles } from "@/shared/types";

export const UsernameAndPasswordSchema = z.object({
  username: z.string({ message: "Username is required." }),
  password: z
    .string({ message: "Password is required." })
    .min(4, { message: "Password must be at least 4 characters." })
    .max(55, { message: "Password must not exceed 55 characters." }),
});

export const AuthCodeSchema = z.object({
  code: z.string({ message: "Authorization code is required." }),
  codeVerifier: z.string({ message: "Code verifier is required." }),
  redirectUri: z.url({ message: "Please enter a valid redirect URL." }).refine(
    (uri) => {
      try {
        const url = new URL(uri);
        return variables.security.allowedOrigins.includes(url.origin);
      } catch {
        return false;
      }
    },
    {
      message: "The redirect URI is not from an allowed origin.",
    },
  ),
});

export const OtpSchema = z.object({
  otp: z
    .string({ message: "OTP is required." })
    .min(6, { message: "OTP must be exactly 6 characters." })
    .max(6, { message: "OTP must be exactly 6 characters." }),
});

export const ForgotPasswordSchema = z.object({
  email: z.email({ message: "Please enter a valid email address." }),
});

export const ResetPasswordSchema = z.object({
  email: z.email({ message: "Please enter a valid email address." }),
  otp: z
    .string({ message: "OTP is required." })
    .min(6, { message: "OTP must be exactly 6 characters." })
    .max(6, { message: "OTP must be exactly 6 characters." }),
  password: z
    .string({ message: "Password is required." })
    .min(4, { message: "Password must be at least 4 characters." })
    .max(55, { message: "Password must not exceed 55 characters." }),
});
export const ChangePasswordSchema = z.object({
  newPassword: z
    .string({ message: "New password is required." })
    .min(4, { message: "Password must be at least 4 characters." })
    .max(55, { message: "Password must not exceed 55 characters." }),
});
