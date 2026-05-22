import { Router, Request, Response, NextFunction } from "express";
import * as systemService from "@/shared/services/systemService";

/**
 * Public maintenance-status endpoint. Returns ONLY `{ enabled, message }` —
 * deliberately excludes `since`, `updatedBy`, and any other operational
 * details that belong on the super-admin /system/maintenance route.
 *
 * Public on purpose: the login page reads this before authentication, and
 * the dashboard shows a one-time modal to non-super-admins. Exposing
 * "we are doing maintenance" is not sensitive — the banner message itself
 * is operator-authored.
 */
const maintenanceRouter = Router();

maintenanceRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [globalMode, committees] = await Promise.all([
        systemService.getMaintenanceMode(),
        systemService.listCommitteeMaintenance(),
      ]);
      res.status(200).json({
        success: true,
        data: {
          global: {
            enabled: globalMode.enabled,
            message: globalMode.message,
          },
          // Only enabled committees show up (presence in table = enabled).
          // Public payload deliberately omits actor / since / updated_at —
          // those belong on the admin-scoped /system route.
          committees: committees.map((c) => ({
            id: c.committeeId,
            name: c.committeeName,
            alias: c.committeeAlias,
            message: c.message,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default maintenanceRouter;
