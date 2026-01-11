import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  authenticate,
  authenticateLax,
  authorize,
} from "@/shared/middlewares/auth";
import {
  GetProjectsQuerySchema,
  GetProjectMediaQuerySchema,
  UploadProjectFileSchema,
  UploadProjectMediumOptionsSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  UpdateProjectMediumSchema,
} from "./schemas";
import {
  validateQuery,
  validateParams,
  validateFile,
  validateBody,
} from "@/shared/middlewares/validate";
import * as projectsHandler from "./projectsHandler";
import { Visitors, MEMBER, anyOf } from "@/configs/authorizer";
import z from "zod";
import filesUpload from "@/shared/middlewares/multipart";

const projectsRouter = Router();

projectsRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetProjectsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjects(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.post(
  "/",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.PRESIDENT)),
  ),
  validateBody(CreateProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.createProject(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.get(
  "/:id",
  authenticateLax,
  authorize(Visitors.ALL),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProject(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.put(
  "/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.PRESIDENT)),
  ),
  validateBody(UpdateProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.updateProject(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.get(
  "/:id/media",
  authenticateLax,
  authorize(Visitors.ALL),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  validateQuery(GetProjectMediaQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjectMedia(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.post(
  "/:id/media",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.PRESIDENT)),
  ),
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadProjectFileSchema),
  validateBody(UploadProjectMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.uploadProjectMedium({
        constituentId: req.User!.constituentId,
        projectId: req.Params.id,
        file: req.File,
        options: req.Body,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.patch(
  "/:id/media",
  authenticate,
  validateParams(z.object({ id: z.uuid() }), 404),
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.PRESIDENT)),
  ),
  validateBody(UpdateProjectMediumSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.updateProjectMedium(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.get(
  "/:id/events",
  validateParams(z.object({ id: z.uuid() }), 404),
  validateQuery(
    z.object({
      page: z.coerce.number().min(1).default(1).optional(),
      pageSize: z.coerce.number().min(1).max(100).default(10).optional(),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjectEvents(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default projectsRouter;
