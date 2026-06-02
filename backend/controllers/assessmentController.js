const prisma = require("../prisma/client");

const normalizeQuestionItems = (questions) => {
  return questions.map((item, index) => {
    if (typeof item === "number") {
      return {
        questionId: item,
        points: 1,
        orderIndex: index,
      };
    }

    if (typeof item === "object" && item !== null && item.questionId !== undefined) {
      return {
        questionId: Number(item.questionId),
        points: item.points !== undefined ? Number(item.points) : 1,
        orderIndex: index,
      };
    }

    throw new Error("Invalid question format");
  });
};

const getAssessments = async (req, res) => {
  try {
    const assessments = await prisma.assessment.findMany({
      include: {
        training: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            question: {
              include: {
                answerOptions: {
                  orderBy: {
                    orderIndex: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAssessment = async (req, res) => {
  try {
    const { id } = req.params;

    const assessment = await prisma.assessment.findUnique({
      where: { id: Number(id) },
      include: {
        training: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            question: {
              include: {
                answerOptions: {
                  orderBy: {
                    orderIndex: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const validateQuestions = async (questionItems) => {
  const questionIds = questionItems.map((item) => item.questionId);
  const uniqueQuestionIds = [...new Set(questionIds)];

  if (uniqueQuestionIds.length !== questionIds.length) {
    return { error: "Duplicate question IDs are not allowed" };
  }

  const questions = await prisma.question.findMany({
    where: {
      id: { in: uniqueQuestionIds },
    },
  });

  if (questions.length !== uniqueQuestionIds.length) {
    return { error: "One or more question IDs are invalid" };
  }

  const invalidStatus = questions.find((question) => question.status !== "APPROVED");
  if (invalidStatus) {
    return { error: "All questions must be APPROVED to be added to an assessment" };
  }

  return { questionItems, questionIds: uniqueQuestionIds };
};

const createAssessment = async (req, res) => {
  try {
    const { title, description, trainingId, type = "QUIZ", questions } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "At least one question is required" });
    }

    const questionItems = normalizeQuestionItems(questions);
    const validation = await validateQuestions(questionItems);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    if (!trainingId) {
      return res.status(400).json({ error: "trainingId is required" });
    }

    const assessment = await prisma.assessment.create({
      data: {
        title: title.trim(),
        description,
        trainingId: Number(trainingId),
        type,
        questions: {
          create: questionItems.map((item) => ({
            questionId: item.questionId,
            points: item.points,
            orderIndex: item.orderIndex,
          })),
        },
      },
      include: {
        training: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            question: true,
          },
        },
      },
    });

    res.status(201).json(assessment);
  } catch (error) {
    if (error.message === "Invalid question format") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const generateAssessment = async (req, res) => {
  try {
    const {
      title,
      description,
      trainingId,
      topicId,
      learningObjectiveId,
      difficulty,
      count,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!trainingId) {
      return res.status(400).json({ error: "trainingId is required" });
    }

    const parsedCount = Number(count);
    if (!parsedCount || parsedCount < 1) {
      return res.status(400).json({ error: "count must be a positive integer" });
    }

    let difficultyValue;
    if (difficulty !== undefined) {
      if (typeof difficulty === "number") {
        difficultyValue = difficulty;
      } else if (typeof difficulty === "string") {
        const normalized = difficulty.trim().toLowerCase();
        if (normalized === "easy") difficultyValue = 1;
        else if (normalized === "medium") difficultyValue = 2;
        else if (normalized === "hard") difficultyValue = 3;
        else if (!Number.isNaN(Number(normalized))) difficultyValue = Number(normalized);
        else {
          return res.status(400).json({ error: "Invalid difficulty value" });
        }
      } else {
        return res.status(400).json({ error: "Invalid difficulty value" });
      }
    }

    const questionWhere = {
      status: "APPROVED",
      topic: {
        trainingId: Number(trainingId),
      },
      ...(topicId !== undefined && { topicId: Number(topicId) }),
      ...(learningObjectiveId !== undefined && {
        learningObjectiveId: Number(learningObjectiveId),
      }),
      ...(difficultyValue !== undefined && { difficulty: difficultyValue }),
    };

    const availableQuestions = await prisma.question.findMany({
      where: questionWhere,
      orderBy: { id: "asc" },
    });

    if (availableQuestions.length < parsedCount) {
      return res.status(400).json({
        error: `Only ${availableQuestions.length} approved questions match the requested filters`,
      });
    }

    const selectedQuestions = [];
    const selectedGroupIds = new Set();
    const overflow = [];

    for (const question of availableQuestions) {
      const groupId = question.equivalentGroupId;
      if (groupId !== null && groupId !== undefined) {
        if (!selectedGroupIds.has(groupId)) {
          selectedGroupIds.add(groupId);
          selectedQuestions.push(question);
        } else {
          overflow.push(question);
        }
      } else {
        selectedQuestions.push(question);
      }

      if (selectedQuestions.length >= parsedCount) {
        break;
      }
    }

    if (selectedQuestions.length < parsedCount) {
      for (const question of overflow) {
        selectedQuestions.push(question);
        if (selectedQuestions.length >= parsedCount) {
          break;
        }
      }
    }

    if (selectedQuestions.length < parsedCount) {
      return res.status(400).json({
        error: `Only ${availableQuestions.length} approved questions match the requested filters`,
      });
    }

    const assessment = await prisma.assessment.create({
      data: {
        title: title.trim(),
        description,
        trainingId: Number(trainingId),
        type: "QUIZ",
        questions: {
          create: selectedQuestions.slice(0, parsedCount).map((question, index) => ({
            questionId: question.id,
            points: 1,
            orderIndex: index,
          })),
        },
      },
      include: {
        training: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            question: true,
          },
        },
      },
    });

    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, trainingId, type, questions } = req.body;

    const existing = await prisma.assessment.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    let questionUpdate = undefined;
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "At least one question is required" });
      }

      const questionItems = normalizeQuestionItems(questions);
      const validation = await validateQuestions(questionItems);
      if (validation.error) {
        return res.status(400).json({ error: validation.error });
      }

      questionUpdate = {
        deleteMany: {},
        create: questionItems.map((item) => ({
          questionId: item.questionId,
          points: item.points,
          orderIndex: item.orderIndex,
        })),
      };
    }

    const assessment = await prisma.assessment.update({
      where: { id: Number(id) },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(trainingId !== undefined && { trainingId: Number(trainingId) }),
        ...(type !== undefined && { type }),
        ...(questionUpdate ? { questions: questionUpdate } : {}),
      },
      include: {
        training: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            question: true,
          },
        },
      },
    });

    res.json(assessment);
  } catch (error) {
    if (error.message === "Invalid question format") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.assessment.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    await prisma.assessment.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Assessment deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAssessments,
  getAssessment,
  createAssessment,
  generateAssessment,
  updateAssessment,
  deleteAssessment,
};
