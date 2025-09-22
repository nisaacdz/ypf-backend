import { Router } from "express";
import authRouter from "./auth";
import usersRouter from "./users";
import eventsRouter from "./events";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/events", eventsRouter);

export default apiRouter;
