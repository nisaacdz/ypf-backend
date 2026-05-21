import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import variables from "@/configs/env";
import logger from "@/configs/logger";

/**
 * Verifies the HMAC-SHA512 signature on incoming Paystack webhooks.
 *
 * Caveat: we currently HMAC `JSON.stringify(req.body)`. Paystack actually
 * computes the HMAC over the raw request body bytes. JSON.stringify happens
 * to round-trip the payload byte-for-byte in practice with Paystack's
 * payloads, but if it ever diverges, every webhook would 400. A more robust
 * version would mount express.raw() only on this route; tracked as a
 * follow-up.
 *
 * Comparison uses crypto.timingSafeEqual to avoid leaking the signature one
 * byte at a time via timing differences.
 */
export function verifyPaystackSignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const signature = req.headers["x-paystack-signature"];
  if (!req.body || typeof signature !== "string") {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  const expected = crypto
    .createHmac("sha512", variables.services.paystack.secretKey)
    .update(JSON.stringify(req.body))
    .digest("hex");

  // Constant-time compare. Both strings are hex digests of identical length,
  // but `timingSafeEqual` throws on length mismatch — guard explicitly so a
  // truncated signature gets a clean 400 instead of a 500.
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  const ok =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!ok) {
    logger.warn(
      {
        sourceIp: req.ip,
        signaturePrefix: signature.slice(0, 8),
      },
      "Rejected Paystack webhook with bad signature",
    );
    return res
      .status(400)
      .json({ success: false, message: "Invalid signature" });
  }

  req.Body = req.body;
  return next();
}
