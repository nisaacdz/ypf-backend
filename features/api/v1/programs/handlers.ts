import { Request, Response, NextFunction } from "express";
import * as programsService from "@/shared/services/programsService";
import { createProgramSchema, updateProgramSchema, enrollProgramSchema } from "./schema";
import { ApiResponse, ApiError } from "@/shared/types";

export async function createProgram(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createProgramSchema.parse(req.body);
    if (!req.User?.id) {
      throw new ApiError("User not authenticated", 401);
    }
    const createdBy = req.User.id;
    const program = await programsService.createProgram(input, createdBy);
    
    const response: ApiResponse<typeof program> = {
      success: true,
      message: "Program created successfully",
      data: program,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

export async function getPrograms(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const type = req.query.type as string;
    const status = req.query.status as string;
    
    const result = await programsService.getPrograms({ page, pageSize, type, status });
    
    const response: ApiResponse<typeof result> = {
      success: true,
      message: "Programs fetched successfully",
      data: result,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getProgramById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const program = await programsService.getProgramById(id);
    
    const response: ApiResponse<typeof program> = {
      success: true,
      message: "Program details fetched successfully",
      data: program,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function updateProgram(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = updateProgramSchema.parse(req.body);
    const updated = await programsService.updateProgram(id, input);
    
    const response: ApiResponse<typeof updated> = {
      success: true,
      message: "Program updated successfully",
      data: updated,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function deleteProgram(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await programsService.deleteProgram(id);
    
    const response: ApiResponse<null> = {
      success: true,
      message: "Program deleted successfully",
      data: null,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function enrollMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = enrollProgramSchema.parse(req.body);
    const enrollment = await programsService.enrollMember(id, input.memberId);
    
    const response: ApiResponse<typeof enrollment> = {
      success: true,
      message: "Member enrolled successfully",
      data: enrollment,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

export async function withdrawMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = enrollProgramSchema.parse(req.body);
    const withdrawn = await programsService.withdrawMember(id, input.memberId);
    
    const response: ApiResponse<typeof withdrawn> = {
      success: true,
      message: "Member withdrawn successfully",
      data: withdrawn,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}
