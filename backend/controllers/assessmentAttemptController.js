const prisma = require("../prisma/client");
const { isTrainingOwner } = require("../middleware/scopeMiddleware");

const attemptResponseInclude = {
  assessment: {
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: {
            include: {
              answerOptions: { orderBy: { orderIndex: "asc" } },
            },
          },
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

// Matrika vlog (handoff_dev2_dev3): lastnik poskusa vedno; INSTRUCTOR samo za
// poskuse na assessmentih SVOJIH treningov (UserTraining ownership); ADMIN ni
// content-collaborator in tujih poskusov ne vidi.
const canAccessAttempt = async (attempt, user) => {
  if (!attempt || !user) {
    return false;
  }

  if (attempt.userId === user.id) {
    return true;
  }

  if (user.role !== "INSTRUCTOR") {
    return false;
  }

  const trainingId = attempt.assessment?.trainingId;

  if (!trainingId) {
    return false;
  }

  return isTrainingOwner(user.id, trainingId);
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

    const assessment = req.enrolledAssessment;

    if (!assessment || assessment.id !== assessmentId) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    // En poskus na assessment na uporabnika (odločitev D). findFirst namesto
    // findUnique: compound @@unique([assessmentId, userId]) je v FAZI 0 namenoma
    // izpuščen (dedup pride s cutoverom), zato selector assessmentId_userId v
    // klientu ne obstaja; findFirst deluje zdaj in ostane pravilen po cutoveru.
    const existingAttempt = await prisma.assessmentAttempt.findFirst({
      where: {
        assessmentId,
        userId: participantId,
      },
    });

    if (existingAttempt) {
      return res.status(409).json({
        error: "You already have an attempt for this assessment",
      });
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

// Skupna logika zaključka poskusa (invarianta NOTES §5.6): če po zapisu
// odgovorov NOBEN odgovor poskusa ne čaka ročne ocene (needsManualReview),
// je poskus v celoti ocenjen -> status=GRADED + score iz vsote pointsAwarded.
// Kliče se iz submitAttempt (MC-only poskusi so GRADED takoj ob oddaji) in iz
// gradeAnswer (mešani poskusi po zadnji ročni oceni). Vrne Prisma data
// fragment za assessmentAttempt.update ({} = še čaka ročno oceno).
const finalizeAttemptIfFullyGraded = async (tx, attemptId) => {
  const pendingCount = await tx.participantAnswer.count({
    where: { attemptId, needsManualReview: true },
  });

  if (pendingCount > 0) {
    return {};
  }

  const gradedAnswers = await tx.participantAnswer.findMany({
    where: { attemptId },
    select: { pointsAwarded: true },
  });

  return {
    status: "GRADED",
    score: gradedAnswers.reduce(
      (total, entry) => total + (entry.pointsAwarded ?? 0),
      0
    ),
  };
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

    if (!(await canAccessAttempt(attempt, req.user))) {
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

      // SUBMITTED = čaka ročno oceno; MC-only poskus je ob oddaji že v celoti
      // samodejno ocenjen, zato ga finalize takoj prepiše v GRADED.
      const finalizeData = await finalizeAttemptIfFullyGraded(tx, attemptId);

      return tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          score,
          maxScore,
          ...finalizeData,
        },
        include: attemptResponseInclude,
      });
    });

    res.json(serializeAttempt(updatedAttempt));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /assessment-attempts/:attemptId/answers/:answerId/grade
// Ročno ocenjevanje OPEN/CODE odgovorov (odločitev C, invarianta NOTES §5.6).
// Samo INSTRUCTOR-lastnik pripadajočega traininga (tuj/neobstoječ resource -> 404).
// Ko po oceni noben odgovor poskusa ne čaka pregleda, se poskus zaključi:
// status=GRADED + preračun score iz vsote pointsAwarded.
const gradeAnswer = async (req, res) => {
  try {
    const attemptId = parseId(req.params.attemptId);
    const answerId = parseId(req.params.answerId);
    const { isCorrect, pointsAwarded } = req.body ?? {};

    if (!attemptId || !answerId) {
      return res
        .status(400)
        .json({ error: "attemptId and answerId must be positive integers" });
    }

    if (typeof isCorrect !== "boolean") {
      return res.status(400).json({ error: "isCorrect must be a boolean" });
    }

    const answer = await prisma.participantAnswer.findUnique({
      where: { id: answerId },
      include: {
        question: { select: { type: true } },
        attempt: {
          include: {
            assessment: {
              select: {
                trainingId: true,
                questions: { select: { questionId: true, points: true } },
              },
            },
          },
        },
      },
    });

    if (!answer || answer.attemptId !== attemptId) {
      return res.status(404).json({ error: "Attempt answer not found" });
    }

    const owner = await isTrainingOwner(req.user.id, answer.attempt.assessment.trainingId);

    if (!owner) {
      // 404-namesto-403 konvencija: tujega resource-a ne razkrivamo.
      return res.status(404).json({ error: "Attempt answer not found" });
    }

    if (answer.attempt.status === "IN_PROGRESS") {
      return res.status(400).json({ error: "Attempt has not been submitted yet" });
    }

    if (answer.question.type === "MULTIPLE_CHOICE") {
      return res
        .status(400)
        .json({ error: "MULTIPLE_CHOICE answers are graded automatically" });
    }

    const questionPoints = Number(
      answer.attempt.assessment.questions.find(
        (item) => item.questionId === answer.questionId
      )?.points ?? 1
    );

    let awarded;
    if (pointsAwarded === undefined || pointsAwarded === null) {
      awarded = isCorrect ? questionPoints : 0;
    } else {
      awarded = Number(pointsAwarded);
      if (!Number.isFinite(awarded) || awarded < 0 || awarded > questionPoints) {
        return res.status(400).json({
          error: `pointsAwarded must be a number between 0 and ${questionPoints}`,
        });
      }
    }

    const updatedAttempt = await prisma.$transaction(async (tx) => {
      await tx.participantAnswer.update({
        where: { id: answerId },
        data: {
          isCorrect,
          pointsAwarded: awarded,
          needsManualReview: false,
          gradedById: Number(req.user.id),
          gradedAt: new Date(),
        },
      });

      const attemptData = await finalizeAttemptIfFullyGraded(tx, attemptId);

      return tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: attemptData,
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

    if (!(await canAccessAttempt(attempt, req.user))) {
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
  gradeAnswer,
  getAttempt,
};
