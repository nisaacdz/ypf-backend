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

// Content-Security-Policy: tight allow-list of script + frame origins. We
// only need our own assets, ImageKit (CDN), Azure Blob (raw media URLs in
// admin tools), Paystack (checkout iframe + JS callback), and Sentry (error
// ingest endpoint). Inline scripts are allowed for the swagger UI page;
// anything outside this list is blocked by the browser.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.paystack.co"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://ik.imagekit.io",
          "https://*.blob.core.windows.net",
        ],
        connectSrc: [
          "'self'",
          "https://api.paystack.co",
          "https://sms.arkesel.com",
          "https://*.ingest.sentry.io",
        ],
        frameSrc: ["https://checkout.paystack.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", "https://checkout.paystack.com"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

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

// Cheap liveness probe — every container orchestrator's default check.
// Just confirms the process is up and the Express loop is responsive.
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
  });
});

// Deep readiness probe — pings each external dependency so an alerting
// monitor can distinguish "process alive" from "process useless". Each
// check has its own short timeout so a slow vendor can't hang the route.
// Returns 200 only when every dep is OK; 503 when any check fails so
// uptime monitors flip red immediately.
app.get("/healthz", async (req, res) => {
  const { runReadinessChecks } = await import("@/shared/services/healthService");
  const result = await runReadinessChecks();
  res.status(result.ok ? 200 : 503).json({
    success: result.ok,
    data: result,
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
