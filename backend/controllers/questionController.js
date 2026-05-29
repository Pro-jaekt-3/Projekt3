const prisma = require("../prisma/client");

const getQuestions = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        topic: true,
        answerOptions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await prisma.question.findUnique({
      where: { id: Number(id) },
      include: {
        topic: true,
        answerOptions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createQuestion = async (req, res) => {
  try {
    const {
      title,
      description,
      difficulty,
      topicId,
      type,
      options,
      createdById = 1, // if create by id is undefined js sets it to 1 will not be required in the future when we have auth implemented in production ?
      learningObjectiveId,
    } = req.body;

    const questionType = type || "OPEN";

    if (questionType === "MULTIPLE_CHOICE") {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          error: "Multiple choice questions require at least two options",
        });
      }

      if (!options.some((option) => option.isCorrect)) {
        return res.status(400).json({
          error: "Multiple choice questions require at least one correct option",
        });
      }
    }

    if (options && questionType !== "MULTIPLE_CHOICE") {
      return res.status(400).json({
        error: "Options are only allowed for MULTIPLE_CHOICE questions",
      });
    }

    const question = await prisma.question.create({
      data: {
        title,
        description,
        difficulty,
        topicId,
        type: questionType,
        createdById,
        learningObjectiveId,
        answerOptions: options
          ? {
              create: options.map((option, index) => ({
                text: option.text,
                isCorrect: Boolean(option.isCorrect),
                orderIndex: index,
              })),
            }
          : undefined,
      },
      include: {
        topic: true,
        answerOptions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      difficulty,
      topicId,
      type,
      options,
    } = req.body;

    const existing = await prisma.question.findUnique({
      where: { id: Number(id) },
      include: {
        answerOptions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Question not found" });
    }

    const updatedType = type || existing.type;

    if (options && updatedType !== "MULTIPLE_CHOICE") {
      return res.status(400).json({
        error: "Options are only allowed for MULTIPLE_CHOICE questions",
      });
    }

    if (updatedType === "MULTIPLE_CHOICE" && options) {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          error: "Multiple choice questions require at least two options",
        });
      }

      if (!options.some((option) => option.isCorrect)) {
        return res.status(400).json({
          error: "Multiple choice questions require at least one correct option",
        });
      }
    }

    const question = await prisma.question.update({
      where: { id: Number(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(difficulty !== undefined && { difficulty }),
        ...(topicId !== undefined && { topicId }),
        ...(type !== undefined && { type }),
        ...(options
          ? {
              answerOptions: {
                deleteMany: {},
                create: options.map((option, index) => ({
                  text: option.text,
                  isCorrect: Boolean(option.isCorrect),
                  orderIndex: index,
                })),
              },
            }
          : {}),
      },
      include: {
        topic: true,
        answerOptions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.question.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      message: "Question deleted",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
};

module.exports = {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};