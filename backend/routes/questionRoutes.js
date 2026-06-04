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
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getQuestions);
router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createQuestion);
router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getQuestion);
router.put("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateQuestion);
router.patch("/:id/status", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateQuestionStatus);
router.delete("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), deleteQuestion);

module.exports = router;
