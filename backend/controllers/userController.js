const prisma = require("../prisma/client");

const VALID_ROLES = ["ADMIN", "INSTRUCTOR", "PARTICIPANT"];

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  firebaseUid: true,
};

const parsePositiveIntegerId = (value) => {
  const parsedId = Number(value);
  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
};

const listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { email: "asc" },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role is required and must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent an admin from demoting their own account (avoid locking out admin access).
    if (req.user.id === id && role !== "ADMIN") {
      return res.status(403).json({
        error: "You cannot change your own role away from ADMIN.",
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: USER_SELECT,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listUsers,
  updateUserRole,
};
