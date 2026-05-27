const express = require("express");
const router = express.Router();

const {
  getTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
} = require("../controllers/trainingController");

router.get("/", getTrainings);
router.get("/:id", getTrainingById);
router.post("/", createTraining);
router.put("/:id", updateTraining);
router.delete("/:id", deleteTraining);

module.exports = router;
