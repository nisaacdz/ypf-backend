import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateFile,
  validateParams,
} from "@/shared/middlewares/validate";
import { Visitors } from "@/configs/authorizer";
import filesUpload from "@/shared/middlewares/multipart";
import * as publicTeamHandler from "./publicTeamHandler";
import {
  CreateTeamMemberSchema,
  UpdateTeamMemberSchema,
  ReorderTeamSchema,
  UploadTeamPhotoSchema,
} from "./schemas";
import z from "zod";

const publicTeamRouter = Router();

// Public read endpoint — used by the marketing site's About / Team section.
publicTeamRouter.get(
  "/",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await publicTeamHandler.getPublicTeam();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// Admin-only management endpoints.
const adminOnly = [authenticate, authorize(Visitors.hasProfile("ADMIN"))];

publicTeamRouter.get(
  "/admin",
  ...adminOnly,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await publicTeamHandler.getAdminTeam();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

publicTeamRouter.post(
  "/",
  ...adminOnly,
  validateBody(CreateTeamMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await publicTeamHandler.createTeamMember(req.Body);
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

publicTeamRouter.put(
  "/:id",
  ...adminOnly,
  validateParams(z.object({ id: z.uuid() })),
  validateBody(UpdateTeamMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await publicTeamHandler.updateTeamMember(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

publicTeamRouter.delete(
  "/:id",
  ...adminOnly,
  validateParams(z.object({ id: z.uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await publicTeamHandler.deleteTeamMember(req.Params.id);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

publicTeamRouter.post(
  "/:id/photo",
  ...adminOnly,
  validateParams(z.object({ id: z.uuid() })),
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadTeamPhotoSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await publicTeamHandler.uploadTeamPhoto({
        id: req.Params.id,
        file: req.File,
        uploaderConstituentId: req.User!.constituentId,
      });
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

publicTeamRouter.post(
  "/reorder",
  ...adminOnly,
  validateBody(ReorderTeamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await publicTeamHandler.reorderTeam(req.Body);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default publicTeamRouter;
