const express = require("express");

const router = express.Router();

const {
  getTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
} = require("../controllers/topicController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { requireOwnership } = require("../middleware/scopeMiddleware");

// Matrika vlog: vsebina traininga (Topic CRUD) je samo za INSTRUCTOR-lastnika
// (ADMIN ni content-collaborator). requireOwnership -> 404 za tuje topice.

router.get("/", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), getTopics);

router.post("/", firebaseAuthMiddleware, requireRole("INSTRUCTOR"), createTopic);

router.get(
  "/:id",
  firebaseAuthMiddleware,
  requireRole("INSTRUCTOR"),
  requireOwnership("topic"),
  getTopic,
);

router.put(
  "/:id",
  firebaseAuthMiddleware,
  requireRole("INSTRUCTOR"),
  requireOwnership("topic"),
  updateTopic,
);

router.delete(
  "/:id",
  firebaseAuthMiddleware,
  requireRole("INSTRUCTOR"),
  requireOwnership("topic"),
  deleteTopic,
);

module.exports = router;
