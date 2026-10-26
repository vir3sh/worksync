import { Router } from "express";
import {
  createUser,
  loginUser,
  logoutUser,
  getMe,
  refreshUser,
} from "../controller/user.controller.js";
import authenticateUser from "../middleware/auth.middleware.js";

const UserRouter = Router();

UserRouter.post("/register", createUser);
UserRouter.post("/login", loginUser);
UserRouter.post("/logout", logoutUser);
UserRouter.post("/refresh", refreshUser);
UserRouter.get("/me", authenticateUser, getMe);
export default UserRouter;
