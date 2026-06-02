const express = require("express");

const { getAuthenticatedUser } = require("../controllers/authController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");

const router = express.Router();

router.get("/me", firebaseAuthMiddleware, getAuthenticatedUser);

module.exports = router;
