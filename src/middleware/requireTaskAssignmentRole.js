export function requireTaskAssignmentRole(req, res, next) {
  const workspaceRole = req.workspaceMember?.role;

  if (!["owner", "admin", "manager"].includes(workspaceRole)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to assign tasks.",
    });
  }

  next();
}
