const express = require("express");
const router = express.Router();

const {
  generateQuestionDraft,
  suggestQuestionEquivalence,
  generatePrePostInsights,
  reviewAiInteraction,
  getAiModels,
  getOllamaStatus,
  testAiModel,
} = require("../controllers/aiController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get(
  "/models",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  getAiModels
);
router.get(
  "/ollama/status",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  getOllamaStatus
);
router.post(
  "/models/:id/test",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  testAiModel
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
router.post(
  "/pre-post-insights",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  generatePrePostInsights
);
router.patch(
  "/interactions/:id/review",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  reviewAiInteraction
);

module.exports = router;
