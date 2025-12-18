import { Router } from "express";
import * as handlers from "./handlers";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Programs
 *   description: Program management and enrollment
 */

/**
 * @swagger
 * /api/v1/programs:
 *   get:
 *     summary: Get all programs
 *     tags: [Programs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of programs
 *   post:
 *     summary: Create a new program
 *     tags: [Programs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - startDate
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *               budget:
 *                 type: string
 *               committeeId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Program created
 */
// Public routes (or Member accessible)
router.get("/", authenticate, authorize(Visitors.hasProfile("ADMIN", "MEMBER")), handlers.getPrograms);

/**
 * @swagger
 * /api/v1/programs/{id}:
 *   get:
 *     summary: Get program by ID
 *     tags: [Programs]
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
 *         description: Program details
 *       404:
 *         description: Program not found
 *   put:
 *     summary: Update a program
 *     tags: [Programs]
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
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Program updated
 *   delete:
 *     summary: Delete a program
 *     tags: [Programs]
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
 *         description: Program deleted
 */
router.get("/:id", authenticate, authorize(Visitors.hasProfile("ADMIN", "MEMBER")), handlers.getProgramById);

// Admin routes
router.post("/", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.createProgram);
router.put("/:id", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.updateProgram);
router.delete("/:id", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.deleteProgram);

/**
 * @swagger
 * /api/v1/programs/{id}/enroll:
 *   post:
 *     summary: Enroll a member in a program
 *     tags: [Programs]
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
 *               - memberId
 *             properties:
 *               memberId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Enrolled successfully
 */
// Enrollment routes
router.post("/:id/enroll", authenticate, authorize(Visitors.hasProfile("ADMIN", "MEMBER")), handlers.enrollMember);

/**
 * @swagger
 * /api/v1/programs/{id}/withdraw:
 *   post:
 *     summary: Withdraw a member from a program
 *     tags: [Programs]
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
 *               - memberId
 *             properties:
 *               memberId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Withdrawn successfully
 */
router.post("/:id/withdraw", authenticate, authorize(Visitors.hasProfile("ADMIN", "MEMBER")), handlers.withdrawMember);

export default router;
