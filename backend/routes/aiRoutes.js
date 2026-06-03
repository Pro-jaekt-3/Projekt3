const express = require("express");
const router = express.Router();

const {
  generateQuestionDraft,
  reviewAiInteraction,
} = require("../controllers/aiController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.post("/question-draft", generateQuestionDraft);
router.patch(
  "/interactions/:id/review",
  authenticate,
  requireRole("ADMIN", "INSTRUCTOR"),
  reviewAiInteraction
);

module.exports = router;
