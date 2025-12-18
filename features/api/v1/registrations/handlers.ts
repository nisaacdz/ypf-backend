import { Request, Response, NextFunction } from "express";
import * as registrationsService from "@/shared/services/registrationsService";
import { createRegistrationSchema, updateRegistrationStatusSchema } from "./schema";
import { ApiResponse } from "@/shared/types";

export async function createRegistration(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createRegistrationSchema.parse(req.body);
    const registration = await registrationsService.createRegistration(input);
    
    const response: ApiResponse<typeof registration> = {
      success: true,
      message: "Registration submitted successfully",
      data: registration,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

export async function getRegistrations(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;
    
    const result = await registrationsService.getRegistrations({ page, pageSize, status, search });
    
    const response: ApiResponse<typeof result> = {
      success: true,
      message: "Registrations fetched successfully",
      data: result,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getRegistrationById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const registration = await registrationsService.getRegistrationById(id);
    
    const response: ApiResponse<typeof registration> = {
      success: true,
      message: "Registration details fetched successfully",
      data: registration,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function updateRegistrationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = updateRegistrationStatusSchema.parse(req.body);
    // Assuming user is attached to req by auth middleware
    const adminId = (req as any).user?.id; 
    
    const updated = await registrationsService.updateRegistrationStatus(id, input, adminId);
    
    const response: ApiResponse<typeof updated> = {
      success: true,
      message: `Registration ${input.status} successfully`,
      data: updated,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getRegistrationStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await registrationsService.getRegistrationStats();
    
    const response: ApiResponse<typeof stats> = {
      success: true,
      message: "Registration statistics fetched successfully",
      data: stats,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}
