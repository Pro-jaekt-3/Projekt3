const express = require("express");
const router = express.Router();

const { startAttempt, submitAttempt, getAttempt } = require("../controllers/assessmentAttemptController");

router.post("/start", startAttempt);
router.post("/:id/submit", submitAttempt);
router.get("/:id", getAttempt);

module.exports = router;
