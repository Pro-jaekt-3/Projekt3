const express = require("express");

const {
  getAnalyticsByTopic,
  getAnalyticsByLearningObjective,
  getAnalyticsByDifficulty,
  getPrePostComparison,
  getPrePostSeries,
  getPrePostSeriesDetail,
  getWorstQuestions,
  getQuestionAnalytics,
} = require("../controllers/analyticsController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/by-topic", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getAnalyticsByTopic);
router.get("/by-learning-objective", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getAnalyticsByLearningObjective);
router.get("/by-difficulty", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getAnalyticsByDifficulty);
router.get("/pre-post-comparison", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getPrePostComparison);
router.get("/pre-post-series", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getPrePostSeries);
router.get("/pre-post-series/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getPrePostSeriesDetail);
router.get("/worst-questions", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getWorstQuestions);
router.get("/questions", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getQuestionAnalytics);

module.exports = router;
