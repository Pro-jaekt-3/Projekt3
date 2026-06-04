const express = require("express");
const router = express.Router();

const {
  getTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
} = require("../controllers/trainingController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getTrainings);
router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getTrainingById);
router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createTraining);
router.put("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateTraining);
router.delete("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), deleteTraining);

module.exports = router;
