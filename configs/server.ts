import express, { Express } from "express";
import http from "http";
import path from "path";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "@/shared/middlewares/errorHandler";
import variables from "@/configs/env";
// import { filter } from "@/shared/middlewares";
import apiRouter from "@/features/api/v1";
import { swaggerSpec } from "@/configs/docs";
import { rateLimit } from "@/shared/middlewares/rateLimit";
import { Server as SocketIOServer } from "socket.io";
import ws from "./ws";
import { registerNotificationNamespace } from "@/features/notifications";
import registerChatNamespace from "@/features/chat/v1";
import { socketAuth } from "@/shared/middlewares/socket";
import * as Sentry from "@sentry/node";

const app: Express = express();

// We sit behind one or more reverse proxies in every deployment target we
// care about (Vercel, Render, fly.io, Cloudflare, Nginx). Without trust proxy
// set, Express reports `req.ip` as the proxy's IP — which means every
// rate-limited endpoint treats the entire internet as a single IP. Enable in
// production only; in dev we want the literal localhost address.
if (variables.app.isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmet());

app.use(
  cors({
    origin: variables.security.allowedOrigins,
    optionsSuccessStatus: 200,
    credentials: true,
  }),
);

// app.use((req, res, next) => {
//   filter(req, next);
// });
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 99 }));

// Serve static files and developer homepage
app.use(express.static(path.join(process.cwd(), "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "home.html"));
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
  });
});

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

// Sentry must intercept errors BEFORE our errorHandler turns them into
// well-formed responses. setupExpressErrorHandler also attaches a fall-back
// 500 handler internally; our own errorHandler runs after and shapes the
// JSON body. A no-op when Sentry isn't initialised.
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Resource not found" });
});

export default server;
