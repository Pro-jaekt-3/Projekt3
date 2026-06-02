const defaultDevUser = {
  id: "dev-user",
  email: "dev@example.com",
  role: "INSTRUCTOR",
};

const authMiddleware = (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== "production";

  req.user = {
    ...defaultDevUser,
  };

  if (isDevelopment) {
    req.user = {
      id: req.header("x-user-id") || defaultDevUser.id,
      email: req.header("x-user-email") || defaultDevUser.email,
      role: req.header("x-user-role") || defaultDevUser.role,
    };
  }

  next();
};

const requireRole = (...roles) => {
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  authenticate: authMiddleware,
  requireRole,
};
