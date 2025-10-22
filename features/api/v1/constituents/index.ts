import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { authenticateLax, authorize } from "@/shared/middlewares/auth";
import { validateQuery } from "@/shared/middlewares/validate";
import * as constituentsHandler from "./constituentsHandler";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import { Visitors } from "@/configs/authorizer";

const constituentsRouter = Router();

constituentsRouter.get(
  "/members",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetMembersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.getMembers(req.Query); // we know its safe because of validateParams
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default constituentsRouter;
