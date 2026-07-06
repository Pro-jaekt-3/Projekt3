import { apiJsonFetch } from "./apiClient";
import type { AssessmentType, QuestionType, UserRole } from "@/types";

// Analytics domain service. Thin wrapper over apiClient — every call goes through
// the Bearer-token fetch. All endpoints are INSTRUCTOR only and aggregate ONLY
// submitted attempts (submittedAt != null), so empty results are normal until
// participants submit. Endpoints (backend/routes/analyticsRoutes.js):
//   GET /analytics/by-topic               -> TopicAnalytics[]
//   GET /analytics/by-difficulty          -> DifficultyAnalytics[]
//   GET /analytics/pre-post-comparison    -> PrePostComparison   (PAIRED, see below)
//   GET /analytics/worst-questions?limit=N            -> WorstQuestion[]
//   GET /analytics/questions?sort=worst&limit=N       -> QuestionAnalytics[]
//   GET /analytics/summary                            -> AnalyticsSummary
//   GET /analytics/participants/:userId               -> ParticipantProfile
//   GET /analytics/participant-improvements           -> ParticipantImprovements
//   GET /analytics/leaderboard                        -> Leaderboard
//   GET /analytics/trends                             -> Trends
//   GET /analytics/questions/:id/option-distribution  -> QuestionOptionDistribution
//
// The by-topic / by-difficulty / worst-questions / questions / summary
// breakdowns all accept the SHARED analytics filters (AnalyticsFilters) — the
// basis for the global filter bar + drill-down.
//
// These response shapes are custom to analytics (not backend entities), so they
// live here rather than in the frozen src/types.

// --- Shared filters --------------------------------------------------------

// Mirrors the backend `parseAnalyticsFilters` query params. Every field is
// optional; only positive integers are forwarded (anything else is ignored),
// which also makes the helpers safe if react-query passes a context object in.
export interface AnalyticsFilters {
  trainingId?: number;
  topicId?: number;
  difficulty?: number; // 1 = EASY, 2 = MEDIUM, 3 = HARD
  questionId?: number;
  participantId?: number;
  assessmentId?: number;
}

// Pre/post honors a DIFFERENT, narrower set on the backend (only trainingId plus
// the explicit pre/post assessment ids). Keep it separate so callers can't pass
// topic/objective/difficulty here and assume they take effect.
export interface PrePostFilters {
  trainingId?: number;
  preAssessmentId?: number;
  postAssessmentId?: number;
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const appendParams = (
  search: URLSearchParams,
  params: Record<string, number | string | boolean | undefined>,
) => {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (typeof value === "number" && !isPositiveInt(value)) continue;
    search.set(key, String(value));
  }
};

const withQuery = (path: string, params: Record<string, number | string | boolean | undefined>) => {
  const search = new URLSearchParams();
  appendParams(search, params);
  const qs = search.toString();
  return `${path}${qs ? `?${qs}` : ""}`;
};

const filterParams = (filters?: AnalyticsFilters) => ({
  trainingId: filters?.trainingId,
  topicId: filters?.topicId,
  difficulty: filters?.difficulty,
  questionId: filters?.questionId,
  participantId: filters?.participantId,
  assessmentId: filters?.assessmentId,
});

// --- Breakdown response shapes --------------------------------------------

// Paired breakdowns (topic / difficulty) score 1 point per answer,
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

export interface DifficultyAnalytics {
  // EASY | MEDIUM | HARD | LEVEL_<n> (backend maps 1/2/3, falls back to LEVEL_n)
  difficulty: string;
  answerCount: number;
  score: number;
  maxScore: number;
  attemptCount: number;
  percentage: number;
}

