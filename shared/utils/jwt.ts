import jwt from "jsonwebtoken";
import z from "zod";
import variables from "@/configs/env";
import logger from "@/configs/logger";

export type Valid<T> = T & { exp: number };
export type Expired = { exp: number };

export function encodeData<T extends object>(
  payload: T,
  options?: jwt.SignOptions,
): string {
  const signOptions = options ?? { expiresIn: "1h" };

  const token = jwt.sign(payload, variables.security.jwtSecret, signOptions);

  return token;
}

export function decodeData<T extends object>(
  token: string,
  schema: z.ZodType<T>,
): Valid<T> | Expired | null {
  try {
    const decodedPayload = jwt.verify(token, variables.security.jwtSecret);

    if (typeof decodedPayload !== "object" || decodedPayload === null) {
      logger.error({ decodedPayload }, "JWT payload is not a valid object:");
      return null;
    }

    const exp = decodedPayload.exp;

    if (typeof exp !== "number") {
      logger.error({ exp }, "JWT expiration is not a valid number:");
      return null;
    }

    const validationResult = schema.safeParse(decodedPayload);

    if (!validationResult.success) {
      logger.error(
        { zodError: z.treeifyError(validationResult.error) },
        "JWT payload failed schema validation:",
      );
      return null;
    }

    return { ...validationResult.data, exp };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Token is expired but otherwise valid - try to decode without verification
      try {
        const decodedPayload = jwt.decode(token);

        if (typeof decodedPayload !== "object" || decodedPayload === null) {
          return null;
        }

        const exp = decodedPayload.exp;

        if (typeof exp !== "number") {
          return null;
        }

        const validationResult = schema.safeParse(decodedPayload);

        if (!validationResult.success) {
          return null;
        }

        // Return an Expired object - token is valid but expired
        return { exp };
      } catch {
        return null;
      }
    } else if (error instanceof jwt.JsonWebTokenError) {
      // Other JWT errors (malformed, invalid signature, etc.)
      // No need for a loud error log here in production.
      return null;
    } else {
      // Log unexpected errors.
      logger.error(error, "An unexpected error occurred during JWT decoding:");
      return null;
    }
  }
}
