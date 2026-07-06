import { apiJsonFetch } from "./apiClient";
import type { Question, QuestionType } from "@/types";

// Questions domain service. Thin wrapper over apiClient — every call goes through
// the Bearer-token fetch. Endpoints (backend/routes/questionRoutes.js, ADMIN/INSTRUCTOR):
//   GET    /questions             -> Question[] (ALL statuses, no filter — filter client-side)
//   GET    /questions/:id         -> Question (404 if missing)
//   POST   /questions             -> Question (201)  body: { title, description, difficulty, topicId, type, options?, equivalenceGroupId? }
//   PUT    /questions/:id         -> Question         body: same fields, all optional
//   PATCH  /questions/:id/status  -> Question         body: { status }; only REVIEW|APPROVED|REJECTED|ARCHIVED allowed
//   DELETE /questions/:id         -> { message } JSON, 200 (NOT 204 — use apiJsonFetch, not apiEnsureOk)
//
// Gotchas (see docs/FRONTEND-NOTES.md):
//   - createQuestion does NOT validate topicId server-side — a missing/invalid topicId
//     500s. Validate client-side before calling create/update.
//   - `options` is only accepted for type === "MULTIPLE_CHOICE" (>=2 options, >=1
//     correct); sending `options` for OPEN/CODE returns 400. Omit the field entirely
//     (undefined, not an empty array) for non-MCQ types.

export type QuestionStatusTransition = "REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";

export interface AnswerOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface CreateQuestionInput {
  title: string;
  description: string;
  difficulty: number;
  topicId: number;
  type: QuestionType;
  options?: AnswerOptionInput[];
  equivalenceGroupId?: number | null;
}

export interface UpdateQuestionInput {
  title?: string;
  description?: string;
  difficulty?: number;
  topicId?: number;
  type?: QuestionType;
  options?: AnswerOptionInput[];
  equivalenceGroupId?: number | null;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const questionsService = {
  list: () => apiJsonFetch<Question[]>("/questions"),

  get: (id: number | string) => apiJsonFetch<Question>(`/questions/${id}`),

  create: (input: CreateQuestionInput) =>
    apiJsonFetch<Question>("/questions", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  update: (id: number | string, input: UpdateQuestionInput) =>
    apiJsonFetch<Question>(`/questions/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  updateStatus: (id: number | string, status: QuestionStatusTransition) =>
    apiJsonFetch<Question>(`/questions/${id}/status`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ status }),
    }),

  // Returns { message } JSON with 200 — NOT 204. apiJsonFetch (not apiEnsureOk).
  remove: (id: number | string) =>
    apiJsonFetch<{ message: string }>(`/questions/${id}`, { method: "DELETE" }),
};
