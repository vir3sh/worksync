import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import RefreshSession from "../models/refresh-session.model.js";

import User from "../models/user.model.js";
import transporter from "../config/email.js";
import {
  createUserValidation,
  loginUserValidation,
} from "../schema/user.schema.js";

const accessTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 60 * 60 * 1000,
};

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const hashRefreshToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const createRefreshSession = async (userId, refreshToken) => {
  const decoded = jwt.decode(refreshToken);

  if (!decoded?.exp) {
    throw new Error("Refresh token expiration is missing");
  }

  await RefreshSession.create({
    user: userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(decoded.exp * 1000),
  });
};

export const createUser = async (req, res, next) => {
  try {
    const validation = createUserValidation.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { name, email, password } = validation.data;

    if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      throw new Error("JWT secrets are not configured");
    }

    const existingUser = await User.exists({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await argon2.hash(password);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "employee",
    });

    // Create a short-lived access token.
    const accessToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" },
    );

    // Create a longer-lived refresh token.
    const refreshToken = jwt.sign(
      { userId: user._id.toString(), type: "refresh" },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
        jwtid: crypto.randomUUID(),
      },
    );

    // Set tokens in HTTP-only cookies.
    await createRefreshSession(user._id, refreshToken);

    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    // Send welcome email after registration.
    // Send welcome email without blocking the response.
    transporter
      .sendMail({
        from: `"WorkSync" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "Welcome to WorkSync!",
        text: `Hi ${user.name},

Welcome to WorkSync!

Your account has been created successfully.
You can now start organizing your projects and tasks.

Thanks,
The WorkSync Team`,
      })
      .then(() => {
        console.log("Welcome email sent successfully");
      })
      .catch((emailError) => {
        console.error("Welcome email failed:", emailError.message);
      });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const validation = loginUserValidation.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { email, password } = validation.data;

    // 2. Check JWT configuration
    if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      throw new Error("JWT secrets are not configured");
    }

    // 3. Find user and explicitly retrieve password hash
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 4. Check account status
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // 5. Verify password
    const isPasswordValid = await argon2.verify(user.password, password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 6. Generate access token
    const accessToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "60m",
      },
    );

    // 7. Generate refresh token
    const refreshToken = jwt.sign(
      {
        userId: user._id.toString(),
        type: "refresh",
      },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
        jwtid: crypto.randomUUID(),
      },
    );

    // 8. Set HTTP-only cookies
    await createRefreshSession(user._id, refreshToken);
    res.cookie("accessToken", accessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

    // 9. Send response only after setting cookies
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshUser = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token missing. Please log in again.",
      });
    }

    if (!process.env.REFRESH_TOKEN_SECRET || !process.env.ACCESS_TOKEN_SECRET) {
      throw new Error("JWT secrets are not configured");
    }

    // Verify the refresh token's signature and expiration.
    let decoded;

    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, {
        algorithms: ["HS256"],
      });
    } catch {
      res.clearCookie("accessToken", accessTokenCookieOptions);
      res.clearCookie("refreshToken", refreshTokenCookieOptions);

      return res.status(401).json({
        success: false,
        message: "Refresh token is invalid or expired. Please log in again.",
      });
    }

    if (
      !decoded.userId ||
      decoded.type !== "refresh" ||
      typeof decoded.userId !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token.",
      });
    }

    // Find the matching, active refresh session.
    const tokenHash = hashRefreshToken(refreshToken);

    const session = await RefreshSession.findOne({
      tokenHash,
      user: decoded.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      res.clearCookie("accessToken", accessTokenCookieOptions);
      res.clearCookie("refreshToken", refreshTokenCookieOptions);

      return res.status(401).json({
        success: false,
        message: "Refresh session is invalid or revoked. Please log in again.",
      });
    }

    const user = await User.findById(decoded.userId).select(
      "_id name email role status",
    );

    if (!user || user.status !== "active") {
      await RefreshSession.updateOne(
        { _id: session._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );

      res.clearCookie("accessToken", accessTokenCookieOptions);
      res.clearCookie("refreshToken", refreshTokenCookieOptions);

      return res.status(401).json({
        success: false,
        message: "User account is unavailable. Please log in again.",
      });
    }

    // Generate replacement tokens.
    const newAccessToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
        jwtid: crypto.randomUUID(),
      },
    );

    const newRefreshToken = jwt.sign(
      { userId: user._id.toString(), type: "refresh" },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" },
    );

    // Atomically revoke the old session before issuing its replacement.
    const revokedSession = await RefreshSession.findOneAndUpdate(
      {
        _id: session._id,
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { revokedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!revokedSession) {
      res.clearCookie("accessToken", accessTokenCookieOptions);
      res.clearCookie("refreshToken", refreshTokenCookieOptions);

      return res.status(401).json({
        success: false,
        message: "Refresh token has already been used. Please log in again.",
      });
    }

    await createRefreshSession(user._id, newRefreshToken);

    res.cookie("accessToken", newAccessToken, accessTokenCookieOptions);
    res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);

    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    const clearCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    };

    // Clear both authentication cookies.
    res.clearCookie("accessToken", clearCookieOptions);
    res.clearCookie("refreshToken", clearCookieOptions);

    // Revoke the refresh session in MongoDB.
    if (refreshToken) {
      await RefreshSession.findOneAndUpdate(
        {
          tokenHash: hashRefreshToken(refreshToken),
          revokedAt: null,
        },
        {
          $set: { revokedAt: new Date() },
        },
      );
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    },
  });
};
