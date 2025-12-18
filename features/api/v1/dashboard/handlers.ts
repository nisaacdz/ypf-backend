import { Request, Response, NextFunction } from "express";
import { DashboardService } from "@/shared/services/dashboardService";

export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await DashboardService.getStats();
    res.status(200).json({
      status: "success",
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

export const getActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const activity = await DashboardService.getRecentActivity();
    res.status(200).json({
      status: "success",
      data: { activity },
    });
  } catch (error) {
    next(error);
  }
};
