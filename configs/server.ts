import express, { Express } from "express";
import http from "http";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "@/shared/middlewares/errorHandler";
import variables from "@/configs/env";
import { filter } from "@/shared/middlewares";
import apiRouter from "@/features/api/v1";
import { swaggerSpec } from "@/configs/docs";
import { rateLimit } from "@/shared/middlewares/rateLimit";
import { Server as SocketIOServer } from "socket.io";
import ws from "./ws";
import { registerNotificationNamespace } from "@/features/notifications";
import registerChatNamespace from "@/features/chat/v1";
import { socketAuth } from "@/shared/middlewares/socket";

const app: Express = express();

app.use(helmet());

app.use(
  cors({
    origin: variables.security.allowedOrigins,
    optionsSuccessStatus: 200,
    credentials: true,
  }),
);

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

const io = new SocketIOServer(server, {
  cors: {
    origin: variables.security.allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.engine.use(cookieParser());
io.engine.use(socketAuth);

registerNotificationNamespace(io);
registerChatNamespace(io);

ws.initialize(io);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Resource not found" });
});

export default server;
