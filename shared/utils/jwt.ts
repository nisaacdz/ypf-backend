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

export type DecodeResult<T> =
  | { valid: T & { exp: number } }
  | { expired: { exp: number } }
  | null;

export function decodeData<T extends object>(
  token: string,
  schema: z.ZodType<T>,
): DecodeResult<T> {
  try {
    const decodedPayload = jwt.verify(token, variables.security.jwtSecret, {
      ignoreExpiration: true,
    });

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

    const now = Math.floor(Date.now() / 1000);
    const payloadData = validationResult.data as T;

    if (exp < now) {
      return { expired: { exp } };
    }

    return { valid: { ...(payloadData as T), exp } };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug(
        { err: error.message },
        "JWT verification failed (JsonWebTokenError):",
      );
    } else {
      logger.error(error, "An unexpected error occurred during JWT decoding:");
    }

    return null;
  }
}
