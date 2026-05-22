import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { validateBody, validateParams } from "@/shared/middlewares/validate";
import { Visitors, ADMIN, MEMBER, anyOf } from "@/configs/authorizer";
import z from "zod";

const certificatesRouter = Router();

certificatesRouter.get(
  "/my",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { getMyCertificates } = await import(
        "@/shared/services/certificateService"
      );
      const certificates = await getMyCertificates(req.User!.constituentId);
      res.status(200).json({
        success: true,
        message: "My certificates",
        data: certificates,
      });
    } catch (error) {
      next(error);
    }
  },
);

certificatesRouter.get(
  "/:id",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  validateParams(z.object({ id: z.uuid("Invalid certificate ID") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { getCertificateById } = await import(
        "@/shared/services/certificateService"
      );
      const certificate = await getCertificateById(req.Params.id);
      res.status(200).json({
        success: true,
        data: certificate,
      });
    } catch (error) {
      next(error);
    }
  },
);

const IssueCertificateSchema = z.object({
  constituentId: z.string().uuid(),
  title: z.string().min(1),
  programName: z.string().min(1),
  projectId: z.string().uuid().optional(),
  type: z.enum(["COMPLETION", "PARTICIPATION", "ACHIEVEMENT", "LEADERSHIP"]).optional(),
  description: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

certificatesRouter.post(
  "/",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT),
    ),
  ),
  validateBody(IssueCertificateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { issueCertificate } = await import(
        "@/shared/services/certificateService"
      );
      const id = await issueCertificate({
        ...req.Body,
        issuedBy: req.User!.constituentId,
      });
      res.status(201).json({
        success: true,
        message: "Certificate issued",
        data: { id },
      });
    } catch (error) {
      next(error);
    }
  },
);

certificatesRouter.patch(
  "/:id/revoke",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.PRESIDENT),
    ),
  ),
  validateParams(z.object({ id: z.uuid("Invalid certificate ID") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { revokeCertificate } = await import(
        "@/shared/services/certificateService"
      );
      await revokeCertificate(req.Params.id);
      res.status(200).json({
        success: true,
        message: "Certificate revoked",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default certificatesRouter;
