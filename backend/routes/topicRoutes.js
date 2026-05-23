const express = require("express");

const router = express.Router();

const {
  getTopics,
  createTopic,
  deleteTopic,
} = require("../controllers/topicController");

router.get("/", getTopics);

router.post("/", createTopic);

router.delete("/:id", deleteTopic);

module.exports = router;