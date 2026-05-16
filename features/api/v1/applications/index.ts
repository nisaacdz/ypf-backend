import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  validateBody,
  validateFiles,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import * as applicationsHandler from "./applicationsHandler";
import { documentsUpload } from "@/shared/middlewares/multipart";
import { ADMIN, anyOf, MEMBER, Visitors } from "@/configs/authorizer";
import z from "zod";
import {
  PostMembershipApplicationBody,
  PostVolunteerApplicationBody,
  UpdateMembershipApplicationStatusSchema,
  GetMembershipApplicationsQuerySchema,
  GetVolunteerApplicationsQuerySchema,
  UploadRegistrationFileSchema,
} from "./schemas";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";

const applicationsRouter = Router();

applicationsRouter.get(
  "/membership",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT, MEMBER.COMMITTEECHAIR),
    ),
  ),
  validateQuery(GetMembershipApplicationsQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getMembershipApplications(
        req.Query,
      );
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

applicationsRouter.patch(
  "/membership/:id/status",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT, MEMBER.COMMITTEECHAIR),
    ),
  ),
  validateParams(z.object({ id: z.uuid("Applicant not found") }), 404),
  validateBody(UpdateMembershipApplicationStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const response =
        await applicationsHandler.updateMembershipApplicationStatus({
          applicationId: id,
          body: req.Body,
          adminId: req.User?.id!,
        });

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/applications/membership/${id}`);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

applicationsRouter.get(
  "/membership/:id",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT, MEMBER.COMMITTEECHAIR),
    ),
  ),
  validateParams(z.object({ id: z.uuid("Applicant not found") }), 404),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getMembershipApplicationById(
        req.Params.id,
      );
      redisClient
        .setResponseCache(req.CacheKey, response, 60 * 5)
        .catch((err) => {
          logger.error(err, `Failed to set cache for ${req.CacheKey}`);
        });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

applicationsRouter.post(
  "/membership",
  documentsUpload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "nationalId", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  validateFiles({
    passportPhoto: UploadRegistrationFileSchema,
    nationalId: UploadRegistrationFileSchema,
    resume: UploadRegistrationFileSchema.optional(),
  }),
  validateBody(PostMembershipApplicationBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.createMembershipApplication({
        data: req.Body,
        files: req.Files,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

applicationsRouter.get(
  "/volunteer",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT, MEMBER.COMMITTEECHAIR),
    ),
  ),
  validateQuery(GetVolunteerApplicationsQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getVolunteerApplications(
        req.Query,
      );
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

applicationsRouter.get(
  "/volunteer/:id",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT, MEMBER.COMMITTEECHAIR),
    ),
  ),
  validateParams(z.object({ id: z.uuid("Applicant not found") }), 404),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getVolunteerApplicationById(
        req.Params.id,
      );
      redisClient
        .setResponseCache(req.CacheKey, response, 60 * 5)
        .catch((err) => {
          logger.error(err, `Failed to set cache for ${req.CacheKey}`);
        });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

applicationsRouter.post(
  "/volunteer",
  validateBody(PostVolunteerApplicationBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.createVolunteerApplication(
        req.Body,
      );
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default applicationsRouter;
