const express = require("express");
const router = express.Router();

const {
  getQuestions,
  createQuestion,
  deleteQuestion,
} = require("../controllers/questionController");

router.get("/", getQuestions);
router.post("/", createQuestion);
router.delete("/:id", deleteQuestion);

module.exports = router;