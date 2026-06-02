const express = require("express");

const {
  getAnalyticsByTopic,
  getAnalyticsByLearningObjective,
  getAnalyticsByDifficulty,
  getPrePostComparison,
  getWorstQuestions,
  getQuestionAnalytics,
} = require("../controllers/analyticsController");

const router = express.Router();

router.get("/by-topic", getAnalyticsByTopic);
router.get("/by-learning-objective", getAnalyticsByLearningObjective);
router.get("/by-difficulty", getAnalyticsByDifficulty);
router.get("/pre-post-comparison", getPrePostComparison);
router.get("/worst-questions", getWorstQuestions);
router.get("/questions", getQuestionAnalytics);

module.exports = router;
