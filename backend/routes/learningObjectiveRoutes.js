const express = require("express");

const {
  getLearningObjectives,
  getLearningObjective,
  createLearningObjective,
  updateLearningObjective,
  deleteLearningObjective,
} = require("../controllers/learningObjectiveController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getLearningObjectives);

router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createLearningObjective);

router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getLearningObjective);

router.put("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateLearningObjective);

router.delete("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), deleteLearningObjective);

module.exports = router;
