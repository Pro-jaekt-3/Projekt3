const express = require("express");

const {
  getLearningObjectives,
  createLearningObjective,
  deleteLearningObjective,
} = require("../controllers/learningObjectiveController");

const router = express.Router();

router.get("/", getLearningObjectives);

router.post("/", createLearningObjective);

router.delete("/:id", deleteLearningObjective);

module.exports = router;