const prisma = require("../prisma/client");
const { instructorTrainingIds } = require("../middleware/scopeMiddleware");

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

const difficultyLabelToValue = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

const getDifficultyLabel = (difficulty) => difficultyLabelMap[difficulty] || `LEVEL_${difficulty}`;

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// Accepts a numeric difficulty (1/2/3) or a label (EASY/MEDIUM/HARD).
const parseDifficulty = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }

  const label = String(value).trim().toUpperCase();
  return difficultyLabelToValue[label] ?? null;
};

// Shared, backward-compatible filter parsing for the analytics endpoints.
// Every field is optional; absent/invalid values become null and are ignored.
const parseAnalyticsFilters = (query = {}) => ({
  trainingId: parsePositiveInt(query.trainingId),
  topicId: parsePositiveInt(query.topicId),
  difficulty: parseDifficulty(query.difficulty),
  questionId: parsePositiveInt(query.questionId),
  participantId: parsePositiveInt(query.participantId ?? query.userId),
  assessmentId: parsePositiveInt(query.assessmentId),
});

const resolveScopedTrainingIds = async (user, requestedTrainingId = null) => {
  const ownedTrainingIds = await instructorTrainingIds(user.id);

  if (requestedTrainingId) {
    return ownedTrainingIds.includes(requestedTrainingId) ? [requestedTrainingId] : [];
  }

  return ownedTrainingIds;
};

const withScopedAnalyticsFilters = async (req, filters = {}) => ({
  ...filters,
  trainingIds: await resolveScopedTrainingIds(req.user, filters.trainingId ?? null),
});

// Builds a Prisma `where` for ParticipantAnswer limited to SUBMITTED attempts,
// optionally narrowed by the shared analytics filters. With no filters this is
// exactly the original `{ attempt: { submittedAt: { not: null } } }`.
const buildSubmittedAnswerWhere = (filters = {}) => {
  const attempt = { submittedAt: { not: null } };

  if (filters.assessmentId) {
    attempt.assessmentId = filters.assessmentId;
  }
  if (filters.participantId) {
    attempt.userId = filters.participantId;
  }
  if (Array.isArray(filters.trainingIds)) {
    attempt.assessment = {
      ...(attempt.assessment ?? {}),
      trainingId: { in: filters.trainingIds },
    };
  } else if (filters.trainingId) {
    attempt.assessment = {
      ...(attempt.assessment ?? {}),
      trainingId: filters.trainingId,
    };
  }

  const where = { attempt };

  if (filters.questionId) {
    where.questionId = filters.questionId;
  }

  const question = {};
  if (filters.topicId) {
    question.topicId = filters.topicId;
  }
  if (filters.difficulty) {
    question.difficulty = filters.difficulty;
  }
  if (Object.keys(question).length > 0) {
    where.question = question;
  }

  return where;
};

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

