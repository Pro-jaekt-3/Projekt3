const express = require("express");

const {
  getAnalyticsByTopic,
  getAnalyticsByDifficulty,
  getPrePostComparison,
  getWorstQuestions,
  getQuestionAnalytics,
  getAnalyticsSummary,
  getParticipantProfile,
  getParticipantImprovements,
  getLeaderboard,
  getTrends,
  getQuestionOptionDistribution,
} = require("../controllers/analyticsController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/by-topic", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getAnalyticsByTopic);
router.get("/by-difficulty", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getAnalyticsByDifficulty);
router.get("/pre-post-comparison", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getPrePostComparison);
router.get("/worst-questions", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getWorstQuestions);
router.get("/questions", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getQuestionAnalytics);

// Phase 3 advanced analytics (INSTRUCTOR only).
router.get("/summary", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getAnalyticsSummary);
router.get("/leaderboard", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getLeaderboard);
router.get("/trends", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getTrends);
router.get("/participant-improvements", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getParticipantImprovements);
router.get("/participants/:userId", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getParticipantProfile);
router.get("/questions/:id/option-distribution", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getQuestionOptionDistribution);

module.exports = router;
