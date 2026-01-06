import { Request, Response, NextFunction, Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import { validateBody, validateQuery } from "@/shared/middlewares/validate";
import { CreateDonationSchema, GetDonationsQuerySchema } from "./schemas";
import { Visitors } from "@/configs/authorizer";
import * as donationsHandler from "./donationsHandler";

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

export default donationsRouter;
