import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import * as handlers from "./handlers";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Welfare
 *   description: Welfare case management
 */

router.use(authenticate);

/**
 * @swagger
 * /api/v1/welfare:
 *   post:
 *     summary: Report a new welfare case
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - description
 *               - priority
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [MEDICAL, FINANCIAL, HOUSING, EDUCATION, OTHER]
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *     responses:
 *       201:
 *         description: Welfare case reported
 *   get:
 *     summary: Get welfare cases (User sees own, Admin sees all)
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of welfare cases
 */
// Member routes
router.post("/", handlers.createCase);
router.get("/", handlers.getCases);

/**
 * @swagger
 * /api/v1/welfare/{id}:
 *   get:
 *     summary: Get welfare case by ID
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Welfare case details
 *       404:
 *         description: Welfare case not found
 */
router.get("/:id", handlers.getCase);

// Admin/Committee routes
router.use(authorize(Visitors.hasProfile("ADMIN"))); // Should also include Welfare Committee roles

/**
 * @swagger
 * /api/v1/welfare/{id}:
 *   put:
 *     summary: Update a welfare case (Admin)
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Welfare case updated
 */
router.put("/:id", handlers.updateCase);

/**
 * @swagger
 * /api/v1/welfare/{id}/assign:
 *   put:
 *     summary: Assign a welfare case to a handler (Admin)
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignedToId
 *             properties:
 *               assignedToId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Welfare case assigned
 */
router.put("/:id/assign", handlers.assignCase);

export default router;
