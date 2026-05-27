const express = require("express");

const {
  getLearningObjectives,
  getLearningObjective,
  createLearningObjective,
  updateLearningObjective,
  deleteLearningObjective,
} = require("../controllers/learningObjectiveController");

const router = express.Router();

router.get("/", getLearningObjectives);

router.post("/", createLearningObjective);

router.get("/:id", getLearningObjective);

router.put("/:id", updateLearningObjective);

router.delete("/:id", deleteLearningObjective);

module.exports = router;