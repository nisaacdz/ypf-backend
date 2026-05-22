import { Request, Response, NextFunction, Router } from "express";
import fs from "fs/promises";
import path from "path";

import { authenticate } from "@/shared/middlewares/auth";
import { ApiError } from "@/shared/types";
import {
  isLocalDocumentExternalId,
  resolveLocalDocumentPath,
} from "@/shared/utils/files";

const filesRouter = Router();

filesRouter.get(
  "/documents/:externalId",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const externalId = req.params.externalId;
      if (!isLocalDocumentExternalId(externalId)) {
        throw new ApiError("Document not found", 404);
      }

      const filePath = resolveLocalDocumentPath(externalId);
      try {
        await fs.access(filePath);
      } catch {
        throw new ApiError("Document not found", 404);
      }

      const fileName = path.basename(filePath);

      if (req.query.download === "1") {
        res.download(filePath, fileName);
        return;
      }

      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  },
);

export default filesRouter;
