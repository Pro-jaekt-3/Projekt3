const prisma = require("../prisma/client");

const getEquivalentQuestionGroups = async (req, res) => {
  try {
    const groups = await prisma.equivalentQuestionGroup.findMany({
      include: {
        questions: true,
      },
    });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getEquivalentQuestionGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.equivalentQuestionGroup.findUnique({
      where: { id: Number(id) },
      include: {
        questions: true,
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Equivalent question group not found" });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createEquivalentQuestionGroup = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const group = await prisma.equivalentQuestionGroup.create({
      data: {
        name: name.trim(),
        description,
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

const updateEquivalentQuestionGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existing = await prisma.equivalentQuestionGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Equivalent question group not found" });
    }

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: "Group name cannot be empty" });
    }

    const group = await prisma.equivalentQuestionGroup.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
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

const deleteEquivalentQuestionGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.equivalentQuestionGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Equivalent question group not found" });
    }

    await prisma.equivalentQuestionGroup.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Equivalent question group deleted" });
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

    const group = await prisma.equivalentQuestionGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!group) {
      return res.status(404).json({ error: "Equivalent question group not found" });
    }

    const question = await prisma.question.findUnique({
      where: { id: Number(questionId) },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: Number(questionId) },
      data: {
        equivalentGroupId: Number(id),
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

    const group = await prisma.equivalentQuestionGroup.findUnique({
      where: { id: Number(id) },
    });

    if (!group) {
      return res.status(404).json({ error: "Equivalent question group not found" });
    }

    const question = await prisma.question.findUnique({
      where: { id: Number(questionId) },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (question.equivalentGroupId !== Number(id)) {
      return res.status(400).json({
        error: "Question does not belong to this equivalent question group",
      });
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: Number(questionId) },
      data: {
        equivalentGroupId: null,
      },
    });

    res.json(updatedQuestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getEquivalentQuestionGroups,
  getEquivalentQuestionGroup,
  createEquivalentQuestionGroup,
  updateEquivalentQuestionGroup,
  deleteEquivalentQuestionGroup,
  addQuestionToGroup,
  removeQuestionFromGroup,
};
