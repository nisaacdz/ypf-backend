import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
  validateFile,
} from "@/shared/middlewares/validate";
import { documentsUpload } from "@/shared/middlewares/multipart";
import { Visitors } from "@/configs/authorizer";
import {
  GetPartnershipsQuerySchema,
  CreatePartnershipSchema,
  UpdatePartnershipSchema,
  UploadContractDocumentSchema,
} from "./schemas";
import * as partnershipsHandler from "./partnershipsHandler";
import z from "zod";

const partnershipsRouter = Router();

partnershipsRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetPartnershipsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.getPartnerships(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

partnershipsRouter.get(
  "/:id",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.getPartnership(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

partnershipsRouter.post(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  documentsUpload.single("contractDocument"),
  validateFile(UploadContractDocumentSchema.optional()),
  validateBody(CreatePartnershipSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.createPartnership({
        data: req.Body,
        contractDocument: req.file,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

partnershipsRouter.patch(
  "/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdatePartnershipSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.updatePartnership(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

partnershipsRouter.delete(
  "/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.deletePartnership(
        req.Params.id,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default partnershipsRouter;
