import { Router } from "express";
import * as handlers from "./handlers";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Registrations
 *   description: User registration management
 */

/**
 * @swagger
 * /api/v1/registrations:
 *   post:
 *     summary: Submit a new registration
 *     tags: [Registrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - country
 *               - membershipStatus
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               whatsappNumber:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *               occupation:
 *                 type: string
 *               country:
 *                 type: string
 *               region:
 *                 type: string
 *               city:
 *                 type: string
 *               chapterId:
 *                 type: string
 *                 format: uuid
 *               campus:
 *                 type: string
 *               nationalIdNumber:
 *                 type: string
 *               passportPhotoId:
 *                 type: string
 *                 format: uuid
 *               ghanaCardFrontId:
 *                 type: string
 *                 format: uuid
 *               ghanaCardBackId:
 *                 type: string
 *                 format: uuid
 *               membershipStatus:
 *                 type: string
 *                 enum: [executive, general, honorary, new]
 *               missionPillars:
 *                 type: array
 *                 items:
 *                   type: string
 *               referralSource:
 *                 type: string
 *               referralOther:
 *                 type: string
 *               commitmentStatement:
 *                 type: string
 *               willingToServe:
 *                 type: string
 *                 enum: [yes, maybe, no]
 *               preferredRole:
 *                 type: string
 *               emergencyContactName:
 *                 type: string
 *               emergencyContactPhone:
 *                 type: string
 *               emergencyContactRelationship:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               previousVolunteerExperience:
 *                 type: string
 *               linkedinProfile:
 *                 type: string
 *               twitterHandle:
 *                 type: string
 *               agreeToTerms:
 *                 type: boolean
 *               agreeToPrivacy:
 *                 type: boolean
 *               declarationConsent:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Registration submitted successfully
 */
// Public routes
router.post("/", handlers.createRegistration);

/**
 * @swagger
 * /api/v1/registrations:
 *   get:
 *     summary: Get all registrations (Admin)
 *     tags: [Registrations]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of registrations
 */
// Protected routes (Admin only)
router.get("/", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.getRegistrations);

/**
 * @swagger
 * /api/v1/registrations/stats:
 *   get:
 *     summary: Get registration statistics (Admin)
 *     tags: [Registrations]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Registration statistics
 */
router.get("/stats", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.getRegistrationStats);

/**
 * @swagger
 * /api/v1/registrations/{id}:
 *   get:
 *     summary: Get registration by ID (Admin)
 *     tags: [Registrations]
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
 *         description: Registration details
 *       404:
 *         description: Registration not found
 */
router.get("/:id", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.getRegistrationById);

/**
 * @swagger
 * /api/v1/registrations/{id}/status:
 *   put:
 *     summary: Update registration status (Admin)
 *     tags: [Registrations]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, declined]
 *               declinedReason:
 *                 type: string
 *               assignedRole:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registration status updated
 */
router.put("/:id/status", authenticate, authorize(Visitors.hasProfile("ADMIN")), handlers.updateRegistrationStatus);

export default router;
