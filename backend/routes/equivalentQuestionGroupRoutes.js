const express = require("express");
const router = express.Router();

const {
  getEquivalentQuestionGroups,
  getEquivalentQuestionGroup,
  createEquivalentQuestionGroup,
  updateEquivalentQuestionGroup,
  deleteEquivalentQuestionGroup,
  addQuestionToGroup,
  removeQuestionFromGroup,
} = require("../controllers/equivalentQuestionGroupController");

router.get("/", getEquivalentQuestionGroups);
router.post("/", createEquivalentQuestionGroup);
router.get("/:id", getEquivalentQuestionGroup);
router.put("/:id", updateEquivalentQuestionGroup);
router.delete("/:id", deleteEquivalentQuestionGroup);
router.post("/:id/questions", addQuestionToGroup);
router.delete("/:id/questions/:questionId", removeQuestionFromGroup);

module.exports = router;
