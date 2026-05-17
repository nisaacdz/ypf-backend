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
import * as donationsHandler from "./donationsHandler";
import z from "zod";

const donationsRouter = Router();

donationsRouter.post(
  "/paystack",
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
