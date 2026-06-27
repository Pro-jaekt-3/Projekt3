import { apiJsonFetch } from "./apiClient";
import type { AssessmentAttempt } from "@/types";

// Assessment attempts domain service. Thin wrapper over apiClient — every call
// goes through the Bearer-token fetch.
//
// Endpoints (backend/routes/assessmentAttemptRoutes.js):
//   POST /assessment-attempts/start       -> AssessmentAttempt (201)
//   POST /assessment-attempts/:id/submit  -> AssessmentAttempt
//   GET  /assessment-attempts/:id         -> AssessmentAttempt
//
// Gotchas (see docs/FRONTEND-NOTES.md):
//   - start returns 403 unless the assessment is PUBLISHED.
//   - submit is one-shot; re-submit returns 400.
//   - score/maxScore are only present after submit.
//   - OPEN/CODE answers are stored for manual review (needsManualReview = true).
//   - There is NO list endpoint; participant flows must persist attempt ids locally.

export interface StartAssessmentAttemptInput {
  assessmentId: number;
}

export interface SubmitAssessmentAttemptAnswerInput {
  questionId: number;
  selectedOptionId?: number;
  textAnswer?: string | null;
  answerText?: string | null;
}

export interface SubmitAssessmentAttemptInput {
  answers: SubmitAssessmentAttemptAnswerInput[];
}

const jsonHeaders = { "Content-Type": "application/json" };

export const assessmentAttemptsService = {
  start: (assessmentId: number | StartAssessmentAttemptInput) =>
    apiJsonFetch<AssessmentAttempt>("/assessment-attempts/start", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(
        typeof assessmentId === "number" ? { assessmentId } : assessmentId,
      ),
    }),

  submit: (id: number | string, input: SubmitAssessmentAttemptInput) =>
    apiJsonFetch<AssessmentAttempt>(`/assessment-attempts/${id}/submit`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  get: (id: number | string) =>
    apiJsonFetch<AssessmentAttempt>(`/assessment-attempts/${id}`),
};
