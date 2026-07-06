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
const { requireOwnership } = require("../middleware/scopeMiddleware");

// ADMIN is not a content collaborator — INSTRUCTOR only (matrika vlog, handoff_dev2_dev3).
// GET / and POST / are scoped in the controller (scopedListWhere / isTrainingOwner).
router.get("/", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getQuestions);
router.post("/", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), createQuestion);
router.get("/:id", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("question"), getQuestion);
router.put("/:id", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("question"), updateQuestion);
router.patch("/:id/status", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("question"), updateQuestionStatus);
router.delete("/:id", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("question"), deleteQuestion);

module.exports = router;
