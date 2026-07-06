const express = require("express");
const router = express.Router();

const {
  getAssessments,
  getAvailableAssessments,
  getAssessment,
  getAssessmentResults,
  createAssessment,
  generateAssessment,
  updateAssessment,
  updateAssessmentStatus,
  deleteAssessment,
} = require("../controllers/assessmentController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { requireOwnership } = require("../middleware/scopeMiddleware");

// ADMIN je umaknjen z vseh vsebinskih poti (matrika vlog, handoff_dev2_dev3 —
// ADMIN ni content-collaborator; enako kot trainings/topics/questions).
// GET /, /available in GET /:id so scope-ani v controllerju (scopedListWhere /
// UserTraining enrollment), ker imajo participant vejo, ki je requireOwnership ne pokriva.
router.get("/", firebaseAuthMiddleware, requireRole("INSTRUCTOR", "PARTICIPANT"), getAssessments);
router.get("/available", firebaseAuthMiddleware, requireRole("INSTRUCTOR", "PARTICIPANT"), getAvailableAssessments);
router.get("/:id/results", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("assessment"), getAssessmentResults);
router.get("/:id", firebaseAuthMiddleware, requireRole("INSTRUCTOR", "PARTICIPANT"), getAssessment);
// POST poti nimajo :id — lastništvo ciljnega traininga preveri controller (isTrainingOwner).
router.post("/generate", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), generateAssessment);
router.post("/", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), createAssessment);
router.patch("/:id/status", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("assessment"), updateAssessmentStatus);
router.put("/:id", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("assessment"), updateAssessment);
router.delete("/:id", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), requireOwnership("assessment"), deleteAssessment);

module.exports = router;
