import { apiJsonFetch } from "./apiClient";
import { entityKeys } from "@/lib/query-keys";
import type { QuestionType } from "@/types";

// AI authoring domain service (DEV A). Thin wrapper over apiClient — every call
// goes through the Bearer-token fetch. Endpoints (backend/routes/aiRoutes.js,
// ADMIN/INSTRUCTOR):
//   POST /ai/question-draft        -> QuestionDraftResult (201)
//   POST /ai/equivalent-question   -> EquivalentQuestionResult (201)
//   POST /ai/equivalence-suggestion-> EquivalenceSuggestionResult (201)
//   GET  /ai/models                -> AiModelSummary[]   (read only here)
//   GET  /ai/ollama/status         -> OllamaStatus       (always 200)
//   PATCH /ai/interactions/:id/review -> ReviewInteractionResult (409 if already reviewed)
//
// Backend facts that shape this surface (backend/controllers/aiController.js):
//   - /question-draft requires NON-EMPTY topic, questionType,
//     difficulty as FREE TEXT (topic name, NOT ids). It returns a
//     STRUCTURED `question` object (title/description/difficulty/type/answerOptions)
//     parsed+validated server-side from the model's JSON output; there is no more
//     free-text `suggestion` field. `resultText` carries the raw model output for
//     transparency only.
//   - /equivalent-question generates a NEW question equivalent to an EXISTING
//     `sourceQuestionId`, inheriting its topic by default. Same
//     structured `question` shape as /question-draft, plus the inherited topicId.
//   - /equivalence-suggestion COMPARES two EXISTING questions (questionAId !=
//     questionBId). It does NOT generate a new question; `suggestion` is an advisory
//     equivalence assessment (unchanged, still free text).
//   - question-draft / equivalent-question / equivalence-suggestion all accept an
//     OPTIONAL `aiModelId`; when provided it must be an active local Ollama model
//     (else 400), and that model actually runs the generation. Omitted -> configured
//     default local model (existing behavior).
//   - Specific errors bubble as Error(message): 400 (bad input/model), 404 (question
//     not found), 422 (model returned invalid/unparseable JSON — `resultText` still
//     included on the raw response for debugging), 500 (model missing/inactive), 501
//     (non-Ollama provider), 502 (Ollama unreachable/request failed).
//
// `qk` (src/lib/query-keys.ts) is frozen and has no `ai-authoring` entry, so we build
// our own key set from the exported `entityKeys` factory instead of editing it.

export const aiAuthoringKeys = entityKeys("ai-authoring");

export type AiReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface GenerateQuestionDraftInput {
  topic: string;
  questionType: QuestionType;
  difficulty: string | number;
  instructions?: string;
  aiModelId?: number;
}

// Structured answer option as returned/accepted by the backend (T3 shape).
export interface DraftAnswerOption {
  text: string;
  isCorrect: boolean;
  orderIndex: number;
}

// Structured question draft (T3 shape). `answerOptions` is only meaningful for
// MULTIPLE_CHOICE (empty array otherwise).
export interface DraftedQuestion {
  title: string;
  description: string;
  difficulty: number; // 1=easy, 2=medium, 3=hard (Prisma Int)
  type: QuestionType;
  answerOptions: DraftAnswerOption[];
}

export interface QuestionDraftResult {
  aiInteractionId: number;
  provider: string;
  model: string;
  reviewStatus: AiReviewStatus;
  question: DraftedQuestion;
  resultText?: string;
}

export interface GenerateEquivalentQuestionInput {
  sourceQuestionId: number;
  instructions?: string;
  aiModelId?: number;
}

// Same structured shape as QuestionDraftResult, plus the source link and the
// topic/learning objective inherited from the source question.
export interface EquivalentQuestionResult {
  aiInteractionId: number;
  provider: string;
  model: string;
  reviewStatus: AiReviewStatus;
  sourceQuestionId: number;
  question: DraftedQuestion & {
    topicId: number;
  };
  resultText?: string;
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

  // T2: generate a NEW question equivalent to an existing sourceQuestionId (not a
  // comparison). Post-test "generate equivalent from pre-test question" entry point
  // is Dev B's post-test wizard — this is the service call it consumes.
  generateEquivalentQuestion: (input: GenerateEquivalentQuestionInput) =>
    apiJsonFetch<EquivalentQuestionResult>("/ai/equivalent-question", {
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
