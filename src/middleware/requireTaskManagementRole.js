export const requireTaskManagementRole = (req, res, next) => {
  if (!["hr", "manager"].includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Only HR and managers can delete tasks.",
    });
  }

  next();
};