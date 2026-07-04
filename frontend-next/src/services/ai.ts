import { apiEnsureOk, apiJsonFetch } from "./apiClient";

// AI domain service. Thin wrapper over apiClient — every call goes through the
// Bearer-token fetch. Endpoints (backend/routes/aiRoutes.js):
//   GET    /ai/models                 -> AiModel[]                     (ADMIN+INSTRUCTOR)
//   POST   /ai/models                 -> AiModel (201; 409 duplicate)  (ADMIN)
//   PATCH  /ai/models/:id             -> AiModel (404/400/409)         (ADMIN)
//   DELETE /ai/models/:id             -> 204 (409 if FK-referenced)    (ADMIN)
//   POST   /ai/models/:id/test        -> AiModelTestResult (501 non-Ollama)
//   GET    /ai/ollama/status          -> OllamaStatus (always 200)     (ADMIN+INSTRUCTOR)
//   GET    /ai/interactions?...       -> AiInteractionList             (ADMIN+INSTRUCTOR)
//   PATCH  /ai/interactions/:id/review-> review result (409 if already reviewed)
//   GET    /ai/pre-post-insights?...  -> PrePostInsights               (ADMIN+INSTRUCTOR)
//
// These response shapes are custom to the AI controllers (not plain backend
// entities), so they live here rather than in the frozen src/types.

export type AiProvider = "OLLAMA" | "OPENAI" | "DEEPSEEK" | "OTHER";

export type AiAction =
  | "GENERATE_QUESTION"
  | "EDIT_QUESTION"
  | "GENERATE_EQUIVALENT_QUESTION"
  | "CHECK_EQUIVALENCE"
  | "CHECK_QUESTION_QUALITY"
  | "REVIEW_TEST"
  | "GENERATE_SYNTHETIC_DATA";

export type AiReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED";

// Flat AiModel as returned by the controller's AI_MODEL_SELECT (no relations).
export interface AiModel {
  id: number;
  provider: AiProvider;
  modelName: string;
  displayName: string | null;
  isLocal: boolean;
  isActive: boolean;
  baseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAiModelInput {
  provider: AiProvider;
  modelName: string;
  displayName?: string | null;
  baseUrl?: string | null;
  isLocal?: boolean;
  isActive?: boolean;
}

export interface UpdateAiModelInput {
  provider?: AiProvider;
  modelName?: string;
  displayName?: string | null;
  baseUrl?: string | null;
  isLocal?: boolean;
  isActive?: boolean;
}

// POST /ai/models/:id/test — reachability is reported as a 200 result, not a 5xx.
export interface AiModelTestResult {
  ok: boolean;
  message?: string;
  sample?: string;
}

// GET /ai/ollama/status — always 200; `reachable:false` carries `message`.
export interface OllamaStatus {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  message?: string;
}

// One row of GET /ai/interactions (summary projection only — the list does NOT
// return prompt/resultText/resultJson, and there is no per-id detail endpoint).
export interface AiInteractionListItem {
  id: number;
  action: AiAction;
  reviewStatus: AiReviewStatus;
  sourceQuestionId: number | null;
  generatedQuestionId: number | null;
  createdAt: string;
  reviewedAt: string | null;
  aiModel: {
    id: number;
    provider: AiProvider;
    modelName: string;
    displayName: string | null;
  } | null;
  requestedBy: {
    id: number;
    email: string;
  };
}

export interface AiInteractionList {
  items: AiInteractionListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListInteractionsParams {
  reviewStatus?: AiReviewStatus;
  action?: AiAction;
  requestedById?: number;
  limit?: number;
  offset?: number;
}

export interface ReviewInteractionResult {
  aiInteractionId: number;
  reviewStatus: AiReviewStatus;
  reviewedAt: string;
  message: string;
}

// Cohort-level averages over all submitted PRE_TEST / POST_TEST attempts; NOT
// paired per participant (same caveat as the analytics domain).
export interface PrePostComparison {
  preTest: { attemptCount: number; averagePercentage: number };
  postTest: { attemptCount: number; averagePercentage: number };
  improvement: number;
}

export interface PrePostInsightsParams {
  trainingId?: number;
  preAssessmentId?: number;
  postAssessmentId?: number;
}

// GET /ai/pre-post-insights — advisory only. `narrative` is the optional Ollama
// summary; when null, `narrativeUnavailableReason` explains why (no active local
// model, or the Ollama request failed). `comparison` is always present.
export interface PrePostInsights {
  advisory: boolean;
  notice: string;
  filters: {
    trainingId: number | null;
    preAssessmentId: number | null;
    postAssessmentId: number | null;
  };
  comparison: PrePostComparison;
  narrative: string | null;
  narrativeAvailable: boolean;
  narrativeUnavailableReason: string | null;
  aiInteractionId: number | null;
  provider?: AiProvider;
  model?: string;
  reviewStatus?: AiReviewStatus;
}

const jsonHeaders = { "Content-Type": "application/json" };

const buildQuery = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

export const aiService = {
  // ---- Models (read ADMIN+INSTRUCTOR; mutations ADMIN) ----
  listModels: () => apiJsonFetch<AiModel[]>("/ai/models"),

  createModel: (input: CreateAiModelInput) =>
    apiJsonFetch<AiModel>("/ai/models", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  updateModel: (id: number | string, input: UpdateAiModelInput) =>
    apiJsonFetch<AiModel>(`/ai/models/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  // DELETE returns 204; a 409 here means the model is referenced by interactions
  // (the thrown Error carries the backend "deactivate instead" message).
  removeModel: (id: number | string) => apiEnsureOk(`/ai/models/${id}`, { method: "DELETE" }),

  // 200 {ok,message?,sample?}; non-Ollama providers respond 501 (thrown Error).
  testModel: (id: number | string) =>
    apiJsonFetch<AiModelTestResult>(`/ai/models/${id}/test`, { method: "POST" }),

  // ---- Ollama runtime status ----
  ollamaStatus: () => apiJsonFetch<OllamaStatus>("/ai/ollama/status"),

  // ---- Review queue ----
  listInteractions: (params: ListInteractionsParams = {}) =>
    apiJsonFetch<AiInteractionList>(`/ai/interactions${buildQuery({ ...params })}`),

  // Accept/Reject only flips reviewStatus (PENDING -> ACCEPTED/REJECTED); nothing
  // about the AI content is auto-applied. 409 if it was already reviewed.
  reviewInteraction: (id: number | string, reviewStatus: "ACCEPTED" | "REJECTED") =>
    apiJsonFetch<ReviewInteractionResult>(`/ai/interactions/${id}/review`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ reviewStatus }),
    }),

  // ---- Advisory pre/post insights ----
  prePostInsights: (params: PrePostInsightsParams = {}) =>
    apiJsonFetch<PrePostInsights>(`/ai/pre-post-insights${buildQuery({ ...params })}`),
};
