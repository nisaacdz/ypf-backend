import express, { Express } from "express";
import http from "http";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "@/shared/middlewares/errorHandler";
import variables from "@/configs/env";
import { filter } from "./shared/middlewares";
import emailer from "@/configs/emailer";
import pgPool from "./configs/db";
import apiRouter from "@/features/api/v1";
import logger from "@/configs/logger";
import { swaggerSpec } from "@/configs/swagger";
import { rateLimit } from "./shared/middlewares/rateLimit";

const app: Express = express();

app.use(helmet());

app.use(
  cors({
    origin: variables.security.allowedOrigins,
    optionsSuccessStatus: 200,
    credentials: true,
  }),
);
app.use();

app.use((req, res, next) => {
  filter(req, next);
});
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 99 }));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/v1", apiRouter);

const server = http.createServer(app);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Resource not found" });
});

(async () => {
  await Promise.all([emailer.initialize(), pgPool.initialize()]);

  server.listen(variables.app.port, () => {
    logger.info(
      `Server is live on http://${variables.app.host}:${variables.app.port}`,
    );
  });
})();
