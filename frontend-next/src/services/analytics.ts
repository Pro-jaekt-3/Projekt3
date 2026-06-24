import { apiJsonFetch } from "./apiClient";

// Analytics domain service. Thin wrapper over apiClient — every call goes through
// the Bearer-token fetch. All endpoints are ADMIN/INSTRUCTOR only and aggregate
// ONLY submitted attempts (submittedAt != null), so empty results are normal until
// participants submit. Endpoints (backend/routes/analyticsRoutes.js):
//   GET /analytics/by-topic               -> TopicAnalytics[]
//   GET /analytics/by-learning-objective  -> LearningObjectiveAnalytics[]
//   GET /analytics/by-difficulty          -> DifficultyAnalytics[]
//   GET /analytics/pre-post-comparison    -> PrePostComparison
//   GET /analytics/worst-questions?limit=N    -> WorstQuestion[]
//   GET /analytics/questions?sort=worst&limit=N -> QuestionAnalytics[]
//
// These response shapes are custom to analytics (not backend entities), so they
// live here rather than in the frozen src/types.

// Paired breakdowns (topic / objective / difficulty) score 1 point per answer,
// so `percentage` is a CORRECTNESS RATE, not a weighted-points score.
export interface TopicAnalytics {
  topicId: number;
  topicTitle: string;
  answerCount: number;
  score: number;
  maxScore: number;
  attemptCount: number;
  percentage: number;
}

export interface LearningObjectiveAnalytics {
  learningObjectiveId: number;
  learningObjectiveTitle: string;
  answerCount: number;
  score: number;
  maxScore: number;
  attemptCount: number;
  percentage: number;
}

export interface DifficultyAnalytics {
  // EASY | MEDIUM | HARD | LEVEL_<n> (backend maps 1/2/3, falls back to LEVEL_n)
  difficulty: string;
  answerCount: number;
  score: number;
  maxScore: number;
  attemptCount: number;
  percentage: number;
}

// NOTE: the backend computes COHORT-LEVEL averages over all submitted PRE_TEST /
// POST_TEST attempts independently; it does NOT pair pre+post by the same user.
// `improvement` is simply postTest.averagePercentage - preTest.averagePercentage.
export interface PrePostComparison {
  preTest: { attemptCount: number; averagePercentage: number };
  postTest: { attemptCount: number; averagePercentage: number };
  improvement: number;
}

export interface WorstQuestion {
  questionId: number;
  questionText: string;
  answerCount: number;
  score: number;
  maxScore: number;
  percentage: number;
}

// correctPercentage uses isCorrect===true only — OPEN/CODE answers awaiting manual
// review count as not-correct here, so treat low values for non-MCQ accordingly.
export interface QuestionAnalytics {
  questionId: number;
  questionText: string;
  answerCount: number;
  correctCount: number;
  correctPercentage: number;
  averagePoints: number;
}

const withLimit = (path: string, limit?: number) =>
  Number.isInteger(limit) && (limit as number) > 0 ? `${path}?limit=${limit}` : path;

export const analyticsService = {
  byTopic: () => apiJsonFetch<TopicAnalytics[]>("/analytics/by-topic"),

  byLearningObjective: () =>
    apiJsonFetch<LearningObjectiveAnalytics[]>("/analytics/by-learning-objective"),

  byDifficulty: () => apiJsonFetch<DifficultyAnalytics[]>("/analytics/by-difficulty"),

  prePostComparison: () => apiJsonFetch<PrePostComparison>("/analytics/pre-post-comparison"),

  worstQuestions: (limit?: number) =>
    apiJsonFetch<WorstQuestion[]>(withLimit("/analytics/worst-questions", limit)),

  questions: (params?: { sort?: "worst"; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.sort) search.set("sort", params.sort);
    if (Number.isInteger(params?.limit) && (params!.limit as number) > 0) {
      search.set("limit", String(params!.limit));
    }
    const qs = search.toString();
    return apiJsonFetch<QuestionAnalytics[]>(`/analytics/questions${qs ? `?${qs}` : ""}`);
  },
};
