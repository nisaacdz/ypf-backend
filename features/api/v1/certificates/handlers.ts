import { Request, Response, NextFunction } from "express";
import { CertificatesService } from "@/shared/services/certificatesService";
import { createCertificateSchema, updateCertificateSchema } from "./schema";
import { ApiError } from "@/shared/types";

export const issueCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = createCertificateSchema.parse(req.body);
    const certificate = await CertificatesService.issueCertificate({
      ...data,
      issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      issuedBy: req.User?.id,
    });
    res.status(201).json({
      status: "success",
      data: { certificate },
    });
  } catch (error) {
    next(error);
  }
};

export const getCertificates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const certificates = await CertificatesService.getAllCertificates();
    res.status(200).json({
      status: "success",
      data: { certificates },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyCertificates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.User?.id) {
      throw new ApiError("User not authenticated", 401);
    }
    const certificates = await CertificatesService.getMemberCertificates(req.User.id);
    res.status(200).json({
      status: "success",
      data: { certificates },
    });
  } catch (error) {
    next(error);
  }
};

export const getCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const certificate = await CertificatesService.getCertificateById(req.params.id);
    if (!certificate) {
      throw new ApiError("Certificate not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: { certificate },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = updateCertificateSchema.parse(req.body);
    const certificate = await CertificatesService.updateCertificate(req.params.id, {
      ...data,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
    });
    if (!certificate) {
      throw new ApiError("Certificate not found", 404);
    }
    res.status(200).json({
      status: "success",
      data: { certificate },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const certificate = await CertificatesService.deleteCertificate(req.params.id);
    if (!certificate) {
      throw new ApiError("Certificate not found", 404);
    }
    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
