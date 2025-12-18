import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import * as handlers from "./handlers";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Admin dashboard statistics
 */

router.use(authenticate);
router.use(authorize(Visitors.hasProfile("ADMIN"))); // Dashboard is mostly for admins

/**
 * @swagger
 * /api/v1/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalMembers:
 *                   type: integer
 *                 activePrograms:
 *                   type: integer
 *                 pendingWelfareCases:
 *                   type: integer
 *                 activeSponsorships:
 *                   type: integer
 */
router.get("/stats", handlers.getStats);

/**
 * @swagger
 * /api/v1/dashboard/activity:
 *   get:
 *     summary: Get recent activity logs
 *     tags: [Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Recent activities
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get("/activity", handlers.getActivity);

export default router;
