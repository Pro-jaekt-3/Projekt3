const authMiddleware = (req, res, next) => {
  const userId = req.header("x-user-id");
  const email = req.header("x-user-email");
  const role = req.header("x-user-role");

  if (!userId || !role) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = {
    id: Number(userId),
    email: email || null,
    role,
  };

  next();
};

module.exports = {
  authMiddleware,
  authenticate: authMiddleware,
};
