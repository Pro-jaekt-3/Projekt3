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

router.get("/by-topic", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getAnalyticsByTopic);
router.get("/by-difficulty", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getAnalyticsByDifficulty);
router.get("/pre-post-comparison", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getPrePostComparison);
router.get("/worst-questions", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getWorstQuestions);
router.get("/questions", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getQuestionAnalytics);

// Phase 3 advanced analytics (all INSTRUCTOR+ADMIN).
router.get("/summary", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getAnalyticsSummary);
router.get("/leaderboard", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getLeaderboard);
router.get("/trends", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getTrends);
router.get("/participant-improvements", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getParticipantImprovements);
router.get("/participants/:userId", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getParticipantProfile);
router.get("/questions/:id/option-distribution", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getQuestionOptionDistribution);

// SCOPE NOTE (Dev 2 / feat/db-v2-dev2): GET /by-learning-objective removed here
// out of Dev 2 scope during Task 2. Dev 3: add GET /by-topic replacement here.

module.exports = router;
