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
import { ADMIN, Visitors } from "@/configs/authorizer";
import * as workspacesHandler from "./workspacesHandler";
import {
  CreateFinanceBudgetSchema,
  CreateFinanceExpenditureSchema,
  CreateWorkspaceNoteSchema,
  FinanceLedgerQuerySchema,
  ReviewFinanceBudgetSchema,
  SubmitWorkspaceDocumentSchema,
  UpdateWorkspaceNoteSchema,
  WorkspaceAliasParamsSchema,
  WorkspaceNotesQuerySchema,
  WorkspaceReportQuerySchema,
  WorkspaceReportsQuerySchema,
} from "./schemas";

const workspacesRouter = Router();

workspacesRouter.get(
  "/reports",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateQuery(WorkspaceReportsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.getAllWorkspaceReports({
        month: req.Query.month,
        user: req.User!,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

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

workspacesRouter.patch(
  "/notes/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid note ID") }), 404),
  validateBody(UpdateWorkspaceNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.updateWorkspaceNote({
        noteId: req.Params.id,
        body: req.Body.body,
        user: req.User!,
      });
      res.status(200).json(response);
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
  "/finance/donations",
  authenticate,
  validateQuery(FinanceLedgerQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.getFinanceDonations({
        user: req.User!,
        page: req.Query.page,
        pageSize: req.Query.pageSize,
        month: req.Query.month,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/finance/expenditures",
  authenticate,
  validateQuery(FinanceLedgerQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.getFinanceExpenditures({
        user: req.User!,
        page: req.Query.page,
        pageSize: req.Query.pageSize,
        month: req.Query.month,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/finance/expenditures",
  authenticate,
  validateBody(CreateFinanceExpenditureSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.createFinanceExpenditure({
        user: req.User!,
        amount: req.Body.amount,
        currency: req.Body.currency,
        description: req.Body.description,
        category: req.Body.category,
        timestamp: req.Body.timestamp,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.get(
  "/finance/budgets",
  authenticate,
  validateQuery(FinanceLedgerQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.getFinanceBudgets({
        user: req.User!,
        page: req.Query.page,
        pageSize: req.Query.pageSize,
        month: req.Query.month,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.post(
  "/finance/budgets",
  authenticate,
  validateBody(CreateFinanceBudgetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.createFinanceBudget({
        user: req.User!,
        title: req.Body.title,
        month: req.Body.month,
        currency: req.Body.currency,
        rationale: req.Body.rationale,
        lines: req.Body.lines,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

workspacesRouter.patch(
  "/finance/budgets/:id/review",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid budget ID") }), 404),
  validateBody(ReviewFinanceBudgetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await workspacesHandler.reviewFinanceBudget({
        user: req.User!,
        budgetId: req.Params.id,
        status: req.Body.status,
        reviewNote: req.Body.reviewNote,
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
        documentName: req.Body.documentName,
        documentUrl: req.Body.documentUrl,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default workspacesRouter;
