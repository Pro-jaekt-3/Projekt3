const express = require("express");
const router = express.Router();

const {
  startAttempt,
  submitAttempt,
  gradeAnswer,
  getAttempt,
} = require("../controllers/assessmentAttemptController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { requireEnrollment } = require("../middleware/scopeMiddleware");

// ADMIN je umaknjen z vseh poti (matrika vlog, handoff_dev2_dev3): reševanje je
// participant workflow, ocenjevanje/pregled pa instructor workflow — dostop do
// tujih poskusov dodatno omejuje canAccessAttempt/isTrainingOwner v controllerju.
router.post(
  "/start",
  firebaseAuthMiddleware,
  requireRole("INSTRUCTOR", "PARTICIPANT"),
  requireEnrollment,
  startAttempt
);
router.patch(
  "/:attemptId/answers/:answerId/grade",
  firebaseAuthMiddleware,
  requireRole("INSTRUCTOR"),
  gradeAnswer
);
router.post(
  "/:id/submit",
  firebaseAuthMiddleware,
  requireRole("INSTRUCTOR", "PARTICIPANT"),
  submitAttempt
);
router.get(
  "/:id",
  firebaseAuthMiddleware,
  requireRole("INSTRUCTOR", "PARTICIPANT"),
  getAttempt
);

module.exports = router;
