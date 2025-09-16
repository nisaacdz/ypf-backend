import express, { Express, Request, Response, NextFunction } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import { initializeChat } from "./features/chat/chat.socket";
import { errorHandler } from "./shared/middleware/errorHandler";
import envConfig from "./configs/env";
import bouncer from "./shared/middleware/bouncer";
import authRoutes from "./features/auth/auth.routes";

const app: Express = express();

app.use(helmet());

const corsOptions = {
  origin: envConfig.clientUrl,
  optionsSuccessStatus: 200,
  credentials: true,
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  bouncer(req, next);
});
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/auth", authRoutes);

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: envConfig.clientUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use((socket, next) => bouncer(socket.handshake, next));

initializeChat(io);

app.use(errorHandler);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

server.listen(envConfig.port, () => {
  console.log(`Server is running on port ${envConfig.port}`);
});

export { app, io };
