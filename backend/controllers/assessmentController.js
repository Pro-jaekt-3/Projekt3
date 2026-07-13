const prisma = require("../prisma/client");
const {
  scopedListWhere,
  isTrainingOwner,
  isTrainingParticipant,
  TRAINING_ROLES,
} = require("../middleware/scopeMiddleware");

const ASSESSMENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const assessmentDetailInclude = {
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
          topic: true,
        },
      },
    },
  },
};

// PUBLISHED assessmenti treningov, v katere je klicatelj vpisan kot PARTICIPANT
// (UserTraining) — participant veja seznamov (handoff_dev2_dev3).
const enrolledPublishedWhere = (userId) => ({
  status: "PUBLISHED",
  training: {
    members: {
      some: { userId: Number(userId), role: TRAINING_ROLES.PARTICIPANT },
    },
  },
});

const parseId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseOptionalId = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return parseId(value);
};

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
    let where;

    if (req.user?.role === "PARTICIPANT") {
      where = enrolledPublishedWhere(req.user.id);
    } else {
      // INSTRUCTOR -> samo assessmenti lastnih treningov; ADMIN -> null (ni
      // content-collaborator; route ga sicer že ustavi z requireRole).
      where = scopedListWhere(req.user, "assessment");
      if (where === null) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        ...assessmentDetailInclude,
        _count: {
          select: {
            attempts: { where: { status: { in: ["SUBMITTED", "GRADED"] } } },
          },
        },
        attempts: {
          where: { status: { in: ["SUBMITTED", "GRADED"] } },
          select: { score: true, maxScore: true },
        },
      },
    });

    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAvailableAssessments = async (req, res) => {
  try {
    const assessments = await prisma.assessment.findMany({
      // "Na voljo za reševanje" = PUBLISHED + vpisan kot PARTICIPANT, ne glede
      // na globalno vlogo (tudi INSTRUCTOR je lahko vpisan v tuj trening).
      where: enrolledPublishedWhere(req.user.id),
      include: {
        training: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAssessment = async (req, res) => {
  try {
    const assessmentId = parseId(req.params.id);

    if (!assessmentId) {
      return res.status(400).json({ error: "Assessment id must be a positive integer" });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: assessmentDetailInclude,
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // Lastnik-instruktor vidi vsak status; vsi ostali samo PUBLISHED assessmente
    // treningov, v katere so vpisani kot PARTICIPANT. Tuje -> 404 (konvencija).
    const owner =
      req.user.role === "INSTRUCTOR" &&
      (await isTrainingOwner(req.user.id, assessment.trainingId));

    if (!owner) {
      const enrolled =
        assessment.status === "PUBLISHED" &&
        (await isTrainingParticipant(req.user.id, assessment.trainingId));

      if (!enrolled) {
        return res.status(404).json({ error: "Assessment not found" });
      }
    }

    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAssessmentResults = async (req, res) => {
  try {
    const assessmentId = parseId(req.params.id);

    if (!assessmentId) {
      return res.status(400).json({ error: "Assessment id must be a positive integer" });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        training: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            question: true,
          },
        },
        attempts: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            answers: {
              include: {
                question: true,
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // GRADED je zaključen (ročno ocenjen) SUBMITTED — v rezultatih šteje enako,
    // sicer poskusi po ocenjevanju izginejo iz statistike (audit §2.3).
    const submittedAttempts = assessment.attempts.filter(
      (attempt) => attempt.status === "SUBMITTED" || attempt.status === "GRADED"
    );
    const scoredAttempts = submittedAttempts.filter(
      (attempt) => typeof attempt.score === "number"
    );
    const percentageAttempts = submittedAttempts.filter(
      (attempt) =>
        typeof attempt.score === "number" &&
        typeof attempt.maxScore === "number" &&
        attempt.maxScore > 0
    );

    const averageScore =
      scoredAttempts.length > 0
        ? scoredAttempts.reduce((total, attempt) => total + attempt.score, 0) /
          scoredAttempts.length
        : null;

    const averagePercentage =
      percentageAttempts.length > 0
        ? percentageAttempts.reduce(
            (total, attempt) => total + (attempt.score / attempt.maxScore) * 100,
            0
          ) / percentageAttempts.length
        : null;

    const questionStats = assessment.questions.map((assessmentQuestion) => {
      const answers = submittedAttempts.flatMap((attempt) =>
        attempt.answers.filter(
          (answer) => answer.questionId === assessmentQuestion.questionId
        )
      );
      const gradedAnswers = answers.filter(
        (answer) => typeof answer.pointsAwarded === "number"
      );
      const correctAnswers = answers.filter((answer) => answer.isCorrect === true);
      const attemptsCount = answers.length;

      return {
        questionId: assessmentQuestion.questionId,
        title: assessmentQuestion.question?.title ?? null,
        attemptsCount,
        correctCount: correctAnswers.length,
        correctRate:
          attemptsCount > 0 ? (correctAnswers.length / attemptsCount) * 100 : null,
        averagePoints:
          gradedAnswers.length > 0
            ? gradedAnswers.reduce(
                (total, answer) => total + answer.pointsAwarded,
                0
              ) / gradedAnswers.length
            : null,
      };
    });

    res.json({
      assessment: {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        status: assessment.status,
        training: assessment.training,
      },
      summary: {
        assignedParticipants: null,
        submittedAttempts: submittedAttempts.length,
        averageScore,
        averagePercentage,
      },
      attempts: assessment.attempts.map((attempt) => ({
        id: attempt.id,
        user: attempt.user,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        submittedAt: attempt.submittedAt,
        answersCount: attempt.answers.length,
      })),
      questionStats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const validateQuestions = async (questionItems, trainingId) => {
  const questionIds = questionItems.map((item) => item.questionId);
  const uniqueQuestionIds = [...new Set(questionIds)];
  const parsedTrainingId = parseId(trainingId);

  if (uniqueQuestionIds.length !== questionIds.length) {
    return { error: "Duplicate question IDs are not allowed" };
  }

  if (!parsedTrainingId) {
    return { error: "trainingId is required" };
  }

  const questions = await prisma.question.findMany({
    where: {
      id: { in: uniqueQuestionIds },
    },
    include: {
      topic: true,
    },
  });

  if (questions.length !== uniqueQuestionIds.length) {
    return { error: "One or more question IDs are invalid" };
  }

  const invalidStatus = questions.find((question) => question.status !== "APPROVED");
  if (invalidStatus) {
    return { error: "All questions must be APPROVED to be added to an assessment" };
  }

  const wrongTraining = questions.find(
    (question) => question.topic?.trainingId !== parsedTrainingId
  );
  if (wrongTraining) {
    return {
      error:
        "All questions must belong to the selected training through their topic",
    };
  }

  return { questionItems, questionIds: uniqueQuestionIds };
};

const validatePairedAssessment = async ({
  pairedAssessmentId,
  type,
  trainingId,
  assessmentId,
}) => {
  const parsedTrainingId = parseId(trainingId);

  if (!parsedTrainingId) {
    return { status: 400, error: "trainingId is required" };
  }

  if (type !== "POST_TEST") {
    if (pairedAssessmentId !== null && pairedAssessmentId !== undefined) {
      return {
        status: 400,
        error: "Only POST_TEST assessments can use pairedAssessmentId",
      };
    }

    return { pairedAssessmentId: null };
  }

  if (pairedAssessmentId === undefined || pairedAssessmentId === null) {
    return { pairedAssessmentId: pairedAssessmentId ?? null };
  }

  const parsedPairedAssessmentId = parseOptionalId(pairedAssessmentId);

  if (!parsedPairedAssessmentId) {
    return {
      status: 400,
      error: "pairedAssessmentId must be a positive integer",
    };
  }

  if (assessmentId && parsedPairedAssessmentId === assessmentId) {
    return {
      status: 400,
      error: "Assessment cannot be paired with itself",
    };
  }

  const pairedAssessment = await prisma.assessment.findUnique({
    where: { id: parsedPairedAssessmentId },
    select: {
      id: true,
      trainingId: true,
      type: true,
    },
  });

  if (!pairedAssessment) {
    return {
      status: 404,
      error: "Paired assessment not found",
    };
  }

  if (pairedAssessment.trainingId !== parsedTrainingId) {
    return {
      status: 400,
      error: "Paired assessment must belong to the same training",
    };
  }

  if (pairedAssessment.type !== "PRE_TEST") {
    return {
      status: 400,
      error: "POST_TEST assessments can only be paired with PRE_TEST assessments",
    };
  }

  return { pairedAssessmentId: parsedPairedAssessmentId };
};

const buildGenericGeneratedQuestions = (availableQuestions, count) => {
  const selectedQuestions = [];
  const selectedGroupIds = new Set();
  const overflow = [];

  for (const question of availableQuestions) {
    const groupId = question.equivalenceGroupId;
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

    if (selectedQuestions.length >= count) {
      break;
    }
  }

  if (selectedQuestions.length < count) {
    for (const question of overflow) {
      selectedQuestions.push(question);
      if (selectedQuestions.length >= count) {
        break;
      }
    }
  }

  return selectedQuestions;
};

const buildPairedPostTestQuestions = async ({
  pairedAssessmentId,
  trainingId,
  topicId,
  difficultyValue,
  count,
}) => {
  const pairedPreTest = await prisma.assessment.findUnique({
    where: { id: pairedAssessmentId },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: {
            include: {
              topic: true,
            },
          },
        },
      },
    },
  });

  if (!pairedPreTest) {
    return {
      error: "Paired assessment not found",
      status: 404,
    };
  }

  const preQuestions = pairedPreTest.questions
    .map((item) => item.question)
    .filter(Boolean);
  const preQuestionIds = preQuestions.map((question) => question.id);
  const seenGroupIds = new Set();
  const orderedGroupIds = [];

  for (const question of preQuestions) {
    const groupId = question.equivalenceGroupId;
    if (groupId === null || groupId === undefined || seenGroupIds.has(groupId)) {
      continue;
    }

    seenGroupIds.add(groupId);
    orderedGroupIds.push(groupId);
  }

  if (orderedGroupIds.length === 0) {
    return {
      error: "No equivalent approved questions are available for the selected paired PRE_TEST",
      status: 400,
    };
  }

  const candidates = await prisma.question.findMany({
    where: {
      status: "APPROVED",
      equivalenceGroupId: { in: orderedGroupIds },
      id: { notIn: preQuestionIds },
      topic: {
        trainingId: Number(trainingId),
      },
      ...(topicId !== undefined && { topicId: Number(topicId) }),
      ...(difficultyValue !== undefined && { difficulty: difficultyValue }),
    },
    orderBy: { id: "asc" },
  });

  const candidatesByGroupId = new Map();
  for (const candidate of candidates) {
    const groupId = candidate.equivalenceGroupId;
    if (groupId === null || groupId === undefined) {
      continue;
    }

    const list = candidatesByGroupId.get(groupId) ?? [];
    list.push(candidate);
    candidatesByGroupId.set(groupId, list);
  }

  const selectedQuestions = [];
  const usedQuestionIds = new Set();

  for (const question of preQuestions) {
    const groupId = question.equivalenceGroupId;
    if (groupId === null || groupId === undefined) {
      continue;
    }

    const candidate = (candidatesByGroupId.get(groupId) ?? []).find(
      (item) => item.id !== question.id && !usedQuestionIds.has(item.id)
    );

    if (!candidate) {
      continue;
    }

    usedQuestionIds.add(candidate.id);
    selectedQuestions.push(candidate);

    if (selectedQuestions.length >= count) {
      break;
    }
  }

  return { questions: selectedQuestions };
};

const createAssessment = async (req, res) => {
  try {
    const {
      title,
      description,
      trainingId,
      type = "QUIZ",
      questions,
      pairedAssessmentId,
      timeLimitMinutes,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "At least one question is required" });
    }

    if (!trainingId) {
      return res.status(400).json({ error: "trainingId is required" });
    }

    // Lastniška preverba ciljnega traininga (vzorec: POST /questions) — tuj/neobstoječ -> 404.
    if (!(await isTrainingOwner(req.user.id, trainingId))) {
      return res.status(404).json({ error: "Training not found" });
    }

    const questionItems = normalizeQuestionItems(questions);
    const validation = await validateQuestions(questionItems, trainingId);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const pairingValidation = await validatePairedAssessment({
      pairedAssessmentId,
      type,
      trainingId,
    });
    if (pairingValidation.error) {
      return res
        .status(pairingValidation.status ?? 400)
        .json({ error: pairingValidation.error });
    }

    const assessment = await prisma.assessment.create({
      data: {
        title: title.trim(),
        description,
        trainingId: Number(trainingId),
        type,
        status: "DRAFT",
        timeLimitMinutes: timeLimitMinutes !== undefined ? timeLimitMinutes : null,
        ...(pairingValidation.pairedAssessmentId !== undefined && {
          pairedAssessmentId: pairingValidation.pairedAssessmentId,
        }),
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
      type = "QUIZ",
      pairedAssessmentId,
      topicId,
      difficulty,
      count,
      timeLimitMinutes,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!trainingId) {
      return res.status(400).json({ error: "trainingId is required" });
    }

    // Lastniška preverba ciljnega traininga (vzorec: POST /questions) — tuj/neobstoječ -> 404.
    if (!(await isTrainingOwner(req.user.id, trainingId))) {
      return res.status(404).json({ error: "Training not found" });
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

    const pairingValidation = await validatePairedAssessment({
      pairedAssessmentId,
      type,
      trainingId,
    });
    if (pairingValidation.error) {
      return res
        .status(pairingValidation.status ?? 400)
        .json({ error: pairingValidation.error });
    }

    let selectedQuestions = [];

    if (type === "POST_TEST" && pairingValidation.pairedAssessmentId) {
      const equivalentSelection = await buildPairedPostTestQuestions({
        pairedAssessmentId: pairingValidation.pairedAssessmentId,
        trainingId,
        topicId,
        difficultyValue,
        count: parsedCount,
      });

      if (equivalentSelection.error) {
        return res
          .status(equivalentSelection.status ?? 400)
          .json({ error: equivalentSelection.error });
      }

      selectedQuestions = equivalentSelection.questions;

      if (selectedQuestions.length < parsedCount) {
        return res.status(400).json({
          error: `Only ${selectedQuestions.length} approved equivalent questions match the requested filters for the paired PRE_TEST`,
        });
      }
    } else {
      const questionWhere = {
        status: "APPROVED",
        topic: {
          trainingId: Number(trainingId),
        },
        ...(topicId !== undefined && { topicId: Number(topicId) }),
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

      selectedQuestions = buildGenericGeneratedQuestions(availableQuestions, parsedCount);

      if (selectedQuestions.length < parsedCount) {
        return res.status(400).json({
          error: `Only ${availableQuestions.length} approved questions match the requested filters`,
        });
      }
    }

    const assessment = await prisma.assessment.create({
      data: {
        title: title.trim(),
        description,
        trainingId: Number(trainingId),
        type,
        status: "DRAFT",
        timeLimitMinutes: timeLimitMinutes !== undefined ? timeLimitMinutes : null,
        ...(pairingValidation.pairedAssessmentId !== undefined && {
          pairedAssessmentId: pairingValidation.pairedAssessmentId,
        }),
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
    const {
      title,
      description,
      trainingId,
      type,
      questions,
      pairedAssessmentId,
      timeLimitMinutes,
    } = req.body;

    const existing = await prisma.assessment.findUnique({
      where: { id: Number(id) },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
        attempts: {
          where: {
            // GRADED je prav tako oddan (in že ocenjen) poskus — blokira urejanje enako.
            status: { in: ["SUBMITTED", "GRADED"] },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    if (existing.status !== "DRAFT") {
      return res.status(400).json({
        error: "Only DRAFT assessments can be edited",
      });
    }

    if (existing.attempts.length > 0) {
      return res.status(409).json({
        error: "Assessments with submitted attempts cannot be edited",
      });
    }

    // requireOwnership na routi pokrije OBSTOJEČI assessment; ob prestavitvi na
    // drug training mora klicatelj biti lastnik tudi ciljnega traininga.
    if (
      trainingId !== undefined &&
      Number(trainingId) !== existing.trainingId &&
      !(await isTrainingOwner(req.user.id, trainingId))
    ) {
      return res.status(404).json({ error: "Training not found" });
    }

    const effectiveTrainingId =
      trainingId !== undefined ? Number(trainingId) : existing.trainingId;
    const effectiveType = type !== undefined ? type : existing.type;
    const effectivePairedAssessmentId =
      pairedAssessmentId !== undefined ? pairedAssessmentId : existing.pairedAssessmentId;

    let questionUpdate = undefined;
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "At least one question is required" });
      }

      const questionItems = normalizeQuestionItems(questions);
      const validation = await validateQuestions(questionItems, effectiveTrainingId);
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
    } else if (trainingId !== undefined) {
      const questionItems = existing.questions.map((item) => ({
        questionId: item.questionId,
        points: item.points,
        orderIndex: item.orderIndex,
      }));
      const validation = await validateQuestions(questionItems, effectiveTrainingId);
      if (validation.error) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const pairingValidation = await validatePairedAssessment({
      pairedAssessmentId: effectivePairedAssessmentId,
      type: effectiveType,
      trainingId: effectiveTrainingId,
      assessmentId: existing.id,
    });
    if (pairingValidation.error) {
      return res
        .status(pairingValidation.status ?? 400)
        .json({ error: pairingValidation.error });
    }

    const assessment = await prisma.assessment.update({
      where: { id: Number(id) },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(trainingId !== undefined && { trainingId: Number(trainingId) }),
        ...(type !== undefined && { type }),
        ...(timeLimitMinutes !== undefined && { timeLimitMinutes }),
        ...(pairedAssessmentId !== undefined || existing.pairedAssessmentId !== null
          ? { pairedAssessmentId: pairingValidation.pairedAssessmentId ?? null }
          : {}),
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

const updateAssessmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ASSESSMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${ASSESSMENT_STATUSES.join(", ")}`,
      });
    }

    const existing = await prisma.assessment.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const assessment = await prisma.assessment.update({
      where: { id: Number(id) },
      data: {
        status,
      },
      include: assessmentDetailInclude,
    });

    res.json(assessment);
  } catch (error) {
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
  getAvailableAssessments,
  getAssessment,
  getAssessmentResults,
  createAssessment,
  generateAssessment,
  updateAssessment,
  updateAssessmentStatus,
  deleteAssessment,
};