// PAIRED pre/post. The backend pairs each user's LATEST submitted PRE and POST
// attempt and keeps ONLY users who have BOTH. `preTest.attemptCount` and
// `postTest.attemptCount` therefore both equal `pairedUserCount`, the averages
// are taken over the paired set, and improvement === postAvg - preAvg ===
// average per-user improvement.
export interface PrePostComparison {
  preTest: { attemptCount: number; averagePercentage: number };
  postTest: { attemptCount: number; averagePercentage: number };
  improvement: number;
  pairedUserCount: number;
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

// --- Phase 3 advanced response shapes -------------------------------------

// GET /analytics/summary — overall totals under the shared filters. Safe on empty
// data: counts are 0 and percentages are 0 (never NaN). `multipleChoice` is the
// MC-only correctness slice (OPEN/CODE are not auto-graded).
export interface AnalyticsSummary {
  filters: {
    trainingId: number | null;
    topicId: number | null;
    difficulty: number | null;
    questionId: number | null;
    participantId: number | null;
    assessmentId: number | null;
  };
  answerCount: number;
  attemptCount: number;
  participantCount: number;
  averageScorePercentage: number;
  multipleChoice: {
    answerCount: number;
    correctCount: number;
    correctPercentage: number;
  };
}

// Per-topic correctness for a single participant (MC ONLY).
export interface ParticipantTopicPerformance {
  topicId: number;
  topicTitle: string;
  answerCount: number;
  correctCount: number;
  correctPercentage: number;
}

export interface ParticipantAssessmentRow {
  attemptId: number;
  assessmentId: number;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  trainingId: number;
  score: number;
  maxScore: number;
  percentage: number;
  startedAt: string;
  submittedAt: string;
  timeTakenSeconds: number | null;
}

// GET /analytics/participants/:userId — INSTRUCTOR only, so identity is included
// within owned-training scope.
export interface ParticipantProfile {
  user: { id: number; email: string; name: string | null; role: UserRole };
  prePost: {
    prePct: number | null;
    postPct: number | null;
    improvement: number | null;
    hasBoth: boolean;
  };
  assessments: ParticipantAssessmentRow[];
  topicPerformance: ParticipantTopicPerformance[];
  strongAreas: {
    topics: ParticipantTopicPerformance[];
  };
  weakAreas: {
    topics: ParticipantTopicPerformance[];
  };
  note: string;
}

export interface ParticipantImprovementRow {
  user: { id: number; name: string | null; email: string | null };
  prePct: number;
  postPct: number;
  improvement: number;
}

// GET /analytics/participant-improvements — paired per-user improvement list.
// Identity IS included (this is NOT the anonymized leaderboard).
export interface ParticipantImprovements {
  filters: {
    trainingId: number | null;
    preAssessmentId: number | null;
    postAssessmentId: number | null;
  };
  pairedUserCount: number;
  participants: ParticipantImprovementRow[];
}

// GET /analytics/leaderboard — anonymized by default. `name`/`email` are present
// ONLY when revealed (reveal=true AND caller is INSTRUCTOR); PII is never sent
// in the query string.
export interface LeaderboardEntry {
  rank: number;
  userId: number;
  label: string;
  scorePercentage: number;
  score: number;
  maxScore: number;
  submittedAt: string;
  name?: string | null;
  email?: string | null;
}

export interface Leaderboard {
  scope: { trainingId: number | null; assessmentId: number | null };
  revealed: boolean;
  anonymized: boolean;
  count: number;
  items: LeaderboardEntry[];
}

export type TrendGranularity = "day" | "week" | "month";

export interface AchievementPoint {
  date: string;
  attemptCount: number;
  averagePercentage: number;
}

export interface PrePostPoint {
  date: string;
  type: "PRE_TEST" | "POST_TEST";
  attemptCount: number;
  averagePercentage: number;
}

// GET /analytics/trends — achievement + per-type averages over time.
export interface Trends {
  filters: {
    trainingId: number | null;
    assessmentId: number | null;
    participantId: number | null;
  };
  granularity: TrendGranularity;
  achievementOverTime: AchievementPoint[];
  prePostOverTime: PrePostPoint[];
}

export interface OptionDistribution {
  optionId: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
  selectedCount: number;
  selectedPercentage: number;
}

// GET /analytics/questions/:id/option-distribution — distractor analysis (MC).
// `pValue` = % correct; `discriminationIndex` is intentionally null (unreliable
// at the small sample sizes expected here).
export interface QuestionOptionDistribution {
  questionId: number;
  questionText: string;
  questionType: QuestionType;
  difficulty: number;
  topic: { id: number; name: string } | null;
  filters: { trainingId: number | null; assessmentId: number | null };
  totalSubmittedAnswers: number;
  answeredCount: number;
  noAnswerCount: number;
  correctCount: number;
  pValue: number;
  discriminationIndex: number | null;
  options: OptionDistribution[];
  note: string;
}

export interface LeaderboardParams {
  trainingId?: number;
  assessmentId?: number;
  limit?: number;
  // No PII default. Names/emails are only returned when reveal=true AND the caller
  // is INSTRUCTOR (re-checked server-side). Never put PII in the URL.
  reveal?: boolean;
}

export interface TrendsParams {
  trainingId?: number;
  assessmentId?: number;
  participantId?: number;
  granularity?: TrendGranularity;
}

// Dual call-signature for the breakdowns that pre-existing pages pass DIRECTLY as
// a react-query `queryFn` (e.g. `queryFn: analyticsService.byTopic`). The `()`
// overload keeps them assignable to `QueryFunction` (react-query's context arg is
// ignored at runtime by the filter helpers), while the filtered overload powers
// the new global filter bar. Without this, an optional weak-type param makes the
// bare-reference call sites fail to type-check.
type FilterableBreakdown<T> = {
  (): Promise<T>;
  (filters: AnalyticsFilters): Promise<T>;
};
type FilterablePrePost = {
  (): Promise<PrePostComparison>;
  (filters: PrePostFilters): Promise<PrePostComparison>;
};

export const analyticsService = {
  // Filterable breakdowns (shared AnalyticsFilters).
  byTopic: ((filters?: AnalyticsFilters) =>
    apiJsonFetch<TopicAnalytics[]>(
      withQuery("/analytics/by-topic", filterParams(filters)),
    )) as FilterableBreakdown<TopicAnalytics[]>,

  byDifficulty: ((filters?: AnalyticsFilters) =>
    apiJsonFetch<DifficultyAnalytics[]>(
      withQuery("/analytics/by-difficulty", filterParams(filters)),
    )) as FilterableBreakdown<DifficultyAnalytics[]>,

  // Pre/post honors only trainingId + explicit pre/post assessment ids. Safe to
  // pass as a bare function reference to react-query (a context arg is ignored).
  prePostComparison: ((filters?: PrePostFilters) =>
    apiJsonFetch<PrePostComparison>(
      withQuery("/analytics/pre-post-comparison", {
        trainingId: filters?.trainingId,
        preAssessmentId: filters?.preAssessmentId,
        postAssessmentId: filters?.postAssessmentId,
      }),
    )) as FilterablePrePost,

  worstQuestions: (limit?: number, filters?: AnalyticsFilters) =>
    apiJsonFetch<WorstQuestion[]>(
      withQuery("/analytics/worst-questions", { ...filterParams(filters), limit }),
    ),

  questions: (params?: { sort?: "worst"; limit?: number; filters?: AnalyticsFilters }) =>
    apiJsonFetch<QuestionAnalytics[]>(
      withQuery("/analytics/questions", {
        ...filterParams(params?.filters),
        sort: params?.sort,
        limit: params?.limit,
      }),
    ),

  // Phase 3 advanced.
  summary: (filters?: AnalyticsFilters) =>
    apiJsonFetch<AnalyticsSummary>(withQuery("/analytics/summary", filterParams(filters))),

  // Per-user profile honors only the path :userId (no query filters server-side).
  participantProfile: (userId: number | string) =>
    apiJsonFetch<ParticipantProfile>(`/analytics/participants/${userId}`),

  participantImprovements: (filters?: PrePostFilters) =>
    apiJsonFetch<ParticipantImprovements>(
      withQuery("/analytics/participant-improvements", {
        trainingId: filters?.trainingId,
        preAssessmentId: filters?.preAssessmentId,
        postAssessmentId: filters?.postAssessmentId,
      }),
    ),

  leaderboard: (params?: LeaderboardParams) =>
    apiJsonFetch<Leaderboard>(
      withQuery("/analytics/leaderboard", {
        trainingId: params?.trainingId,
        assessmentId: params?.assessmentId,
        limit: params?.limit,
        // Only forward reveal when explicitly requested.
        reveal: params?.reveal ? "true" : undefined,
      }),
    ),

  trends: (params?: TrendsParams) =>
    apiJsonFetch<Trends>(
      withQuery("/analytics/trends", {
        trainingId: params?.trainingId,
        assessmentId: params?.assessmentId,
        participantId: params?.participantId,
        granularity: params?.granularity,
      }),
    ),

  questionOptionDistribution: (
    questionId: number | string,
    params?: { trainingId?: number; assessmentId?: number },
  ) =>
    apiJsonFetch<QuestionOptionDistribution>(
      withQuery(`/analytics/questions/${questionId}/option-distribution`, {
        trainingId: params?.trainingId,
        assessmentId: params?.assessmentId,
      }),
    ),
};
