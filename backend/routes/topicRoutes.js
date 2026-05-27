const express = require("express");

const router = express.Router();

const {
  getTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
} = require("../controllers/topicController");

router.get("/", getTopics);

router.post("/", createTopic);

router.get("/:id", getTopic);

router.put("/:id", updateTopic);

router.delete("/:id", deleteTopic);

module.exports = router;