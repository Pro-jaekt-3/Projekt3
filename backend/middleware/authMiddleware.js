const authenticate = (req, res, next) => {
  const userId = Number(req.header("x-user-id"));
  const role = req.header("x-user-role");

  if (!userId || !role) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = {
    id: userId,
    role,
  };

  next();
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireRole,
};
