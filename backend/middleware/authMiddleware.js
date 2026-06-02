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

const requireRole = () => {
  return (req, res, next) => {
    next();
  };
};

module.exports = {
  authMiddleware,
  authenticate: authMiddleware,
  requireRole,
};
