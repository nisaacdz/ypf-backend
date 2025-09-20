import jwt from "jsonwebtoken";
import z from "zod";
import variables from "@/configs/env";

export function encodeData<T extends object>(
  payload: T,
  options?: jwt.SignOptions,
): string {
  const signOptions = options ?? { expiresIn: "1h" };

  const token = jwt.sign(payload, variables.jwtSecret, signOptions);

  return token;
}

export function decodeData<T>(token: string, schema: z.ZodType<T>): T | null {
  try {
    const decodedPayload = jwt.verify(token, variables.jwtSecret);

    const validationResult = schema.safeParse(decodedPayload);

    if (!validationResult.success) {
      console.error(
        "JWT payload failed schema validation:",
        validationResult.error.format(),
      );
      return null;
    }

    return validationResult.data;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      // No need for a loud console.error here in production for expired tokens.
      // Returning null is sufficient for the application logic to handle it.
    } else {
      // Log unexpected errors.
      console.error("An unexpected error occurred during JWT decoding:", error);
    }

    return null;
  }
}
