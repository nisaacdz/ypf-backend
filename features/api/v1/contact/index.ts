import { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import z from "zod";
import {
  CreateContactSubmissionSchema,
  GetContactSubmissionsQuerySchema,
  UpdateContactSubmissionSchema,
} from "./schemas";
import * as contactHandler from "./contactHandler";

const contactRouter = Router();

// Plan §8.3 — public POST is rate-limited (3/hour/IP) to keep the spam floor low.
const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many submissions, please try again later.",
  },
});

contactRouter.post(
  "/",
  publicLimiter,
  validateBody(CreateContactSubmissionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sourceIp = req.ip ?? null;
      const response = await contactHandler.createContactSubmission({
        body: req.Body,
        sourceIp,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ─── Admin (UMS) inbox ───────────────────────────────────────────────────────

contactRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetContactSubmissionsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await contactHandler.listContactSubmissions(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

contactRouter.patch(
  "/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid submission id") })),
  validateBody(UpdateContactSubmissionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await contactHandler.updateContactSubmission({
        id: req.Params.id,
        body: req.Body,
        reviewerConstituentId: req.User?.constituentId ?? null,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default contactRouter;
