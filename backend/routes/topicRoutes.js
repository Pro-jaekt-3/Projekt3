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

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getTopics);

router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createTopic);

router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getTopic);

router.put("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateTopic);

router.delete("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), deleteTopic);

module.exports = router;
