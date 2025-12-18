import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import * as handlers from "./handlers";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Sponsorships
 *   description: Sponsorship management
 */

router.use(authenticate);

/**
 * @swagger
 * /api/v1/sponsorships:
 *   get:
 *     summary: Get all sponsorships
 *     tags: [Sponsorships]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all sponsorships
 */
// Public/Member routes (View only)
router.get("/", handlers.getSponsorships);

/**
 * @swagger
 * /api/v1/sponsorships/{id}:
 *   get:
 *     summary: Get sponsorship by ID
 *     tags: [Sponsorships]
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
 *         description: Sponsorship details
 *       404:
 *         description: Sponsorship not found
 */
router.get("/:id", handlers.getSponsorship);

// Admin routes
router.use(authorize(Visitors.hasProfile("ADMIN")));

/**
 * @swagger
 * /api/v1/sponsorships:
 *   post:
 *     summary: Create a new sponsorship (Admin)
 *     tags: [Sponsorships]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sponsorId
 *               - beneficiaryId
 *               - type
 *               - amount
 *               - frequency
 *             properties:
 *               sponsorId:
 *                 type: string
 *                 format: uuid
 *               beneficiaryId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [EDUCATION, MEDICAL, GENERAL_WELFARE, PROJECT_SPECIFIC]
 *               amount:
 *                 type: string
 *               currency:
 *                 type: string
 *                 default: NGN
 *               frequency:
 *                 type: string
 *                 enum: [ONE_TIME, MONTHLY, QUARTERLY, ANNUALLY]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sponsorship created
 */
router.post("/", handlers.createSponsorship);

/**
 * @swagger
 * /api/v1/sponsorships/{id}:
 *   put:
 *     summary: Update a sponsorship (Admin)
 *     tags: [Sponsorships]
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
 *                 enum: [ACTIVE, COMPLETED, CANCELLED, PENDING]
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Sponsorship updated
 *   delete:
 *     summary: Delete a sponsorship (Admin)
 *     tags: [Sponsorships]
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
 *       204:
 *         description: Sponsorship deleted
 */
router.put("/:id", handlers.updateSponsorship);
router.delete("/:id", handlers.deleteSponsorship);

export default router;
