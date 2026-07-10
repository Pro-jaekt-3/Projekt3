import { apiEnsureOk, apiJsonFetch } from "./apiClient";
import type {
  Assessment,
  AssessmentResults,
  AssessmentStatus,
  AssessmentType,
} from "@/types";

// Assessments domain service. Thin wrapper over apiClient — every call goes through
// the Bearer-token fetch.
//
// Endpoints (backend/routes/assessmentRoutes.js):
//   GET    /assessments             -> Assessment[] (ADMIN/INSTRUCTOR: all, PARTICIPANT: published only)
//   GET    /assessments/available   -> Assessment[] (published only, lighter payload)
//   GET    /assessments/:id         -> Assessment (participant gets 403 unless published)
//   GET    /assessments/:id/results -> AssessmentResults (ADMIN/INSTRUCTOR only)
//   POST   /assessments             -> Assessment (201, always created as DRAFT)
//   POST   /assessments/generate    -> Assessment (201, generated DRAFT assessment)
//   PUT    /assessments/:id         -> Assessment (DRAFT only, 409 if submitted attempts exist)
//   PATCH  /assessments/:id/status  -> Assessment
//   DELETE /assessments/:id         -> { message } JSON, 200
//
// Gotchas (see docs/FRONTEND-NOTES.md):
//   - Question picker must send only APPROVED questions from the selected training.
//   - Duplicate question ids are rejected with 400.
//   - pairedAssessmentId is valid only for POST_TEST and must reference a PRE_TEST
//     in the same training.
//   - GET /assessments/:id includes answerOptions.isCorrect; solving views must sanitize.
//   - Results use the bespoke AssessmentResults response, NOT Assessment.

export interface AssessmentQuestionInput {
  questionId: number;
  points?: number;
}

export interface CreateAssessmentInput {
  title: string;
  description?: string | null;
  trainingId: number;
  type?: AssessmentType;
  pairedAssessmentId?: number | null;
  questions: Array<number | AssessmentQuestionInput>;
  timeLimitMinutes?: number | null;
}

export interface UpdateAssessmentInput {
  title?: string;
  description?: string | null;
  trainingId?: number;
  type?: AssessmentType;
  pairedAssessmentId?: number | null;
  questions?: Array<number | AssessmentQuestionInput>;
  timeLimitMinutes?: number | null;
}

export interface GenerateAssessmentInput {
  title: string;
  description?: string | null;
  trainingId: number;
  type?: AssessmentType;
  pairedAssessmentId?: number | null;
  topicId?: number;
  difficulty?: "easy" | "medium" | "hard" | 1 | 2 | 3 | number;
  count: number;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const assessmentsService = {
  list: () => apiJsonFetch<Assessment[]>("/assessments"),

  listAvailable: () => apiJsonFetch<Assessment[]>("/assessments/available"),

  get: (id: number | string) => apiJsonFetch<Assessment>(`/assessments/${id}`),

  getResults: (id: number | string) =>
    apiJsonFetch<AssessmentResults>(`/assessments/${id}/results`),

  create: (input: CreateAssessmentInput) =>
    apiJsonFetch<Assessment>("/assessments", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  generate: (input: GenerateAssessmentInput) =>
    apiJsonFetch<Assessment>("/assessments/generate", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  update: (id: number | string, input: UpdateAssessmentInput) =>
    apiJsonFetch<Assessment>(`/assessments/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  updateStatus: (id: number | string, status: AssessmentStatus) =>
    apiJsonFetch<Assessment>(`/assessments/${id}/status`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ status }),
    }),

  // DELETE returns { message } JSON with 200 — use apiJsonFetch if the caller
  // wants the server message, or apiEnsureOk when only 2xx success matters.
  remove: (id: number | string) =>
    apiJsonFetch<{ message: string }>(`/assessments/${id}`, { method: "DELETE" }),

  removeQuietly: (id: number | string) =>
    apiEnsureOk(`/assessments/${id}`, { method: "DELETE" }),
};
