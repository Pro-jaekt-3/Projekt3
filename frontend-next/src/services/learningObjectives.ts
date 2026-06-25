import { apiEnsureOk, apiJsonFetch } from "./apiClient";
import type { LearningObjective } from "@/types";

// LearningObjectives domain service. Thin wrapper over apiClient — every call goes
// through the Bearer-token fetch. Endpoints
// (backend/routes/learningObjectiveRoutes.js, ADMIN/INSTRUCTOR):
//   GET    /learning-objectives?topicId=  -> LearningObjective[] (topicId filter optional)
//   GET    /learning-objectives/:id       -> LearningObjective (404 if missing)
//   POST   /learning-objectives           -> LearningObjective (201)  body: { title, description?, topicId }
//   PUT    /learning-objectives/:id       -> LearningObjective        body: { title?, description?, topicId? }
//   DELETE /learning-objectives/:id       -> 204 No Content (FK 500 if the objective is in use)

export interface CreateLearningObjectiveInput {
  title: string;
  description?: string | null;
  topicId: number;
}

export interface UpdateLearningObjectiveInput {
  title?: string;
  description?: string | null;
  topicId?: number;
}

export interface ListLearningObjectivesParams {
  topicId?: number | string;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const learningObjectivesService = {
  list: (params: ListLearningObjectivesParams = {}) =>
    apiJsonFetch<LearningObjective[]>(
      params.topicId !== undefined
        ? `/learning-objectives?topicId=${params.topicId}`
        : "/learning-objectives",
    ),

  get: (id: number | string) => apiJsonFetch<LearningObjective>(`/learning-objectives/${id}`),

  create: (input: CreateLearningObjectiveInput) =>
    apiJsonFetch<LearningObjective>("/learning-objectives", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  update: (id: number | string, input: UpdateLearningObjectiveInput) =>
    apiJsonFetch<LearningObjective>(`/learning-objectives/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  // DELETE returns 204 with no body — use apiEnsureOk (no JSON parse). A 500 here
  // usually means the objective is still referenced (questions, FK, no cascade);
  // the thrown Error carries the backend `{ error }` message.
  remove: (id: number | string) => apiEnsureOk(`/learning-objectives/${id}`, { method: "DELETE" }),
};
