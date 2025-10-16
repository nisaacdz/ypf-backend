import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { authenticateLax, authorize } from "@/shared/middlewares/auth";
import { GetProjectsQuerySchema } from "@/shared/validators/activities";
import { validateQuery } from "@/shared/middlewares/validate";
import * as projectsHandler from "./projectsHandler";

const projectsRouter = Router();

projectsRouter.get(
  "/",
  authenticateLax,
  authorize("ALL"),
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

export default projectsRouter;
