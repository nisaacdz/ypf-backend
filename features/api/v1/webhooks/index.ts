import { NextFunction, Request, Response } from "express";
import { verifyPaystackSignature } from "@/shared/middlewares/webhooks";
import { Router } from "express";
import { handlePaystackWebhook } from "./webhooksHandler";

const webhooksRouter = Router();

webhooksRouter.post(
  "/paystack",
  verifyPaystackSignature,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await handlePaystackWebhook(req.body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default webhooksRouter;
