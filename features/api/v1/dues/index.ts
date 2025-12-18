import { Router } from "express";
import * as handlers from "./handlers";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Dues
 *   description: Membership dues management
 */

/**
 * @swagger
 * /api/v1/dues:
 *   get:
 *     summary: Get dues configurations
 *     tags: [Dues]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: chapterId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of dues configurations
 */
// Protected routes
router.get("/", authenticate, authorize(Visitors.hasProfile("ADMIN", "MEMBER")), handlers.getDues);

/**
 * @swagger
 * /api/v1/dues/my:
 *   get:
 *     summary: Get my dues payment history
 *     tags: [Dues]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User's dues history
 */
router.get("/my", authenticate, authorize(Visitors.hasProfile("MEMBER")), handlers.getMyDuesHistory);

/**
 * @swagger
 * /api/v1/dues/pay:
 *   post:
 *     summary: Pay dues
 *     tags: [Dues]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - duesId
 *               - amount
 *             properties:
 *               duesId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: GHS
 *     responses:
 *       200:
 *         description: Payment initiated
 */
router.post("/pay", authenticate, authorize(Visitors.hasProfile("MEMBER")), handlers.payDues);

// Admin routes

/**
 * @swagger
 * /api/v1/dues:
 *   post:
 *     summary: Create new dues configuration (Admin)
 *     tags: [Dues]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - amount
 *               - frequency
 *             properties:
 *               title:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: GHS
 *               frequency:
 *                 type: string
 *                 enum: [MONTHLY, QUARTERLY, ANNUALLY, ONE_TIME]
 *               chapterId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Dues configuration created
 */
router.post("/", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.createDues);

/**
 * @swagger
 * /api/v1/dues/{id}:
 *   get:
 *     summary: Get dues configuration by ID
 *     tags: [Dues]
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
 *         description: Dues configuration details
 *       404:
 *         description: Dues configuration not found
 */
router.get("/:id", authenticate, authorize(Visitors.hasProfile("ADMIN", "MEMBER")), handlers.getDuesById);

/**
 * @swagger
 * /api/v1/dues/{id}:
 *   put:
 *     summary: Update dues configuration (Admin)
 *     tags: [Dues]
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
 *               title:
 *                 type: string
 *               amount:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Dues configuration updated
 */
router.put("/:id", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.updateDues);

export default router;
