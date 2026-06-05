const express = require("express");
const router = express.Router();

const {
  getAssessments,
  getAvailableAssessments,
  getAssessment,
  createAssessment,
  generateAssessment,
  updateAssessment,
  updateAssessmentStatus,
  deleteAssessment,
} = require("../controllers/assessmentController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), getAssessments);
router.get("/available", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), getAvailableAssessments);
router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), getAssessment);
router.post("/generate", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), generateAssessment);
router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createAssessment);
router.patch("/:id/status", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateAssessmentStatus);
router.put("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateAssessment);
router.delete("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), deleteAssessment);

module.exports = router;
