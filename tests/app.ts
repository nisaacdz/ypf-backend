import express, { Express } from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "@/shared/middlewares/errorHandler";
import { filter } from "@/shared/middlewares";
import apiRouter from "@/features/api/v1";

let app: Express | null = null;

export async function createTestApp(): Promise<Express> {
  if (app) return app;

  app = express();

  app.use((req, res, next) => {
    filter(req, next);
  });
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/v1", apiRouter);

  app.use(errorHandler);

  app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  return app;
}

export function getTestApp(): Express {
  if (!app) {
    throw new Error("Test app not initialized. Call createTestApp() first.");
  }
  return app;
}
