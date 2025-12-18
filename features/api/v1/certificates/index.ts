import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import * as handlers from "./handlers";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Certificates
 *   description: Certificate management and issuance
 */

router.use(authenticate);

/**
 * @swagger
 * /api/v1/certificates/my-certificates:
 *   get:
 *     summary: Get current user's certificates
 *     tags: [Certificates]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of certificates
 */
// Member routes
router.get("/my-certificates", handlers.getMyCertificates);

/**
 * @swagger
 * /api/v1/certificates/{id}:
 *   get:
 *     summary: Get certificate by ID
 *     tags: [Certificates]
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
 *         description: Certificate details
 *       404:
 *         description: Certificate not found
 *   put:
 *     summary: Update a certificate
 *     tags: [Certificates]
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
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Certificate updated
 *   delete:
 *     summary: Delete a certificate
 *     tags: [Certificates]
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
 *         description: Certificate deleted
 */
router.get("/:id", handlers.getCertificate);

// Admin routes
router.use(authorize(Visitors.hasProfile("ADMIN")));

/**
 * @swagger
 * /api/v1/certificates:
 *   get:
 *     summary: Get all certificates (Admin)
 *     tags: [Certificates]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all certificates
 *   post:
 *     summary: Issue a new certificate
 *     tags: [Certificates]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - type
 *               - title
 *             properties:
 *               recipientId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [EVENT_PARTICIPATION, PROGRAM_COMPLETION, HONORARY, MEMBERSHIP, VOLUNTEER_APPRECIATION]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               issueDate:
 *                 type: string
 *                 format: date-time
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               fileUrl:
 *                 type: string
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               programId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Certificate issued
 */
router.post("/", handlers.issueCertificate);
router.get("/", handlers.getCertificates);
router.put("/:id", handlers.updateCertificate);
router.delete("/:id", handlers.deleteCertificate);

export default router;
