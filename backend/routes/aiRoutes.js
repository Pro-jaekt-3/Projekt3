const express = require("express");
const router = express.Router();

const { generateQuestionDraft } = require("../controllers/aiController");

router.post("/question-draft", generateQuestionDraft);

module.exports = router;
