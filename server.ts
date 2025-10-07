import express, { Express, Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
//import { initializeChat } from "@/features/chat/v1";
import { errorHandler } from "@/shared/middlewares/errorHandler";
import variables from "@/configs/env";
import { filter } from "./shared/middlewares";
import authorizer from "@/configs/authorizer";
import emailer from "@/configs/emailer";
import pgPool from "./configs/db";
import apiRouter from "@/features/api/v1";

const app: Express = express();

app.use(helmet());

const corsOptions = {
  origin: variables.allowedOrigins,
  optionsSuccessStatus: 200,
  credentials: true,
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  filter(req, next);
});
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", apiRouter);

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: variables.allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use((socket, next) => filter(socket.handshake, next));

//initializeChat(io);

app.use(errorHandler);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

(async () => {
  await Promise.all([
    emailer.initialize(),
    authorizer.initialize(),
    pgPool.initialize(),
  ]);
  // we'll add other async initializations here

  server.listen(variables.port, () => {
    console.log(`Server is running on port ${variables.port}`);
  });
})();

// export { app, io };
