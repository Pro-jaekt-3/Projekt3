const express = require("express");
const router = express.Router();

const {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  updateQuestionStatus,
} = require("../controllers/questionController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get("/", getQuestions);
router.post("/", authenticate, requireRole("ADMIN", "INSTRUCTOR"), createQuestion);
router.get("/:id", getQuestion);
router.put("/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), updateQuestion);
router.patch("/:id/status", authenticate, requireRole("ADMIN", "INSTRUCTOR"), updateQuestionStatus);
router.delete("/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), deleteQuestion);

module.exports = router;
