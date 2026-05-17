import { Request, Response, NextFunction, Router } from "express";
import z from "zod";

import { authorize, authenticate } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import {
  canAccessWorkspaceRequest,
  canManageWorkspaceRequest,
} from "@/shared/services/workspaceAccessService";
import * as workspacesHandler from "./workspacesHandler";
import {
  CreateWorkspaceNoteSchema,
  SubmitWorkspaceDocumentSchema,
  WorkspaceAliasParamsSchema,
  WorkspaceNotesQuerySchema,
  WorkspaceReportQuerySchema,
} from "./schemas";

const workspacesRouter = Router();

workspacesRouter.get(
  "/notes",
  authenticate,
  validateQuery(WorkspaceNotesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.getWorkspaceNotes({
        committeeId: req.Query.committeeId,
        entityType: req.Query.entityType,
        entityId: req.Query.entityId,
        user: req.User!,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/notes",
  authenticate,
  validateBody(CreateWorkspaceNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.createWorkspaceNote({
        committeeId: req.Body.committeeId,
        entityType: req.Body.entityType,
        entityId: req.Body.entityId,
        body: req.Body.body,
        user: req.User!,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.delete(
  "/notes/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid note ID") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.deleteWorkspaceNote({
        noteId: req.Params.id,
        user: req.User!,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/:alias/report",
  authenticate,
  validateParams(WorkspaceAliasParamsSchema, 404),
  authorize(canAccessWorkspaceRequest),
  validateQuery(WorkspaceReportQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.getWorkspaceReport({
        alias: req.Params.alias,
        month: req.Query.month,
        user: req.User!,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/:alias/submissions",
  authenticate,
  validateParams(WorkspaceAliasParamsSchema, 404),
  authorize(canManageWorkspaceRequest),
  validateBody(SubmitWorkspaceDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.submitWorkspaceDocument({
        alias: req.Params.alias,
        user: req.User!,
        month: req.Body.month,
        kind: req.Body.kind,
        body: req.Body.body,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default workspacesRouter;
