import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import UserRouter from "./routes/user.routes.js";
import workspaceRouter from "./routes/workspace.routes.js";
import projectRouter from "./routes/project.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import dashRouter from "./routes/dashboard.routes.js";

const app = express();

app.use(express.json());
app.use(helmet());
app.use(cookieParser());
const corsOption = {
  origin: process.env.CLIENT_URL,
  credentials: true,
};
app.use(cors(corsOption));
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use("/api/users", UserRouter);
app.use("/api/workspaces", workspaceRouter);
app.use("/api/projects", projectRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/dashboard", dashRouter);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
