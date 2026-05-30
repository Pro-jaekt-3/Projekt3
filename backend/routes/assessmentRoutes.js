const express = require("express");
const router = express.Router();

const {
  getAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
} = require("../controllers/assessmentController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.get("/", authenticate, requireRole("INSTRUCTOR", "ADMIN"), getAssessments);
router.get("/:id", authenticate, requireRole("INSTRUCTOR", "ADMIN"), getAssessment);
router.post("/", authenticate, requireRole("INSTRUCTOR", "ADMIN"), createAssessment);
router.put("/:id", authenticate, requireRole("INSTRUCTOR", "ADMIN"), updateAssessment);
router.delete("/:id", authenticate, requireRole("INSTRUCTOR", "ADMIN"), deleteAssessment);

module.exports = router;
