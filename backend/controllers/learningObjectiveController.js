const prisma = require("../prisma/client");

const getLearningObjectives = async (req, res) => {
  try {
    const { topicId } = req.query;

    // If topicId filter provided, validate topic exists
    if (topicId) {
      const topic = await prisma.topic.findUnique({
        where: { id: Number(topicId) },
      });

      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
    }

    const learningObjectives = await prisma.learningObjective.findMany({
      where: topicId ? { topicId: Number(topicId) } : undefined,
      include: { topic: true },
    });

    res.json(learningObjectives);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const createLearningObjective = async (req, res) => {
  try {
    const { title, description, topicId } = req.body;

    // Validate title
    if (!title || title.trim() === "") {
      return res.status(400).json({ error: "Title is required" });
    }

    // Validate topicId
    if (!topicId) {
      return res.status(400).json({ error: "topicId is required" });
    }

    const topic = await prisma.topic.findUnique({
      where: { id: Number(topicId) },
    });

    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }

    const learningObjective = await prisma.learningObjective.create({
      data: {
        title,
        description,
        topicId: Number(topicId),
      },
      include: { topic: true },
    });

    res.status(201).json(learningObjective);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getLearningObjective = async (req, res) => {
  try {
    const { id } = req.params;

    const lo = await prisma.learningObjective.findUnique({
      where: { id: Number(id) },
      include: { topic: true },
    });

    if (!lo) return res.status(404).json({ error: "Learning objective not found" });

    res.json(lo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateLearningObjective = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, topicId } = req.body;

    const existing = await prisma.learningObjective.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ error: "Learning objective not found" });

    // If topicId provided, validate topic exists
    if (topicId) {
      const topic = await prisma.topic.findUnique({ where: { id: Number(topicId) } });
      if (!topic) return res.status(404).json({ error: "Topic not found" });
    }

    if (title !== undefined && title.trim() === "") {
      return res.status(400).json({ error: "Title cannot be empty" });
    }

    const updated = await prisma.learningObjective.update({
      where: { id: Number(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(topicId && { topicId: Number(topicId) }),
      },
      include: { topic: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteLearningObjective = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.learningObjective.findUnique({ where: { id: Number(id) } });
    if (!existing) return res.status(404).json({ error: "Learning objective not found" });

    await prisma.learningObjective.delete({ where: { id: Number(id) } });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  getLearningObjectives,
  getLearningObjective,
  createLearningObjective,
  updateLearningObjective,
  deleteLearningObjective,
};