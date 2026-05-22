import { Request, Response, NextFunction, Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { CreateDonationSchema, GetDonationsQuerySchema } from "./schemas";
import { Visitors } from "@/configs/authorizer";
import { rateLimit } from "@/shared/middlewares/rateLimit";
import * as donationsHandler from "./donationsHandler";
import z from "zod";

const donationsRouter = Router();

donationsRouter.post(
  "/paystack",
  // Audit I1 — public payment endpoints attracted no rate limit; an attacker
  // could spam this to burn through our Paystack /transaction/initialize
  // quota and pollute FinancialTransactions with PENDING rows. 10 inits per
  // 5-min window per IP is generous for real donors, painful for bots.
  rateLimit({ windowMs: 5 * 60 * 1000, maxRequests: 10 }),
  authenticateLax,
  validateBody(CreateDonationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await donationsHandler.initiatePaystackDonation(
        req.Body,
        req.User || null,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

donationsRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetDonationsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await donationsHandler.getDonations(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// CSV export of donations matching the current filters.
donationsRouter.get(
  "/export.csv",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetDonationsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await donationsHandler.exportDonationsCsv(req.Query, res);
    } catch (err) {
      next(err);
    }
  },
);

// Plan §8.9 — public success-page polling. No PII; just status + amount.
donationsRouter.get(
  "/by-ref/:ref",
  validateParams(z.object({ ref: z.string().min(8).max(100) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await donationsHandler.getDonationByRef(req.Params.ref);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default donationsRouter;
