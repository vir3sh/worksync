import User from "../models/user.model.js";

export default async function requireSystemAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
      .select("+isSystemAdmin")
      .lean();

    if (!user || user.isSystemAdmin !== true) {
      return res.status(403).json({
        success: false,
        message: "System administrator access required",
      });
    }

    next();
  } catch (error) {
    console.error("System admin authorization error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify administrator permissions",
    });
  }
}
