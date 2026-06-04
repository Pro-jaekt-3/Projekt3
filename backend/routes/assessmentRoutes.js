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
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), getAssessments);
router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"), getAssessment);
router.post("/generate", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), generateAssessment);
router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createAssessment);
router.put("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateAssessment);
router.delete("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), deleteAssessment);

module.exports = router;
