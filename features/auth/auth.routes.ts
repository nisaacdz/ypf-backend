import { Router } from "express";
import * as loginController from "./auth.controller";

const router = Router();

// Define the login route
router.post("/auth/login", loginController.naiveLogin);

export default router;
