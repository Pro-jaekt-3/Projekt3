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

const isCompletedAttempt = {
  submittedAt: {
    not: null,
  },
  status: {
    in: ["SUBMITTED", "GRADED"],
  },
};

const getSeriesConfig = (blueprint) => {
  const config = blueprint?.configJson;

  if (!config || typeof config !== "object" || config.kind !== "PRE_POST_SERIES") {
    return null;
  }

  const preAssessmentId = Number(config.preAssessmentId);
  const postAssessmentId = Number(config.postAssessmentId);

  if (!Number.isInteger(preAssessmentId) || !Number.isInteger(postAssessmentId)) {
    return null;
  }

  return {
    ...config,
    preAssessmentId,
    postAssessmentId,
  };
};

const getCompletedAttemptsForAssessment = async (assessmentId) => {
  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      assessmentId,
      ...isCompletedAttempt,
      userId: {
        not: null,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      answers: {
        include: {
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
      },
    },
    orderBy: [
      {
        submittedAt: "desc",
      },
      {
        id: "desc",
      },
    ],
  });

  const byUser = new Map();

  for (const attempt of attempts) {
    if (!byUser.has(attempt.userId)) {
      byUser.set(attempt.userId, attempt);
    }
  }

  return byUser;
};

const summarizePairedAnswers = (pairedAttempts, groupGetter, initialGetter) => {
  const grouped = new Map();

  const addAnswers = (answers, side) => {
    for (const answer of answers) {
      const key = groupGetter(answer);

      if (key === null || key === undefined) {
        continue;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          ...initialGetter(answer),
          preScore: 0,
          preMaxScore: 0,
          postScore: 0,
          postMaxScore: 0,
        });
      }

      const entry = grouped.get(key);
      const awarded = Number(answer.pointsAwarded ?? 0);
      const possible = 1;

      if (side === "pre") {
        entry.preScore += awarded;
        entry.preMaxScore += possible;
      } else {
        entry.postScore += awarded;
        entry.postMaxScore += possible;
      }
    }
  };

  for (const pair of pairedAttempts) {
    addAnswers(pair.pre.answers, "pre");
    addAnswers(pair.post.answers, "post");
  }

  return [...grouped.values()]
    .map((entry) => {
      const prePercentage = toPercentage(entry.preScore, entry.preMaxScore);
      const postPercentage = toPercentage(entry.postScore, entry.postMaxScore);

      return {
        ...entry,
        prePercentage,
        postPercentage,
        improvement: roundToTwo(postPercentage - prePercentage),
      };
    })
    .map(({ preScore, preMaxScore, postScore, postMaxScore, ...entry }) => entry);
};

