import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  validateBody,
  validateFile,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import {
  CreateEventSchema,
  GetEventMediaQuerySchema,
  GetEventsQuerySchema,
  UploadEventFileSchema,
  UploadEventMediumOptionsSchema,
  UpdateEventSchema,
  UpdateEventMediumSchema,
} from "./schemas";
import {
  authenticate,
  authenticateLax,
  authorize,
} from "@/shared/middlewares/auth";
import * as eventsHandler from "./eventsHandler";
import filesUpload from "@/shared/middlewares/multipart";
import z from "zod";
import { ADMIN, anyOf, MEMBER, Visitors } from "@/configs/authorizer";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";
import { canManageProgramsRecords } from "@/shared/services/workspaceAccessService";

const eventsRouter = Router();

eventsRouter.get(
  "/",
  authenticateLax,
  authorize(Visitors.ALL),
  validateQuery(GetEventsQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.getEvents(req.Query);
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

eventsRouter.post(
  "/",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  validateBody(CreateEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.createEvent(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.get(
  "/my-registrations",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { getMyEventRegistrations } = await import(
        "@/shared/services/enrollmentService"
      );
      const eventIds = await getMyEventRegistrations(req.User!.constituentId);
      res.status(200).json({
        success: true,
        message: "My event registrations",
        data: eventIds,
      });
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.post(
  "/:id/media",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadEventFileSchema),
  validateBody(UploadEventMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.uploadEventMedium({
        constituentId: req.User!.constituentId,
        eventId: req.Params.id,
        file: req.File,
        options: req.Body,
      });

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/events/${req.Params.id}`);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.get(
  "/:id/media",
  authenticateLax,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(Visitors.ALL),
  validateQuery(GetEventMediaQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.getEventMedia(
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

eventsRouter.get(
  "/:id",
  authenticateLax,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(Visitors.ALL),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.getEventById(req.Params.id);
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

eventsRouter.put(
  "/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  validateBody(UpdateEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.updateEvent(req.Params.id, req.Body);

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/events/${req.Params.id}`);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.delete(
  "/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.deleteEvent(req.Params.id);

      // Clear caches that reference this event
      await redisClient.delCache(`/api/v1/events/${req.Params.id}`);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.patch(
  "/:eventId/media/:eventMediumId",
  authenticate,
  validateParams(z.object({ eventId: z.uuid(), eventMediumId: z.uuid() }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT),
      canManageProgramsRecords,
    ),
  ),
  validateBody(UpdateEventMediumSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.updateEventMedium(
        req.Params.eventId,
        req.Params.eventMediumId,
        req.Body,
      );

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/events/${req.Params.eventId}`);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ─── Event Registration (self-service for authenticated members) ────────────

eventsRouter.post(
  "/:id/register",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { registerForEvent } = await import(
        "@/shared/services/enrollmentService"
      );
      const attendeeId = await registerForEvent(
        req.Params.id,
        req.User!.constituentId,
      );
      res.status(200).json({
        success: true,
        message: "Registered for event",
        data: { attendeeId },
      });
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.post(
  "/:id/unregister",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { unregisterFromEvent } = await import(
        "@/shared/services/enrollmentService"
      );
      await unregisterFromEvent(req.Params.id, req.User!.constituentId);
      res.status(200).json({
        success: true,
        message: "Unregistered from event",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default eventsRouter;
