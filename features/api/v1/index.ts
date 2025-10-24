import { Router } from "express";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import eventsRouter from "./events";
import membersRouter from "./members";
import chaptersRouter from "./chapters";
import committeesRouter from "./committees";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/members", membersRouter);
apiRouter.use("/chapters", chaptersRouter);
apiRouter.use("/committees", committeesRouter);

export default apiRouter;