// Optional `filters` narrows the submitted answers (backward-compatible: no args
// reproduces the original global query used by the existing breakdown endpoints).
const getSubmittedAnswersWithPoints = async (filters = {}) => {
  const answers = await prisma.participantAnswer.findMany({
    where: buildSubmittedAnswerWhere(filters),
    include: {
      attempt: {
        select: {
          id: true,
          assessmentId: true,
          userId: true,
          assessment: {
            select: {
              type: true,
              trainingId: true,
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

// Correctness breakdown computed ONLY over MULTIPLE_CHOICE answers
// (OPEN/CODE are not auto-graded). Used by the per-user profile.
const buildMcCorrectnessBreakdown = (answers, getGroupKey, getInitialEntry) => {
  const grouped = new Map();

  for (const answer of answers) {
    if (answer.question.type !== "MULTIPLE_CHOICE") {
      continue;
    }

    const groupKey = getGroupKey(answer);

    if (groupKey === null || groupKey === undefined) {
      continue;
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        ...getInitialEntry(answer),
        answerCount: 0,
        correctCount: 0,
      });
    }

    const entry = grouped.get(groupKey);
    entry.answerCount += 1;
    if (answer.isCorrect === true) {
      entry.correctCount += 1;
    }
  }

  return [...grouped.values()].map((entry) => ({
    ...entry,
    correctPercentage: toPercentage(entry.correctCount, entry.answerCount),
  }));
};

const getAnalyticsByTopic = async (req, res) => {
  try {
    const filters = await withScopedAnalyticsFilters(req, parseAnalyticsFilters(req.query));
    const answers = await getSubmittedAnswersWithPoints(filters);

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

const getAnalyticsByDifficulty = async (req, res) => {
  try {
    const filters = await withScopedAnalyticsFilters(req, parseAnalyticsFilters(req.query));
    const answers = await getSubmittedAnswersWithPoints(filters);

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

// PAIRED pre/post computation. Each user's LATEST submitted PRE and LATEST
// submitted POST attempt are paired; only users who have BOTH are kept.
// Per-user improvement = post% - pre%; averages are taken over the PAIRED set,
// so improvement === postAvg - preAvg === average(per-user improvement).
// Optional filters narrow the attempts:
//  - trainingId: only assessments belonging to that training
//  - preAssessmentId / postAssessmentId: only those specific assessments
const computePairedPrePost = async ({
  trainingId,
  trainingIds,
  preAssessmentId,
  postAssessmentId,
} = {}) => {
  const assessmentFilter = {
    type: {
      in: ["PRE_TEST", "POST_TEST"],
    },
  };

  if (Array.isArray(trainingIds)) {
    assessmentFilter.trainingId = { in: trainingIds };
  } else if (Number.isInteger(trainingId) && trainingId > 0) {
    assessmentFilter.trainingId = trainingId;
  }

  const explicitIds = [preAssessmentId, postAssessmentId].filter(
    (value) => Number.isInteger(value) && value > 0
  );

  if (explicitIds.length > 0) {
    assessmentFilter.id = { in: explicitIds };
  }

  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      submittedAt: {
        not: null,
      },
      userId: {
        not: null,
      },
      assessment: assessmentFilter,
    },
    select: {
      userId: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      assessment: {
        select: {
          type: true,
        },
      },
    },
    // Ascending so the LAST write per (user, type) is the latest submission.
    orderBy: { submittedAt: "asc" },
  });

  const perUser = new Map();

  for (const attempt of attempts) {
    if (!perUser.has(attempt.userId)) {
      perUser.set(attempt.userId, { pre: null, post: null });
    }

    const slot = perUser.get(attempt.userId);
    const percentage = toPercentage(Number(attempt.score ?? 0), Number(attempt.maxScore ?? 0));

    if (attempt.assessment.type === "PRE_TEST") {
      slot.pre = percentage;
    } else if (attempt.assessment.type === "POST_TEST") {
      slot.post = percentage;
    }
  }

  const pairs = [];

  for (const [userId, slot] of perUser) {
    if (slot.pre !== null && slot.post !== null) {
      pairs.push({
        userId,
        prePct: slot.pre,
        postPct: slot.post,
        improvement: roundToTwo(slot.post - slot.pre),
      });
    }
  }

  const pairedUserCount = pairs.length;
  const preAverage =
    pairedUserCount > 0
      ? roundToTwo(pairs.reduce((sum, pair) => sum + pair.prePct, 0) / pairedUserCount)
      : 0;
  const postAverage =
    pairedUserCount > 0
      ? roundToTwo(pairs.reduce((sum, pair) => sum + pair.postPct, 0) / pairedUserCount)
      : 0;

  return {
    pairs,
    pairedUserCount,
    preTest: {
      attemptCount: pairedUserCount,
      averagePercentage: preAverage,
    },
    postTest: {
      attemptCount: pairedUserCount,
      averagePercentage: postAverage,
    },
    improvement: roundToTwo(postAverage - preAverage),
  };
};

// Public, backward-compatible shape used by BOTH /analytics/pre-post-comparison
// and /ai/pre-post-insights. Keeps { preTest, postTest, improvement } and ADDS
// pairedUserCount. Note: attemptCount now reflects the number of PAIRED users
// (one PRE + one POST each), and the averages are over the PAIRED set.
const computePrePostComparison = async (filters = {}) => {
  const { preTest, postTest, improvement, pairedUserCount } = await computePairedPrePost(filters);
  return { preTest, postTest, improvement, pairedUserCount };
};

const getPrePostComparison = async (req, res) => {
  try {
    const source = await withScopedAnalyticsFilters(req, { ...req.query });
    const result = await computePrePostComparison({
      trainingId: parsePositiveInt(source.trainingId),
      trainingIds: source.trainingIds,
      preAssessmentId: parsePositiveInt(source.preAssessmentId),
      postAssessmentId: parsePositiveInt(source.postAssessmentId),
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWorstQuestions = async (req, res) => {
  try {
    const parsedLimit = Number(req.query.limit);
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;

    const filters = await withScopedAnalyticsFilters(req, parseAnalyticsFilters(req.query));
    const answers = await getSubmittedAnswersWithPoints(filters);
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

    const filters = await withScopedAnalyticsFilters(req, parseAnalyticsFilters(req.query));
    const answers = await getSubmittedAnswersWithPoints(filters);
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

// ---------------------------------------------------------------------------
// Phase 3 advanced analytics (INSTRUCTOR only, all backward-compatible).
// ---------------------------------------------------------------------------

// Overall summary that honors the shared filters (drill-down item 1 + 7).
const getAnalyticsSummary = async (req, res) => {
  try {
    const filters = await withScopedAnalyticsFilters(req, parseAnalyticsFilters(req.query));
    const answers = await getSubmittedAnswersWithPoints(filters);

    let score = 0;
    let maxScore = 0;
    let mcCount = 0;
    let mcCorrect = 0;
    const attemptIds = new Set();
    const participantIds = new Set();

    for (const answer of answers) {
      score += answer.awardedPoints;
      maxScore += answer.possiblePoints;
      attemptIds.add(answer.attemptId);

      if (answer.attempt.userId !== null && answer.attempt.userId !== undefined) {
        participantIds.add(answer.attempt.userId);
      }

      if (answer.question.type === "MULTIPLE_CHOICE") {
        mcCount += 1;
        if (answer.isCorrect === true) {
          mcCorrect += 1;
        }
      }
    }

    res.json({
      filters,
      answerCount: answers.length,
      attemptCount: attemptIds.size,
      participantCount: participantIds.size,
      averageScorePercentage: toPercentage(score, maxScore),
      multipleChoice: {
        answerCount: mcCount,
        correctCount: mcCorrect,
        correctPercentage: toPercentage(mcCorrect, mcCount),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const STRONG_AREA_THRESHOLD = 70;
const WEAK_AREA_THRESHOLD = 50;

// Per-user profile (item 2). INSTRUCTOR only; identity is included inside owned-training scope.
const getParticipantProfile = async (req, res) => {
  try {
    const userId = parsePositiveInt(req.params.userId);

    if (!userId) {
      return res.status(400).json({ error: "Invalid participant id" });
    }

    const trainingIds = await resolveScopedTrainingIds(req.user);

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        assessmentAttempts: {
          some: {
            submittedAt: { not: null },
            assessment: {
              trainingId: { in: trainingIds },
            },
          },
        },
      },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        userId,
        submittedAt: { not: null },
        assessment: {
          trainingId: { in: trainingIds },
        },
      },
      select: {
        id: true,
        score: true,
        maxScore: true,
        startedAt: true,
        submittedAt: true,
        assessment: {
          select: { id: true, title: true, type: true, trainingId: true },
        },
      },
      orderBy: { submittedAt: "asc" },
    });

    const assessments = attempts.map((attempt) => ({
      attemptId: attempt.id,
      assessmentId: attempt.assessment.id,
      assessmentTitle: attempt.assessment.title,
      assessmentType: attempt.assessment.type,
      trainingId: attempt.assessment.trainingId,
      score: Number(attempt.score ?? 0),
      maxScore: Number(attempt.maxScore ?? 0),
      percentage: toPercentage(Number(attempt.score ?? 0), Number(attempt.maxScore ?? 0)),
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeTakenSeconds:
        attempt.startedAt && attempt.submittedAt
          ? Math.max(
              0,
              Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 1000)
            )
          : null,
    }));

    // Latest submitted PRE / POST for this user (attempts are ordered asc).
    const latestOfType = (type) => {
      const matches = attempts.filter((attempt) => attempt.assessment.type === type);
      return matches.length > 0 ? matches[matches.length - 1] : null;
    };

    const preAttempt = latestOfType("PRE_TEST");
    const postAttempt = latestOfType("POST_TEST");
    const prePct = preAttempt
      ? toPercentage(Number(preAttempt.score ?? 0), Number(preAttempt.maxScore ?? 0))
      : null;
    const postPct = postAttempt
      ? toPercentage(Number(postAttempt.score ?? 0), Number(postAttempt.maxScore ?? 0))
      : null;
    const hasBoth = prePct !== null && postPct !== null;

    // Strong/weak areas (MULTIPLE_CHOICE only).
    const mcAnswers = await getSubmittedAnswersWithPoints({
      participantId: userId,
      trainingIds,
    });

    const topicPerformance = buildMcCorrectnessBreakdown(
      mcAnswers,
      (answer) => answer.question.topic?.id,
      (answer) => ({
        topicId: answer.question.topic.id,
        topicTitle: answer.question.topic.name,
      })
    ).sort(
      (a, b) => b.correctPercentage - a.correctPercentage || a.topicTitle.localeCompare(b.topicTitle)
    );

    res.json({
      user,
      prePost: {
        prePct,
        postPct,
        improvement: hasBoth ? roundToTwo(postPct - prePct) : null,
        hasBoth,
      },
      assessments,
      topicPerformance,
      strongAreas: {
        topics: topicPerformance.filter((t) => t.correctPercentage >= STRONG_AREA_THRESHOLD),
      },
      weakAreas: {
        topics: topicPerformance.filter((t) => t.correctPercentage < WEAK_AREA_THRESHOLD),
      },
      note: "Strong/weak areas and prePost use SUBMITTED attempts; correctness is computed over MULTIPLE_CHOICE answers only (OPEN/CODE are not auto-graded).",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Per-user improvement list for the progress table (item 3). INSTRUCTOR only;
// identity is intentionally included (this is NOT the anonymized leaderboard).
const getParticipantImprovements = async (req, res) => {
  try {
    const rawFilters = {
      trainingId: parsePositiveInt(req.query.trainingId),
      preAssessmentId: parsePositiveInt(req.query.preAssessmentId),
      postAssessmentId: parsePositiveInt(req.query.postAssessmentId),
    };

    const filters = {
      ...rawFilters,
      trainingIds: await resolveScopedTrainingIds(req.user, rawFilters.trainingId),
    };

    const { pairs, pairedUserCount } = await computePairedPrePost(filters);

    const userIds = pairs.map((pair) => pair.userId);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    const participants = pairs
      .map((pair) => ({
        user: userMap.get(pair.userId) || { id: pair.userId, name: null, email: null },
        prePct: pair.prePct,
        postPct: pair.postPct,
        improvement: pair.improvement,
      }))
      .sort((a, b) => b.improvement - a.improvement);

    res.json({
      filters: {
        trainingId: filters.trainingId,
        preAssessmentId: filters.preAssessmentId,
        postAssessmentId: filters.postAssessmentId,
      },
      pairedUserCount,
      participants,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Leaderboard (item 4). PRIVACY: anonymized by default. Names/emails are revealed
// ONLY when reveal=true AND the caller is INSTRUCTOR (re-checked here).
// No PII is ever accepted via the query string.
const getLeaderboard = async (req, res) => {
  try {
    const trainingId = parsePositiveInt(req.query.trainingId);
    const assessmentId = parsePositiveInt(req.query.assessmentId);
    const parsedLimit = Number(req.query.limit);
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 20;
    const trainingIds = await resolveScopedTrainingIds(req.user, trainingId);

    const revealRequested = req.query.reveal === "true" || req.query.reveal === "1";
    const callerRole = req.user?.role;
    const callerCanReveal = callerRole === "INSTRUCTOR";
    const revealed = revealRequested && callerCanReveal;

    const where = { submittedAt: { not: null }, userId: { not: null } };
    if (assessmentId) {
      where.assessmentId = assessmentId;
    }
    where.assessment = {
      ...(where.assessment ?? {}),
      trainingId: Array.isArray(trainingIds) ? { in: trainingIds } : trainingId,
    };

    const select = {
      id: true,
      userId: true,
      score: true,
      maxScore: true,
      submittedAt: true,
    };
    if (revealed) {
      select.user = { select: { name: true, email: true } };
    }

    const attempts = await prisma.assessmentAttempt.findMany({ where, select });

    // Best (highest %) submitted attempt per user; ties broken by latest submission.
    const best = new Map();
    for (const attempt of attempts) {
      const percentage = toPercentage(Number(attempt.score ?? 0), Number(attempt.maxScore ?? 0));
      const prev = best.get(attempt.userId);

      if (
        !prev ||
        percentage > prev.percentage ||
        (percentage === prev.percentage && new Date(attempt.submittedAt) > new Date(prev.submittedAt))
      ) {
        best.set(attempt.userId, {
          userId: attempt.userId,
          percentage,
          score: Number(attempt.score ?? 0),
          maxScore: Number(attempt.maxScore ?? 0),
          submittedAt: attempt.submittedAt,
          name: attempt.user?.name ?? null,
          email: attempt.user?.email ?? null,
        });
      }
    }

    const ranked = [...best.values()]
      .sort(
        (a, b) =>
          b.percentage - a.percentage || new Date(b.submittedAt) - new Date(a.submittedAt)
      )
      .slice(0, limit);

    const items = ranked.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      label: `Participant #${index + 1}`,
      scorePercentage: entry.percentage,
      score: entry.score,
      maxScore: entry.maxScore,
      submittedAt: entry.submittedAt,
      ...(revealed ? { name: entry.name, email: entry.email } : {}),
    }));

    res.json({
      scope: { trainingId, assessmentId },
      revealed,
      anonymized: !revealed,
      count: items.length,
      items,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pad2 = (value) => String(value).padStart(2, "0");

const getDateBucketKey = (date, granularity) => {
  const parsed = new Date(date);
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();

  if (granularity === "month") {
    return `${year}-${pad2(month + 1)}`;
  }

  if (granularity === "week") {
    // Monday-based week start (UTC).
    const weekStart = new Date(Date.UTC(year, month, day));
    const mondayOffset = (weekStart.getUTCDay() + 6) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
    return `${weekStart.getUTCFullYear()}-${pad2(weekStart.getUTCMonth() + 1)}-${pad2(weekStart.getUTCDate())}`;
  }

  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
};

// Trends over time (item 5). Achievement by submission date plus per-type
// (PRE/POST) averages over time. Honors training/assessment/participant filters.
const getTrends = async (req, res) => {
  try {
    const trainingId = parsePositiveInt(req.query.trainingId);
    const assessmentId = parsePositiveInt(req.query.assessmentId);
    const participantId = parsePositiveInt(req.query.participantId ?? req.query.userId);

    const requestedGranularity = String(req.query.granularity || "day").toLowerCase();
    const granularity = ["day", "week", "month"].includes(requestedGranularity)
      ? requestedGranularity
      : "day";
    const trainingIds = await resolveScopedTrainingIds(req.user, trainingId);

    const where = { submittedAt: { not: null } };
    if (assessmentId) {
      where.assessmentId = assessmentId;
    }
    if (participantId) {
      where.userId = participantId;
    }
    where.assessment = {
      ...(where.assessment ?? {}),
      trainingId: { in: trainingIds },
    };

    const attempts = await prisma.assessmentAttempt.findMany({
      where,
      select: {
        score: true,
        maxScore: true,
        submittedAt: true,
        assessment: { select: { type: true } },
      },
    });

    const achievementMap = new Map();
    const prePostMap = new Map();

    for (const attempt of attempts) {
      const key = getDateBucketKey(attempt.submittedAt, granularity);
      const percentage = toPercentage(Number(attempt.score ?? 0), Number(attempt.maxScore ?? 0));

      if (!achievementMap.has(key)) {
        achievementMap.set(key, { sum: 0, count: 0 });
      }
      const achievementEntry = achievementMap.get(key);
      achievementEntry.sum += percentage;
      achievementEntry.count += 1;

      const type = attempt.assessment.type;
      if (type === "PRE_TEST" || type === "POST_TEST") {
        const typeKey = `${key}|${type}`;
        if (!prePostMap.has(typeKey)) {
          prePostMap.set(typeKey, { sum: 0, count: 0 });
        }
        const prePostEntry = prePostMap.get(typeKey);
        prePostEntry.sum += percentage;
        prePostEntry.count += 1;
      }
    }

    const achievementOverTime = [...achievementMap.entries()]
      .map(([date, value]) => ({
        date,
        attemptCount: value.count,
        averagePercentage: value.count > 0 ? roundToTwo(value.sum / value.count) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const prePostOverTime = [...prePostMap.entries()]
      .map(([compositeKey, value]) => {
        const [date, type] = compositeKey.split("|");
        return {
          date,
          type,
          attemptCount: value.count,
          averagePercentage: value.count > 0 ? roundToTwo(value.sum / value.count) : 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

    res.json({
      filters: { trainingId, assessmentId, participantId },
      granularity,
      achievementOverTime,
      prePostOverTime,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Per-question option distribution / distractor analysis (item 6).
// Difficulty = p-value (% correct). Discrimination index is intentionally skipped
// (unreliable at the small sample sizes expected here).
const getQuestionOptionDistribution = async (req, res) => {
  try {
    const questionId = parsePositiveInt(req.params.id);

    if (!questionId) {
      return res.status(400).json({ error: "Invalid question id" });
    }

    const trainingId = parsePositiveInt(req.query.trainingId);
    const assessmentId = parsePositiveInt(req.query.assessmentId);
    const trainingIds = await resolveScopedTrainingIds(req.user, trainingId);

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        topic: {
          trainingId: { in: trainingIds },
        },
      },
      include: {
        answerOptions: { orderBy: { orderIndex: "asc" } },
        topic: { select: { id: true, name: true } },
      },
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const answers = await prisma.participantAnswer.findMany({
      where: buildSubmittedAnswerWhere({ questionId, assessmentId, trainingIds }),
      select: { selectedOptionId: true, isCorrect: true },
    });

    const total = answers.length;
    let answeredCount = 0;
    let correctCount = 0;
    const optionCounts = new Map();

    for (const answer of answers) {
      if (answer.isCorrect === true) {
        correctCount += 1;
      }
      if (answer.selectedOptionId !== null && answer.selectedOptionId !== undefined) {
        answeredCount += 1;
        optionCounts.set(
          answer.selectedOptionId,
          (optionCounts.get(answer.selectedOptionId) || 0) + 1
        );
      }
    }

    const options = question.answerOptions.map((option) => ({
      optionId: option.id,
      text: option.text,
      orderIndex: option.orderIndex,
      isCorrect: option.isCorrect,
      selectedCount: optionCounts.get(option.id) || 0,
      selectedPercentage: toPercentage(optionCounts.get(option.id) || 0, total),
    }));

    res.json({
      questionId: question.id,
      questionText: question.title,
      questionType: question.type,
      difficulty: question.difficulty,
      topic: question.topic,
      filters: { trainingId, assessmentId },
      totalSubmittedAnswers: total,
      answeredCount,
      noAnswerCount: total - answeredCount,
      correctCount,
      pValue: toPercentage(correctCount, total),
      discriminationIndex: null,
      options,
      note:
        question.type === "MULTIPLE_CHOICE"
          ? "selectedPercentage is over totalSubmittedAnswers. pValue = % correct over submitted answers. Discrimination index omitted (unreliable at small sample sizes)."
          : "Option distribution applies to MULTIPLE_CHOICE questions; this question type is not auto-graded, so no option selection data is available.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAnalyticsByTopic,
  getAnalyticsByDifficulty,
  getPrePostComparison,
  computePrePostComparison,
  getWorstQuestions,
  getQuestionAnalytics,
  getAnalyticsSummary,
  getParticipantProfile,
  getParticipantImprovements,
  getLeaderboard,
  getTrends,
  getQuestionOptionDistribution,
};
