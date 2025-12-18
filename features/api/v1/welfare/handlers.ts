import { Request, Response, NextFunction } from "express";
import { WelfareService } from "@/shared/services/welfareService";
import { createWelfareCaseSchema, updateWelfareCaseSchema, assignWelfareCaseSchema } from "./schema";
import { ApiError } from "@/shared/types";

export const createCase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = createWelfareCaseSchema.parse(req.body);
    if (!req.User?.id) {
      throw new ApiError("User not authenticated", 401);
    }
    const welfareCase = await WelfareService.createCase({
      ...data,
      memberId: req.User.id,
    });
    res.status(201).json({
      status: "success",
      data: { welfareCase },
    });
  } catch (error) {
    next(error);
  }
};

export const getCases = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, type } = req.query;
    // If user is not admin/welfare committee, only show their own cases
    // Assuming we have a way to check roles, for now let's assume admins can see all
    // and members can see theirs.
    // But the service supports filtering.
    
    let memberId = undefined;
    // TODO: Add role check logic here. For now, if not admin, filter by memberId
    // This requires checking req.User.roles or profiles.
    // Let's assume if they are just a MEMBER, they see only theirs.
    const isAdmin = req.User?.profiles.includes("ADMIN"); // Simplified check
    if (!isAdmin) {
      memberId = req.User?.id;
    }

    const cases = await WelfareService.getCases({
      status: status as string,
      type: type as string,
      memberId,
    });
    res.status(200).json({
      status: "success",
      data: { cases },
    });
  } catch (error) {
    next(error);
  }
};

export const getCase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const welfareCase = await WelfareService.getCaseById(req.params.id);
    if (!welfareCase) {
      throw new ApiError("Case not found", 404);
    }
    
    // Access control
    const isAdmin = req.User?.profiles.includes("ADMIN");
    if (!isAdmin && welfareCase.memberId !== req.User?.id) {
      throw new ApiError("Unauthorized", 403);
    }

    res.status(200).json({
      status: "success",
      data: { welfareCase },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = updateWelfareCaseSchema.parse(req.body);
    const welfareCase = await WelfareService.updateCase(req.params.id, {
      ...data,
      resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined,
    });
    if (!welfareCase) {
      throw new ApiError("Case not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: { welfareCase },
    });
  } catch (error) {
    next(error);
  }
};

export const assignCase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { assigneeId } = assignWelfareCaseSchema.parse(req.body);
    const welfareCase = await WelfareService.assignCase(req.params.id, assigneeId);
    if (!welfareCase) {
      throw new ApiError("Case not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: { welfareCase },
    });
  } catch (error) {
    next(error);
  }
};
