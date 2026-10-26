import "dotenv/config";
import express from "express";
import connectDb from "./config/db.js";
import helmet from "helmet";
import UserRouter from "./routes/user.routes.js";
import cookieParser from "cookie-parser";
import workspaceRouter from "./routes/workspace.routes.js";
import projectRouter from "./routes/project.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import dashRouter from "./routes/dashboard.routes.js";
const app = express();

connectDb();
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use(express.json());
app.use(helmet());
app.use(cookieParser());

app.use("/api/users", UserRouter);
app.use("/api/workspaces", workspaceRouter);
app.use("/api/projects", projectRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/dashboard", dashRouter);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
