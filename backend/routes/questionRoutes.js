const express = require("express");
const router = express.Router();

const {
  getQuestions,
  createQuestion,
} = require("../controllers/questionController");

router.get("/", getQuestions);
router.post("/", createQuestion);

module.exports = router;