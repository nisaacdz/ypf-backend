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
  GetProjectEnrollmentsQuerySchema,
  UploadProjectFileSchema,
  UploadProjectMediumOptionsSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  UpdateProjectMediumSchema,
  GuestProjectRegistrationSchema,
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
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";
import { canManageProgramsRecords } from "@/shared/services/workspaceAccessService";

const projectsRouter = Router();

projectsRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetProjectsQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjects(req.Query);
      // Cache for 60 seconds
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
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
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  validateBody(CreateProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.createProject(req.Body);
      await redisClient.delCache("/api/v1/projects");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.get(
  "/my-enrollments",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { getMyProjectEnrollments } = await import(
        "@/shared/services/enrollmentService"
      );
      const projectIds = await getMyProjectEnrollments(
        req.User!.constituentId,
      );
      res.status(200).json({
        success: true,
        message: "My project enrollments",
        data: projectIds,
      });
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
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProject(req.Params.id);
      // Cache for 60 seconds
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
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
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  validateBody(UpdateProjectSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.updateProject(
        req.Params.id,
        req.Body,
      );

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/projects/${req.Params.id}`);
      await redisClient.delCache("/api/v1/projects");

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
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjectMedia(
        req.Params.id,
        req.Query,
      );
      // Cache for 60 seconds
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
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
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
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

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/projects/${req.Params.id}`);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.patch(
  "/:projectId/media/:mediumId",
  authenticate,
  validateParams(z.object({ projectId: z.uuid(), mediumId: z.uuid() }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  validateBody(UpdateProjectMediumSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.updateProjectMedium(
        req.Params.projectId,
        req.Params.mediumId,
        req.Body,
      );

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/projects/${req.Params.projectId}`);

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

// Audit I6 — admin registrants roster. Authenticated admin OR program
// committee chair (because programs/records ownership covers this). Guest
// PII is included in the response, so this stays admin-only.
projectsRouter.get(
  "/:id/enrollments",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  validateParams(z.object({ id: z.uuid() }), 404),
  validateQuery(GetProjectEnrollmentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjectEnrollments(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ─── Public guest registration (plan §8.1) ───────────────────────────────────

projectsRouter.post(
  "/:id/register-guest",
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  validateBody(GuestProjectRegistrationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.registerGuestForProject(
        req.Params.id,
        req.Body,
      );
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ─── Project Enrollment (self-service for authenticated members) ─────────────

projectsRouter.post(
  "/:id/enroll",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { enrollInProject } = await import(
        "@/shared/services/enrollmentService"
      );
      const enrollmentId = await enrollInProject(
        req.Params.id,
        req.User!.constituentId,
      );
      res.status(200).json({
        success: true,
        message: "Enrolled in project",
        data: { enrollmentId },
      });
    } catch (error) {
      next(error);
    }
  },
);

projectsRouter.post(
  "/:id/unenroll",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { unenrollFromProject } = await import(
        "@/shared/services/enrollmentService"
      );
      await unenrollFromProject(req.Params.id, req.User!.constituentId);
      res.status(200).json({
        success: true,
        message: "Unenrolled from project",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default projectsRouter;