const summarizeQuestionStats = (pairedAttempts) => {
  const grouped = new Map();

  const addAnswer = (answer, side) => {
    const question = answer.question;
    const key = question.equivalentGroupId || `${side}:${question.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        equivalentGroupId: question.equivalentGroupId,
        topicName: question.topic?.name || null,
        learningObjectiveTitle: question.learningObjective?.title || null,
        difficulty: question.difficulty,
        preQuestionId: null,
        preQuestionTitle: null,
        postQuestionId: null,
        postQuestionTitle: null,
        preCorrectCount: 0,
        preAnswerCount: 0,
        postCorrectCount: 0,
        postAnswerCount: 0,
      });
    }

    const entry = grouped.get(key);

    if (side === "pre") {
      entry.preQuestionId = question.id;
      entry.preQuestionTitle = question.title;
      entry.preAnswerCount += 1;
      entry.preCorrectCount += answer.isCorrect === true ? 1 : 0;
    } else {
      entry.postQuestionId = question.id;
      entry.postQuestionTitle = question.title;
      entry.postAnswerCount += 1;
      entry.postCorrectCount += answer.isCorrect === true ? 1 : 0;
    }
  };

  for (const pair of pairedAttempts) {
    pair.pre.answers.forEach((answer) => addAnswer(answer, "pre"));
    pair.post.answers.forEach((answer) => addAnswer(answer, "post"));
  }

  return [...grouped.values()]
    .map((entry) => {
      const prePercentage = toPercentage(entry.preCorrectCount, entry.preAnswerCount);
      const postPercentage = toPercentage(entry.postCorrectCount, entry.postAnswerCount);

      return {
        equivalentGroupId: entry.equivalentGroupId,
        topicName: entry.topicName,
        learningObjectiveTitle: entry.learningObjectiveTitle,
        difficulty: entry.difficulty,
        preQuestion: entry.preQuestionId
          ? {
              id: entry.preQuestionId,
              title: entry.preQuestionTitle,
            }
          : null,
        postQuestion: entry.postQuestionId
          ? {
              id: entry.postQuestionId,
              title: entry.postQuestionTitle,
            }
          : null,
        preAnswerCount: entry.preAnswerCount,
        postAnswerCount: entry.postAnswerCount,
        prePercentage,
        postPercentage,
        improvement: roundToTwo(postPercentage - prePercentage),
      };
    })
    .sort((a, b) => {
      if (a.topicName !== b.topicName) {
        return String(a.topicName || "").localeCompare(String(b.topicName || ""));
      }

      return a.difficulty - b.difficulty;
    });
};

async function buildPrePostSeriesAnalytics(seriesId) {
  const parsedSeriesId = Number(seriesId);

  if (!Number.isInteger(parsedSeriesId) || parsedSeriesId <= 0) {
    const error = new Error("Series id must be a positive integer.");
    error.status = 400;
    throw error;
  }

  const blueprint = await prisma.assessmentBlueprint.findUnique({
    where: {
      id: parsedSeriesId,
    },
    include: {
      training: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  const config = getSeriesConfig(blueprint);

  if (!blueprint || !config) {
    const error = new Error("Pre/post series not found.");
    error.status = 404;
    throw error;
  }

  const [preAssessment, postAssessment] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: config.preAssessmentId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        trainingId: true,
      },
    }),
    prisma.assessment.findUnique({
      where: { id: config.postAssessmentId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        trainingId: true,
      },
    }),
  ]);

  if (!preAssessment || !postAssessment) {
    const error = new Error("Linked pre/post assessments are missing.");
    error.status = 404;
    throw error;
  }

  const [preAttemptsByUser, postAttemptsByUser] = await Promise.all([
    getCompletedAttemptsForAssessment(preAssessment.id),
    getCompletedAttemptsForAssessment(postAssessment.id),
  ]);

  const pairedAttempts = [];

  for (const [userId, pre] of preAttemptsByUser.entries()) {
    const post = postAttemptsByUser.get(userId);

    if (post) {
      pairedAttempts.push({ userId, pre, post });
    }
  }

  const participants = pairedAttempts
    .map(({ userId, pre, post }) => {
      const preScore = Number(pre.score ?? 0);
      const postScore = Number(post.score ?? 0);
      const preMaxScore = Number(pre.maxScore ?? 0);
      const postMaxScore = Number(post.maxScore ?? 0);
      const prePercentage = toPercentage(preScore, preMaxScore);
      const postPercentage = toPercentage(postScore, postMaxScore);

      return {
        userId,
        name: pre.user?.name || post.user?.name || "Unnamed participant",
        email: pre.user?.email || post.user?.email || null,
        preScore,
        postScore,
        improvement: roundToTwo(postScore - preScore),
        prePercentage,
        postPercentage,
        status:
          postScore > preScore
            ? "IMPROVED"
            : postScore === preScore
              ? "UNCHANGED"
              : "DECLINED",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const average = (items, getter) =>
    items.length > 0
      ? roundToTwo(items.reduce((total, item) => total + getter(item), 0) / items.length)
      : 0;

  const byTopic = summarizePairedAnswers(
    pairedAttempts,
    (answer) => answer.question.topic?.id,
    (answer) => ({
      topicId: answer.question.topic.id,
      topicName: answer.question.topic.name,
    })
  ).sort((a, b) => a.topicName.localeCompare(b.topicName));

  const byLearningObjective = summarizePairedAnswers(
    pairedAttempts,
    (answer) => answer.question.learningObjective?.id,
    (answer) => ({
      learningObjectiveId: answer.question.learningObjective.id,
      title: answer.question.learningObjective.title,
    })
  ).sort((a, b) => a.title.localeCompare(b.title));

  const byDifficulty = summarizePairedAnswers(
    pairedAttempts,
    (answer) => answer.question.difficulty,
    (answer) => ({
      difficulty: answer.question.difficulty,
    })
  ).sort((a, b) => a.difficulty - b.difficulty);

  const questionStats = summarizeQuestionStats(pairedAttempts);
  const strongestTopic = byTopic.length
    ? byTopic.reduce((best, item) =>
        item.postPercentage > best.postPercentage ? item : best
      ).topicName
    : null;
  const weakestPreTopic = byTopic.length
    ? byTopic.reduce((weakest, item) =>
        item.prePercentage < weakest.prePercentage ? item : weakest
      ).topicName
    : null;
  const mostImprovedTopic = byTopic.length
    ? byTopic.reduce((best, item) =>
        item.improvement > best.improvement ? item : best
      ).topicName
    : null;

  const summary = {
    participantCount: participants.length,
    averagePreScore: average(participants, (participant) => participant.preScore),
    averagePostScore: average(participants, (participant) => participant.postScore),
    averageImprovement: average(participants, (participant) => participant.improvement),
    averagePrePercentage: average(participants, (participant) => participant.prePercentage),
    averagePostPercentage: average(participants, (participant) => participant.postPercentage),
    averagePercentageImprovement: roundToTwo(
      average(participants, (participant) => participant.postPercentage) -
        average(participants, (participant) => participant.prePercentage)
    ),
    strongestTopic,
    weakestPreTopic,
    mostImprovedTopic,
  };

  return {
    series: {
      id: blueprint.id,
      title: blueprint.title,
      training: blueprint.training,
      seriesKey: config.seriesKey || null,
      description: config.description || blueprint.description,
      targetQuestionCount: blueprint.targetQuestionCount,
    },
    preAssessment,
    postAssessment,
    summary,
    participants,
    byTopic,
    byLearningObjective,
    byDifficulty,
    questionStats,
  };
}

const getPrePostSeries = async (req, res) => {
  try {
    const blueprints = await prisma.assessmentBlueprint.findMany({
      include: {
        training: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        title: "asc",
      },
    });

    const seriesBlueprints = blueprints.filter((blueprint) => getSeriesConfig(blueprint));
    const result = [];

    for (const blueprint of seriesBlueprints) {
      const detail = await buildPrePostSeriesAnalytics(blueprint.id);

      result.push({
        id: detail.series.id,
        title: detail.series.title,
        training: detail.series.training,
        seriesKey: detail.series.seriesKey,
        preAssessment: detail.preAssessment,
        postAssessment: detail.postAssessment,
        participantCount: detail.summary.participantCount,
        averagePreScore: detail.summary.averagePreScore,
        averagePostScore: detail.summary.averagePostScore,
        averageImprovement: detail.summary.averageImprovement,
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPrePostSeriesDetail = async (req, res) => {
  try {
    const detail = await buildPrePostSeriesAnalytics(req.params.id);

    res.json(detail);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
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
  getPrePostSeries,
  getPrePostSeriesDetail,
  getWorstQuestions,
  getQuestionAnalytics,
  buildPrePostSeriesAnalytics,
};
