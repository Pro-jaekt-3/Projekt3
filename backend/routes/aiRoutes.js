const express = require("express");
const router = express.Router();

const {
  generateQuestionDraft,
  suggestQuestionEquivalence,
  reviewAiInteraction,
  getAiModels,
} = require("../controllers/aiController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get(
  "/models",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  getAiModels
);
router.post(
  "/question-draft",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  generateQuestionDraft
);
router.post(
  "/equivalence-suggestion",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  suggestQuestionEquivalence
);
router.patch(
  "/interactions/:id/review",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  reviewAiInteraction
);

module.exports = router;
