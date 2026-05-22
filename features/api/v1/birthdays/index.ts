import { Router, Request, Response, NextFunction } from "express";
import z from "zod";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { validateParams, validateQuery } from "@/shared/middlewares/validate";
import {
  fetchBirthdayDetail,
  fetchUpcomingBirthdays,
} from "@/shared/services/birthdayService";
import {
  canAccessCommitteeLive,
  getCommitteeByAlias,
  GRAPHICS_ALIAS,
  isSystemAdmin,
} from "@/shared/services/workspaceAccessService";
import { ApiError } from "@/shared/types";

const birthdaysRouter = Router();

/**
 * Auth predicate: any system admin, OR a current Graphics chair / member.
 * The Graphics team owns the birthday-card workflow; admins also need
 * access for oversight.
 */
async function canAccessBirthdays(req: Request): Promise<boolean> {
  if (!req.User) return false;
  if (isSystemAdmin(req.User)) return true;
  const committee = await getCommitteeByAlias(GRAPHICS_ALIAS);
  if (!committee) return false;
  return canAccessCommitteeLive(req.User, committee.id);
}

birthdaysRouter.get(
  "/upcoming",
  authenticate,
  authorize(canAccessBirthdays),
  validateQuery(
    z.object({
      daysAhead: z.coerce.number().int().min(1).max(180).default(30),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await fetchUpcomingBirthdays(req.Query.daysAhead);
      res.status(200).json({
        success: true,
        message: "Upcoming birthdays fetched",
        data: items,
      });
    } catch (err) {
      next(err);
    }
  },
);

birthdaysRouter.get(
  "/:id",
  authenticate,
  authorize(canAccessBirthdays),
  validateParams(z.object({ id: z.uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await fetchBirthdayDetail(req.Params.id);
      if (!detail) {
        throw new ApiError("Person not found or has no date of birth", 404);
      }
      res.status(200).json({
        success: true,
        message: "Birthday detail fetched",
        data: detail,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default birthdaysRouter;
