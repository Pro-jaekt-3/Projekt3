const express = require("express");
const router = express.Router();

const {
  generateQuestionDraft,
  suggestQuestionEquivalence,
  reviewAiInteraction,
  listAiInteractions,
  getPrePostInsights,
} = require("../controllers/aiController");
const {
  listAiModels,
  createAiModel,
  updateAiModel,
  deleteAiModel,
  testAiModel,
  getOllamaStatus,
} = require("../controllers/aiModelController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

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

// AI models management (read for ADMIN+INSTRUCTOR, mutations ADMIN only).
router.get(
  "/models",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  listAiModels
);
router.post("/models", firebaseAuthMiddleware, requireRole("ADMIN"), createAiModel);
router.patch("/models/:id", firebaseAuthMiddleware, requireRole("ADMIN"), updateAiModel);
router.delete("/models/:id", firebaseAuthMiddleware, requireRole("ADMIN"), deleteAiModel);
router.post(
  "/models/:id/test",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  testAiModel
);

// Ollama runtime status.
router.get(
  "/ollama/status",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  getOllamaStatus
);

// AI interactions review queue.
router.get(
  "/interactions",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  listAiInteractions
);
router.patch(
  "/interactions/:id/review",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  reviewAiInteraction
);

// Advisory pre/post insights (numbers + optional Ollama narrative).
router.get(
  "/pre-post-insights",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  getPrePostInsights
);
router.post(
  "/pre-post-insights",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  getPrePostInsights
);

module.exports = router;
