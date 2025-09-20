import { Router } from "express";
import authRouter from "./auth";
import usersRouter from "./users";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);

export default apiRouter;
