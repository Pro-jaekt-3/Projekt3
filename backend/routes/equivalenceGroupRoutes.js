const express = require("express");
const router = express.Router();
const {
  getEquivalenceGroups,
  getEquivalenceGroup,
  createEquivalenceGroup,
  updateEquivalenceGroup,
  deleteEquivalenceGroup,
  addQuestionToGroup,
  removeQuestionFromGroup,
} = require("../controllers/equivalenceGroupController");
const { firebaseAuthMiddleware } = require("../middleware/firebaseAuthMiddleware");
const { requireRole } = require("../middleware/roleMiddleware");
const { requireOwnership } = require("../middleware/scopeMiddleware");

router.use(firebaseAuthMiddleware);
router.use(requireRole("INSTRUCTOR")); // ADMIN is not a content collaborator (matrika vlog)

router.get("/", getEquivalenceGroups); // scoped in controller via scopedListWhere
router.post("/", createEquivalenceGroup); // ownership verified in controller via isTrainingOwner

router.get("/:id", requireOwnership("equivalenceGroup"), getEquivalenceGroup);
router.put("/:id", requireOwnership("equivalenceGroup"), updateEquivalenceGroup);
router.delete("/:id", requireOwnership("equivalenceGroup"), deleteEquivalenceGroup);
router.post("/:id/questions", requireOwnership("equivalenceGroup"), addQuestionToGroup);
router.delete("/:id/questions/:questionId", requireOwnership("equivalenceGroup"), removeQuestionFromGroup);

module.exports = router;
