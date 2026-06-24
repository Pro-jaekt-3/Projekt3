const express = require("express");

const router = express.Router();

const { listUsers, updateUserRole } = require("../controllers/userController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN"), listUsers);

router.patch("/:id/role", firebaseAuthMiddleware, requireRole("ADMIN"), updateUserRole);

module.exports = router;
