const prisma = require("../prisma/client");
const { scopedListWhere, isTrainingOwner } = require("../middleware/scopeMiddleware");

const getEquivalenceGroups = async (req, res) => {
  try {
    const where = scopedListWhere(req.user, "equivalenceGroup");
    if (where === null) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const groups = await prisma.equivalenceGroup.findMany({
      where,
      include: {
        questions: true,
      },
    });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getEquivalenceGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.equivalenceGroup.findUnique({
      where: { id: Number(id) },
      include: {
        questions: true,
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Equivalence group not found" });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createEquivalenceGroup = async (req, res) => {
  try {
    const { title, description, trainingId } = req.body;

    if (!trainingId) {
      return res.status(400).json({ error: "trainingId is required" });
    }

    const owns = await isTrainingOwner(req.user.id, trainingId);
    if (!owns) {
      return res.status(404).json({ error: "Training not found" });
    }

    const group = await prisma.equivalenceGroup.create({
      data: {
        title: title?.trim() || null,
        description: description ?? null,
        trainingId: Number(trainingId),
      },
      include: {
        questions: true,
      },
    });

    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateEquivalenceGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const existing = await prisma.equivalenceGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Equivalence group not found" });
    }

    const group = await prisma.equivalenceGroup.update({
      where: { id: Number(id) },
      data: {
        ...(title !== undefined && { title: title?.trim() || null }),
        ...(description !== undefined && { description }),
      },
      include: {
        questions: true,
      },
    });

    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteEquivalenceGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.equivalenceGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Equivalence group not found" });
    }

    await prisma.equivalenceGroup.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Equivalence group deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addQuestionToGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionId } = req.body;

    if (questionId === undefined || questionId === null) {
      return res.status(400).json({ error: "questionId is required" });
    }

    const group = await prisma.equivalenceGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!group) {
      return res.status(404).json({ error: "Equivalence group not found" });
    }

    const question = await prisma.question.findUnique({
      where: { id: Number(questionId) },
      include: { topic: true },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.equivalenceGroupId === Number(id)) {
      return res.json(question);
    }

    // Training scope invariant (NOTES §5.4): question and group must share trainingId.
    if (question.topic.trainingId !== group.trainingId) {
      return res.status(409).json({
        error: `Question belongs to training ${question.topic.trainingId} but equivalence group ${Number(id)} belongs to training ${group.trainingId}. Training must match.`,
      });
    }

    if (
      question.equivalenceGroupId !== null &&
      question.equivalenceGroupId !== Number(id)
    ) {
      return res.status(409).json({
        error: `Question ${question.id} already belongs to a different equivalence group (${question.equivalenceGroupId}). Remove it from that group before adding it to group ${Number(id)}.`,
      });
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: Number(questionId) },
      data: {
        equivalenceGroupId: Number(id),
      },
    });

    res.json(updatedQuestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeQuestionFromGroup = async (req, res) => {
  try {
    const { id, questionId } = req.params;

    const group = await prisma.equivalenceGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!group) {
      return res.status(404).json({ error: "Equivalence group not found" });
    }

    const question = await prisma.question.findUnique({
      where: { id: Number(questionId) },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.equivalenceGroupId !== Number(id)) {
      return res.status(400).json({
        error: "Question does not belong to this equivalence group",
      });
    }

    // Remove question from group and auto-delete the group if it drops below 2 members
    // (addresses §3.5#1 live anomaly — stara shema ji je puščala, nova ne).
    const updatedQuestion = await prisma.$transaction(async (tx) => {
      const updated = await tx.question.update({
        where: { id: Number(questionId) },
        data: { equivalenceGroupId: null },
      });

      const remainingCount = await tx.question.count({
        where: { equivalenceGroupId: Number(id) },
      });

      if (remainingCount < 2) {
        await tx.equivalenceGroup.delete({ where: { id: Number(id) } });
      }

      return updated;
    });

    res.json(updatedQuestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getEquivalenceGroups,
  getEquivalenceGroup,
  createEquivalenceGroup,
  updateEquivalenceGroup,
  deleteEquivalenceGroup,
  addQuestionToGroup,
  removeQuestionFromGroup,
};
