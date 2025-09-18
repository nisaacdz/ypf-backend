import { Router } from "express";
import * as loginController from "./auth.controller";

const authRoutes = Router();

// Define the login route
authRoutes.post("/login", loginController.naiveLogin);

export default authRoutes;
