const express = require("express");
const router = express.Router();

const {
  getTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
} = require("../controllers/trainingController");
const {
  getMyTrainings,
  getTrainingMembers,
  addTrainingMember,
  removeTrainingMember,
  enrollWithToken,
  regenerateEnrollmentToken,
} = require("../controllers/userTrainingController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { requireOwnership } = require("../middleware/scopeMiddleware");

// Matrika vlog: ADMIN = provisioning (kreacija, članstva, poljuben training);
// INSTRUCTOR = samo svoji treningi (requireOwnership -> 404 za tuje);
// PARTICIPANT = samo /mine in /enroll.

// POZOR: /mine mora biti registriran PRED /:id.
router.get(
  "/mine",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"),
  getMyTrainings,
);

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getTrainings);
router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createTraining);

router.get(
  "/:id",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  requireOwnership("training"),
  getTrainingById,
);
router.put(
  "/:id",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  requireOwnership("training"),
  updateTraining,
);
router.delete(
  "/:id",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  requireOwnership("training"),
  deleteTraining,
);

// --- Članstva (UserTraining) -------------------------------------------------

router.get(
  "/:id/members",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  requireOwnership("training"),
  getTrainingMembers,
);
router.post(
  "/:id/members",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  requireOwnership("training"),
  addTrainingMember,
);
router.delete(
  "/:id/members/:userId",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  requireOwnership("training"),
  removeTrainingMember,
);

// --- QR / token enrollment (app-invarianta #7) --------------------------------

// Self-enrollment z veljavnim tokenom — katerakoli avtenticirana vloga.
router.post(
  "/:id/enroll",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR", "PARTICIPANT"),
  enrollWithToken,
);
router.post(
  "/:id/regenerate-token",
  firebaseAuthMiddleware,
  requireRole("ADMIN", "INSTRUCTOR"),
  requireOwnership("training"),
  regenerateEnrollmentToken,
);

module.exports = router;
