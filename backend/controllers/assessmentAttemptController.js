const prisma = require("../prisma/client");

const attemptResponseInclude = {
  assessment: {
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: true,
        },
      },
    },
  },
  answers: {
    orderBy: { createdAt: "asc" },
    include: {
      question: true,
      selectedOption: true,
    },
  },
};

const parseId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const serializeAnswer = (answer) => ({
  ...answer,
  textAnswer: answer.answerText ?? null,
});

const serializeAttempt = (attempt) => ({
  ...attempt,
  participantId: attempt.userId ?? null,
  answers: Array.isArray(attempt.answers)
    ? attempt.answers.map(serializeAnswer)
    : attempt.answers,
});

const canAccessAttempt = (attempt, user) => {
  if (!attempt || !user) {
    return false;
  }

  if (user.role === "ADMIN" || user.role === "INSTRUCTOR") {
    return true;
  }

  return attempt.userId === user.id;
};

const startAttempt = async (req, res) => {
  try {
    const assessmentId = parseId(req.body.assessmentId);
    const participantId = req.user?.id ?? null;

    if (!assessmentId) {
      return res.status(400).json({ error: "assessmentId must be a positive integer" });
    }

    if (!participantId) {
      return res.status(401).json({ error: "Authenticated user is required" });
    }

    const [assessment, participant] = await Promise.all([
      prisma.assessment.findUnique({
        where: { id: assessmentId },
      }),
      participantId
        ? prisma.user.findUnique({
            where: { id: participantId },
          })
        : Promise.resolve(null),
    ]);

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    if (assessment.status !== "PUBLISHED") {
      return res.status(403).json({ error: "This assessment is not available." });
    }

    if (participantId && !participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assessmentId,
        userId: participantId,
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    res.status(201).json(serializeAttempt(attempt));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const submitAttempt = async (req, res) => {
  try {
    const attemptId = parseId(req.params.id);
    const { answers } = req.body;

    if (!attemptId) {
      return res.status(400).json({ error: "Attempt id must be a positive integer" });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "answers array is required" });
    }

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
              include: {
                question: {
                  include: {
                    answerOptions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    if (!canAccessAttempt(attempt, req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Attempt has already been submitted" });
    }

    const submittedQuestionIds = new Set();
    const assessmentQuestions = attempt.assessment.questions || [];
    const assessmentQuestionMap = new Map(
      assessmentQuestions.map((assessmentQuestion) => [
        assessmentQuestion.questionId,
        assessmentQuestion,
      ])
    );

    const maxScore = assessmentQuestions.reduce(
      (total, assessmentQuestion) => total + Number(assessmentQuestion.points ?? 1),
      0
    );

    let score = 0;
    const participantAnswersData = [];

    for (const answer of answers) {
      const questionId = parseId(answer.questionId);

      if (!questionId) {
        return res
          .status(400)
          .json({ error: "Each answer must include a valid positive integer questionId" });
      }

      if (submittedQuestionIds.has(questionId)) {
        return res.status(400).json({ error: `Duplicate answer for question ${questionId}` });
      }
      submittedQuestionIds.add(questionId);

      const assessmentQuestion = assessmentQuestionMap.get(questionId);
      if (!assessmentQuestion) {
        return res
          .status(400)
          .json({ error: `Question ${questionId} does not belong to this assessment` });
      }

      const pointsForQuestion = Number(assessmentQuestion.points ?? 1);
      const question = assessmentQuestion.question;

      if (question.type === "MULTIPLE_CHOICE") {
        const selectedOptionId = parseId(answer.selectedOptionId);

        if (!selectedOptionId) {
          return res
            .status(400)
            .json({ error: `selectedOptionId is required for question ${questionId}` });
        }

        const selectedOption = question.answerOptions.find((option) => option.id === selectedOptionId);

        if (!selectedOption) {
          return res
            .status(400)
            .json({ error: `Invalid selectedOptionId for question ${questionId}` });
        }

        const isCorrect = selectedOption.isCorrect;
        const pointsAwarded = isCorrect ? pointsForQuestion : 0;
        score += pointsAwarded;

        participantAnswersData.push({
          attemptId,
          questionId,
          selectedOptionId,
          answerText: null,
          isCorrect,
          pointsAwarded,
          needsManualReview: false,
        });
        continue;
      }

      const textAnswer =
        typeof answer.textAnswer === "string"
          ? answer.textAnswer
          : typeof answer.answerText === "string"
            ? answer.answerText
            : null;

      participantAnswersData.push({
        attemptId,
        questionId,
        selectedOptionId: null,
        answerText: textAnswer,
        isCorrect: null,
        pointsAwarded: null,
        needsManualReview: true,
      });
    }

    const updatedAttempt = await prisma.$transaction(async (tx) => {
      await tx.participantAnswer.deleteMany({
        where: { attemptId },
      });

      if (participantAnswersData.length > 0) {
        await tx.participantAnswer.createMany({
          data: participantAnswersData,
        });
      }

      return tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          score,
          maxScore,
        },
        include: attemptResponseInclude,
      });
    });

    res.json(serializeAttempt(updatedAttempt));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAttempt = async (req, res) => {
  try {
    const attemptId = parseId(req.params.id);

    if (!attemptId) {
      return res.status(400).json({ error: "Attempt id must be a positive integer" });
    }

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: attemptResponseInclude,
    });

    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    if (!canAccessAttempt(attempt, req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(serializeAttempt(attempt));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  startAttempt,
  submitAttempt,
  getAttempt,
};
