import { apiJsonFetch } from "./apiClient";
import { entityKeys } from "@/lib/query-keys";
import type { QuestionType } from "@/types";

// AI authoring domain service (DEV A). Thin wrapper over apiClient — every call
// goes through the Bearer-token fetch. Endpoints (backend/routes/aiRoutes.js,
// ADMIN/INSTRUCTOR):
//   POST /ai/question-draft        -> QuestionDraftResult (201)
//   POST /ai/equivalence-suggestion-> EquivalenceSuggestionResult (201)
//   GET  /ai/models                -> AiModelSummary[]   (read only here)
//   GET  /ai/ollama/status         -> OllamaStatus       (always 200)
//   PATCH /ai/interactions/:id/review -> ReviewInteractionResult (409 if already reviewed)
//
// Backend facts that shape this surface (backend/controllers/aiController.js):
//   - /question-draft requires NON-EMPTY topic, learningObjective, questionType,
//     difficulty as FREE TEXT (topic name + objective title, NOT ids). `suggestion`
//     is raw model text (not structured JSON) → advisory for human review.
//   - /equivalence-suggestion COMPARES two EXISTING questions (questionAId !=
//     questionBId). It does NOT generate a new question; `suggestion` is an advisory
//     equivalence assessment.
//   - Both endpoints ALWAYS use the configured default local Ollama model and accept
//     NO model parameter. Any per-type model choice in the UI is informational only.
//   - Specific errors bubble as Error(message): 400 (missing fields), 404 (question
//     not found), 500 (model missing/inactive), 501 (non-Ollama provider), 502
//     (Ollama request failed).
//
// `qk` (src/lib/query-keys.ts) is frozen and has no `ai-authoring` entry, so we build
// our own key set from the exported `entityKeys` factory instead of editing it.

export const aiAuthoringKeys = entityKeys("ai-authoring");

export type AiReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface GenerateQuestionDraftInput {
  topic: string;
  learningObjective: string;
  questionType: QuestionType;
  difficulty: string | number;
  instructions?: string;
}

export interface QuestionDraftResult {
  suggestion: string;
  aiInteractionId: number;
  provider: string;
  model: string;
  reviewStatus: AiReviewStatus;
}

export interface SuggestEquivalenceInput {
  questionAId: number;
  questionBId: number;
  instructions?: string;
}

export interface EquivalenceSuggestionResult {
  aiInteractionId: number;
  provider: string;
  model: string;
  reviewStatus: AiReviewStatus;
  questionAId: number;
  questionBId: number;
  suggestion: string;
}

// Flat AiModel as returned by GET /ai/models (aiModelController AI_MODEL_SELECT).
export interface AiModelSummary {
  id: number;
  provider: string;
  modelName: string;
  displayName: string | null;
  isLocal: boolean;
  isActive: boolean;
  baseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET /ai/ollama/status — always 200; `reachable:false` carries `message`.
export interface OllamaStatus {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  message?: string;
}

export interface ReviewInteractionResult {
  aiInteractionId: number;
  reviewStatus: Exclude<AiReviewStatus, "PENDING">;
  reviewedById: number;
  reviewedAt: string;
  message: string;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const aiAuthoringService = {
  // Advisory question draft from free-text topic / learning objective context.
  generateQuestionDraft: (input: GenerateQuestionDraftInput) =>
    apiJsonFetch<QuestionDraftResult>("/ai/question-draft", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  // Advisory equivalence assessment between two EXISTING questions.
  suggestEquivalence: (input: SuggestEquivalenceInput) =>
    apiJsonFetch<EquivalenceSuggestionResult>("/ai/equivalence-suggestion", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  // Read-only: which AI models exist (managed by Dev C under AI Models).
  listModels: () => apiJsonFetch<AiModelSummary[]>("/ai/models"),

  // Local Ollama reachability — never throws on "offline" (backend returns 200).
  ollamaStatus: () => apiJsonFetch<OllamaStatus>("/ai/ollama/status"),

  // Accept/Reject only flips reviewStatus (PENDING -> ACCEPTED/REJECTED); nothing
  // about the AI content is auto-applied. 409 if it was already reviewed.
  reviewInteraction: (id: number | string, reviewStatus: "ACCEPTED" | "REJECTED") =>
    apiJsonFetch<ReviewInteractionResult>(`/ai/interactions/${id}/review`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ reviewStatus }),
    }),
};
