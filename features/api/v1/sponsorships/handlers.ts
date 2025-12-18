import { Request, Response, NextFunction } from "express";
import { SponsorshipsService } from "@/shared/services/sponsorshipsService";
import { createSponsorshipSchema, updateSponsorshipSchema } from "./schema";
import { ApiError } from "@/shared/types";

export const createSponsorship = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = createSponsorshipSchema.parse(req.body);
    const sponsorship = await SponsorshipsService.createSponsorship({
      ...data,
      partnershipType: "SPONSOR",
    });
    res.status(201).json({
      status: "success",
      data: { sponsorship },
    });
  } catch (error) {
    next(error);
  }
};

export const getSponsorships = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sponsorships = await SponsorshipsService.getSponsorships();
    res.status(200).json({
      status: "success",
      data: { sponsorships },
    });
  } catch (error) {
    next(error);
  }
};

export const getSponsorship = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sponsorship = await SponsorshipsService.getSponsorshipById(req.params.id);
    if (!sponsorship) {
      throw new ApiError("Sponsorship not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: { sponsorship },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSponsorship = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = updateSponsorshipSchema.parse(req.body);
    const sponsorship = await SponsorshipsService.updateSponsorship(req.params.id, data);
    if (!sponsorship) {
      throw new ApiError("Sponsorship not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: { sponsorship },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSponsorship = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sponsorship = await SponsorshipsService.deleteSponsorship(req.params.id);
    if (!sponsorship) {
      throw new ApiError("Sponsorship not found", 404);
    }
    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
