import { Request, Response, NextFunction, Router } from "express";
import { validateParams } from "@/shared/middlewares/validate";
import * as transactionsHandler from "./transactionsHandler";
import z from "zod";

const transactionsRouter = Router();

transactionsRouter.post(
  "/:reference/verify",
  validateParams(
    z.object({
      reference: z.string().min(1, "Reference is required"),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await transactionsHandler.verifyTransaction(
        req.Params.reference,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default transactionsRouter;
