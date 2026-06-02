const prisma = require("../prisma/client");

const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const toPercentage = (score, maxScore) => {
  if (!maxScore) {
    return 0;
  }

  return roundToTwo((score / maxScore) * 100);
};

const difficultyLabelMap = {
  1: "EASY",
  2: "MEDIUM",
  3: "HARD",
};

const getDifficultyLabel = (difficulty) => difficultyLabelMap[difficulty] || `LEVEL_${difficulty}`;

const getPointsMap = (assessmentQuestions) => {
  const pointsMap = new Map();

  for (const assessmentQuestion of assessmentQuestions) {
    pointsMap.set(
      `${assessmentQuestion.assessmentId}:${assessmentQuestion.questionId}`,
      Number(assessmentQuestion.points ?? 1)
    );
  }

  return pointsMap;
};

const getSubmittedAnswersWithPoints = async () => {
  const answers = await prisma.participantAnswer.findMany({
    where: {
      attempt: {
        submittedAt: {
          not: null,
        },
      },
    },
    include: {
      attempt: {
        select: {
          id: true,
          assessmentId: true,
          assessment: {
            select: {
              type: true,
            },
          },
        },
      },
      question: {
        include: {
          topic: {
            select: {
              id: true,
              name: true,
            },
          },
          learningObjective: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const assessmentIds = [...new Set(answers.map((answer) => answer.attempt.assessmentId))];

  if (assessmentIds.length === 0) {
    return [];
  }

  const assessmentQuestions = await prisma.assessmentQuestion.findMany({
    where: {
      assessmentId: {
        in: assessmentIds,
      },
    },
    select: {
      assessmentId: true,
      questionId: true,
      points: true,
    },
  });

  const pointsMap = getPointsMap(assessmentQuestions);

  return answers.map((answer) => ({
    ...answer,
    possiblePoints: pointsMap.get(`${answer.attempt.assessmentId}:${answer.questionId}`) ?? 1,
    awardedPoints: Number(answer.pointsAwarded ?? 0),
  }));
};

const buildGroupedAnalytics = (answers, getGroupKey, getInitialEntry) => {
  const grouped = new Map();

  for (const answer of answers) {
    const groupKey = getGroupKey(answer);

    if (groupKey === null || groupKey === undefined) {
      continue;
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        ...getInitialEntry(answer),
        attemptIds: new Set(),
        answerCount: 0,
        score: 0,
        maxScore: 0,
      });
    }

    const entry = grouped.get(groupKey);
    entry.attemptIds.add(answer.attemptId);
    entry.answerCount += 1;
    entry.score += answer.awardedPoints;
    entry.maxScore += answer.possiblePoints;
  }

  return [...grouped.values()].map((entry) => ({
    ...entry,
    attemptCount: entry.attemptIds.size,
    percentage: toPercentage(entry.score, entry.maxScore),
  })).map(({ attemptIds, ...entry }) => entry);
};

const getAnalyticsByTopic = async (req, res) => {
  try {
    const answers = await getSubmittedAnswersWithPoints();

    const result = buildGroupedAnalytics(
      answers,
      (answer) => answer.question.topic?.id,
      (answer) => ({
        topicId: answer.question.topic.id,
        topicTitle: answer.question.topic.name,
      })
    ).sort((a, b) => a.topicTitle.localeCompare(b.topicTitle));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAnalyticsByLearningObjective = async (req, res) => {
  try {
    const answers = await getSubmittedAnswersWithPoints();

    const result = buildGroupedAnalytics(
      answers,
      (answer) => answer.question.learningObjective?.id,
      (answer) => ({
        learningObjectiveId: answer.question.learningObjective.id,
        learningObjectiveTitle: answer.question.learningObjective.title,
      })
    ).sort((a, b) => a.learningObjectiveTitle.localeCompare(b.learningObjectiveTitle));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAnalyticsByDifficulty = async (req, res) => {
  try {
    const answers = await getSubmittedAnswersWithPoints();

    const result = buildGroupedAnalytics(
      answers,
      (answer) => answer.question.difficulty,
      (answer) => ({
        difficulty: getDifficultyLabel(answer.question.difficulty),
        difficultyValue: answer.question.difficulty,
      })
    )
      .sort((a, b) => a.difficultyValue - b.difficultyValue)
      .map(({ difficultyValue, ...entry }) => entry);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPrePostComparison = async (req, res) => {
  try {
    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        submittedAt: {
          not: null,
        },
        assessment: {
          type: {
            in: ["PRE_TEST", "POST_TEST"],
          },
        },
      },
      select: {
        score: true,
        maxScore: true,
        assessment: {
          select: {
            type: true,
          },
        },
      },
    });

    const summary = {
      PRE_TEST: {
        attemptCount: 0,
        percentageTotal: 0,
      },
      POST_TEST: {
        attemptCount: 0,
        percentageTotal: 0,
      },
    };

    for (const attempt of attempts) {
      const type = attempt.assessment.type;
      const percentage = toPercentage(Number(attempt.score ?? 0), Number(attempt.maxScore ?? 0));

      summary[type].attemptCount += 1;
      summary[type].percentageTotal += percentage;
    }

    const preAverage =
      summary.PRE_TEST.attemptCount > 0
        ? roundToTwo(summary.PRE_TEST.percentageTotal / summary.PRE_TEST.attemptCount)
        : 0;
    const postAverage =
      summary.POST_TEST.attemptCount > 0
        ? roundToTwo(summary.POST_TEST.percentageTotal / summary.POST_TEST.attemptCount)
        : 0;

    res.json({
      preTest: {
        attemptCount: summary.PRE_TEST.attemptCount,
        averagePercentage: preAverage,
      },
      postTest: {
        attemptCount: summary.POST_TEST.attemptCount,
        averagePercentage: postAverage,
      },
      improvement: roundToTwo(postAverage - preAverage),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWorstQuestions = async (req, res) => {
  try {
    const parsedLimit = Number(req.query.limit);
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;

    const answers = await getSubmittedAnswersWithPoints();
    const grouped = new Map();

    for (const answer of answers) {
      const questionId = answer.questionId;

      if (!grouped.has(questionId)) {
        grouped.set(questionId, {
          questionId,
          questionText: answer.question.title,
          answerCount: 0,
          score: 0,
          maxScore: 0,
        });
      }

      const entry = grouped.get(questionId);
      entry.answerCount += 1;
      entry.score += answer.awardedPoints;
      entry.maxScore += answer.possiblePoints;
    }

    const result = [...grouped.values()]
      .map((entry) => ({
        ...entry,
        percentage: toPercentage(entry.score, entry.maxScore),
      }))
      .sort((a, b) => {
        if (a.percentage !== b.percentage) {
          return a.percentage - b.percentage;
        }

        return b.answerCount - a.answerCount;
      })
      .slice(0, limit);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getQuestionAnalytics = async (req, res) => {
  try {
    const parsedLimit = Number(req.query.limit);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
    const sort = req.query.sort;

    const answers = await getSubmittedAnswersWithPoints();
    const grouped = new Map();

    for (const answer of answers) {
      const questionId = answer.questionId;

      if (!grouped.has(questionId)) {
        grouped.set(questionId, {
          questionId,
          questionText: answer.question.title,
          answerCount: 0,
          correctCount: 0,
          totalPoints: 0,
        });
      }

      const entry = grouped.get(questionId);
      entry.answerCount += 1;
      entry.correctCount += answer.isCorrect === true ? 1 : 0;
      entry.totalPoints += answer.awardedPoints;
    }

    let result = [...grouped.values()].map((entry) => ({
      questionId: entry.questionId,
      questionText: entry.questionText,
      answerCount: entry.answerCount,
      correctCount: entry.correctCount,
      correctPercentage: toPercentage(entry.correctCount, entry.answerCount),
      averagePoints: entry.answerCount > 0 ? roundToTwo(entry.totalPoints / entry.answerCount) : 0,
    }));

    if (sort === "worst") {
      result = result.sort((a, b) => {
        if (a.correctPercentage !== b.correctPercentage) {
          return a.correctPercentage - b.correctPercentage;
        }

        if (a.averagePoints !== b.averagePoints) {
          return a.averagePoints - b.averagePoints;
        }

        return b.answerCount - a.answerCount;
      });
    } else {
      result = result.sort((a, b) => a.questionId - b.questionId);
    }

    if (limit !== null) {
      result = result.slice(0, limit);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAnalyticsByTopic,
  getAnalyticsByLearningObjective,
  getAnalyticsByDifficulty,
  getPrePostComparison,
  getWorstQuestions,
  getQuestionAnalytics,
};
