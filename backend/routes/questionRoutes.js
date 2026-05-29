const express = require("express");
const router = express.Router();

const {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} = require("../controllers/questionController");

router.get("/", getQuestions);
router.post("/", createQuestion);
router.get("/:id", getQuestion);
router.put("/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

module.exports = router;