import jwt from "jsonwebtoken";
import z from "zod";
import variables from "@/configs/env";
import logger from "@/configs/logger";

export function encodeData<T extends object>(
  payload: T,
  options?: jwt.SignOptions,
): string {
  const signOptions = options ?? { expiresIn: "1h" };

  const token = jwt.sign(payload, variables.security.jwtSecret, signOptions);

  return token;
}

export function decodeData<T>(token: string, schema: z.ZodType<T>): T | null {
  try {
    const decodedPayload = jwt.verify(token, variables.security.jwtSecret);

    const validationResult = schema.safeParse(decodedPayload);

    if (!validationResult.success) {
      logger.error(
        { zodError: z.treeifyError(validationResult.error) },
        "JWT payload failed schema validation:",
      );
      return null;
    }

    return validationResult.data;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      // No need for a loud error log here in production for expired tokens.
      // Returning null is sufficient for the application logic to handle it.
    } else {
      // Log unexpected errors.
      logger.error(error, "An unexpected error occurred during JWT decoding:");
    }

    return null;
  }
}
