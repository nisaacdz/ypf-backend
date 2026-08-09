import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authenticateLax } from "@/shared/middlewares/auth";
import { authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateFile,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import { Visitors, MEMBER, anyOf } from "@/configs/authorizer";
import { canManageCommunications } from "@/shared/services/workspaceAccessService";
import filesUpload from "@/shared/middlewares/multipart";
import * as postsHandler from "./postsHandler";
import {
  GetPostsQuerySchema,
  GetAdminPostsQuerySchema,
  GetFeaturedPostQuerySchema,
  CreatePostSchema,
  UpdatePostSchema,
  SlugParamSchema,
  UploadPostCoverSchema,
  UploadPostDocumentSchema,
} from "./schemas";
import z from "zod";

/**
 * Public editorial content for the website — Annual Report, Our Research, and
 * Stories of Transformation.
 *
 * Reads are open but only ever return PUBLISHED rows; drafts 404 for anonymous
 * callers even when the slug is guessed correctly. Writes belong to the
 * media/communications committee (`canManageCommunications`).
 */
const postsRouter = Router();

/** Editors publish and unpublish; only they may see drafts. */
const canManagePosts = anyOf(
  Visitors.hasProfile("ADMIN"),
  Visitors.hasRole(MEMBER.PRESIDENT),
  canManageCommunications,
);

// ===== Managed routes =====
// Declared before `/:slug` so "admin" is never swallowed as a slug.

postsRouter.get(
  "/admin",
  authenticate,
  authorize(canManagePosts),
  validateQuery(GetAdminPostsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.getAdminPosts(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.get(
  "/admin/:slug",
  authenticate,
  authorize(canManagePosts),
  validateParams(z.object({ slug: SlugParamSchema }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.getPost(req.Params.slug, {
        includeDrafts: true,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.post(
  "/",
  authenticate,
  authorize(canManagePosts),
  validateBody(CreatePostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.createPost(req.Body);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.patch(
  "/:id",
  authenticate,
  authorize(canManagePosts),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  validateBody(UpdatePostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.updatePost(req.Params.id, req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.delete(
  "/:id",
  authenticate,
  authorize(canManagePosts),
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.deletePost(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.post(
  "/:id/cover",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(canManagePosts),
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadPostCoverSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.uploadPostCover({
        constituentId: req.User!.constituentId,
        postId: req.Params.id,
        file: req.File,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.post(
  "/:id/document",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid Request") }), 404),
  authorize(canManagePosts),
  filesUpload.reportsUpload.single("file"),
  validateFile(UploadPostDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.uploadPostDocument({
        constituentId: req.User!.constituentId,
        postId: req.Params.id,
        file: req.File,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ===== Public routes =====

postsRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetPostsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.getPosts(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.get(
  "/featured",
  authorize(Visitors.ALL),
  validateQuery(GetFeaturedPostQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.getFeaturedPost(req.Query.section);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * The report PDF. Redirects to a short-lived signed blob URL rather than
 * proxying the bytes or exposing the container — so `/posts/:slug/document`
 * stays a stable, shareable link while the storage stays private.
 */
postsRouter.get(
  "/:slug/document",
  authorize(Visitors.ALL),
  validateParams(z.object({ slug: SlugParamSchema }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const url = await postsHandler.getPostDocumentUrl(req.Params.slug);
      res.redirect(302, url);
    } catch (error) {
      next(error);
    }
  },
);

postsRouter.get(
  "/:slug",
  authenticateLax,
  authorize(Visitors.ALL),
  validateParams(z.object({ slug: SlugParamSchema }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await postsHandler.getPost(req.Params.slug);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default postsRouter;
