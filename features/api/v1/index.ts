import { Router } from "express";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import eventsRouter from "./events";
import constituentsRouter from "./constituents";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/constituents", constituentsRouter);

export default apiRouter;
