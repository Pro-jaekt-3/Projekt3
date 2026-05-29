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
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.get("/", getQuestions);
router.post("/", createQuestion);
router.get("/:id", getQuestion);
router.put("/:id", updateQuestion);
router.patch("/:id/status", authenticate, requireRole("INSTRUCTOR", "ADMIN"), updateQuestionStatus);
router.delete("/:id", deleteQuestion);

module.exports = router;