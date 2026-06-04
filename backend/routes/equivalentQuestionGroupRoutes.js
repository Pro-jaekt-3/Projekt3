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
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");

router.get("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getEquivalentQuestionGroups);
router.post("/", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), createEquivalentQuestionGroup);
router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), getEquivalentQuestionGroup);
router.put("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), updateEquivalentQuestionGroup);
router.delete("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), deleteEquivalentQuestionGroup);
router.post("/:id/questions", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), addQuestionToGroup);
router.delete("/:id/questions/:questionId", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"), removeQuestionFromGroup);

module.exports = router;
