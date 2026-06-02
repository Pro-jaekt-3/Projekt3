const express = require("express");
const router = express.Router();

const {
  getAssessments,
  getAssessment,
  createAssessment,
  generateAssessment,
  updateAssessment,
  deleteAssessment,
} = require("../controllers/assessmentController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.get("/", getAssessments);
router.get("/:id", getAssessment);
router.post("/generate", authenticate, requireRole("ADMIN", "INSTRUCTOR"), generateAssessment);
router.post("/", authenticate, requireRole("ADMIN", "INSTRUCTOR"), createAssessment);
router.put("/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), updateAssessment);
router.delete("/:id", authenticate, requireRole("ADMIN", "INSTRUCTOR"), deleteAssessment);

module.exports = router;
