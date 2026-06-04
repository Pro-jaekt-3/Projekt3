const express = require("express");
const router = express.Router();

const { startAttempt, submitAttempt, getAttempt } = require("../controllers/assessmentAttemptController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.post("/start", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), startAttempt);
router.post("/:id/submit", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), submitAttempt);
router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), getAttempt);

module.exports = router;
