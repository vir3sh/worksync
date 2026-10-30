import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const authenticateUser = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    if (!process.env.ACCESS_TOKEN_SECRET) {
      throw new Error("ACCESS_TOKEN_SECRET is not configured");
    }

    let decoded;

    try {
      decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token. Please log in again.",
      });
    }

    if (!decoded.userId || typeof decoded.userId !== "string") {
      return res.status(401).json({
        success: false,
        message: "Invalid access token.",
      });
    }

    const user = await User.findById(decoded.userId).select(
      "_id name email role status canCreateWorkspace",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    // Make the authenticated user available to the next handler.
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

export default authenticateUser;
