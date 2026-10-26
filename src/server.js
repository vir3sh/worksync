import express from "express";
import connectDb from "./config/db.js";
import dotenv from "dotenv";
dotenv.config();
const app = express();
connectDb();
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
