import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import variables from "@/configs/env";

export function verifyPaystackSignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const signature = req.headers["x-paystack-signature"];
  if (!req.body || typeof signature !== "string") {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  const hash = crypto
    .createHmac("sha512", String(variables.services.paystack.secretHash))
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== signature) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid signature" });
  }
  req.Body = req.body;
  return next();
}
