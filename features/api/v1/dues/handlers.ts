import { Request, Response, NextFunction } from "express";
import * as duesService from "@/shared/services/duesService";
import { createDuesSchema, updateDuesSchema, payDuesSchema } from "./schema";
import { ApiResponse } from "@/shared/types";

export async function createDues(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createDuesSchema.parse(req.body);
    const dues = await duesService.createDues(input);
    
    const response: ApiResponse<typeof dues> = {
      success: true,
      message: "Dues configuration created successfully",
      data: dues,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

export async function getDues(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const chapterId = req.query.chapterId as string;
    
    const result = await duesService.getDues({ page, pageSize, chapterId });
    
    const response: ApiResponse<typeof result> = {
      success: true,
      message: "Dues configurations fetched successfully",
      data: result,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getDuesById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const dues = await duesService.getDuesById(id);
    
    const response: ApiResponse<typeof dues> = {
      success: true,
      message: "Dues configuration fetched successfully",
      data: dues,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function updateDues(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const input = updateDuesSchema.parse(req.body);
    const updated = await duesService.updateDues(id, input);
    
    const response: ApiResponse<typeof updated> = {
      success: true,
      message: "Dues configuration updated successfully",
      data: updated,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function payDues(req: Request, res: Response, next: NextFunction) {
  try {
    const input = payDuesSchema.parse(req.body);
    const constituentId = (req as any).user?.id;
    
    const payment = await duesService.payDues(constituentId, input);
    
    const response: ApiResponse<typeof payment> = {
      success: true,
      message: "Dues payment processed successfully",
      data: payment,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

export async function getMyDuesHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const constituentId = (req as any).user?.id;
    const history = await duesService.getMemberDuesHistory(constituentId);
    
    const response: ApiResponse<typeof history> = {
      success: true,
      message: "Dues history fetched successfully",
      data: history,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
}
