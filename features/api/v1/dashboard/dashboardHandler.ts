import { ApiResponse } from "@/shared/types";
import * as dashboardService from "@/shared/services/dashboardService";
import { DashboardStats, DashboardActivity } from "./dtos";

export async function getStats(): Promise<ApiResponse<DashboardStats>> {
  const data = await dashboardService.getStats();

  return {
    success: true,
    message: "Dashboard stats fetched successfully",
    data,
  };
}

export async function getActivity(): Promise<ApiResponse<DashboardActivity>> {
  const data = await dashboardService.getRecentActivity();

  return {
    success: true,
    message: "Recent activity fetched successfully",
    data,
  };
}
