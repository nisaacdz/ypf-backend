import { Request, Response, NextFunction, Router } from "express";
import { validateParams } from "@/shared/middlewares/validate";
import * as transactionsHandler from "./transactionsHandler";
import z from "zod";

const transactionsRouter = Router();

/**
 * @swagger
 * /api/v1/transactions/{reference}/verify:
 *   post:
 *     summary: Verify a transaction by its external reference
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction external reference (e.g., Paystack reference)
 *     responses:
 *       200:
 *         description: Transaction verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Server error
 */
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
