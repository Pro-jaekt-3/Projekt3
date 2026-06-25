import { apiJsonFetch } from "./apiClient";
import { entityKeys } from "@/lib/query-keys";
import type { EquivalentQuestionGroup, Question } from "@/types";

// EquivalentGroups domain service. Thin wrapper over apiClient — every call goes
// through the Bearer-token fetch. Endpoints
// (backend/routes/equivalentQuestionGroupRoutes.js, ADMIN/INSTRUCTOR):
//   GET    /equivalent-question-groups                          -> EquivalentQuestionGroup[] (with `questions`)
//   GET    /equivalent-question-groups/:id                      -> EquivalentQuestionGroup (404 if missing)
//   POST   /equivalent-question-groups                          -> EquivalentQuestionGroup (201)  body: { name, description? }
//   PUT    /equivalent-question-groups/:id                      -> EquivalentQuestionGroup         body: { name?, description? }
//   DELETE /equivalent-question-groups/:id                      -> { message } JSON, 200 (NOT 204)
//   POST   /equivalent-question-groups/:id/questions             -> Question (the attached question, NOT the group)  body: { questionId }
//   DELETE /equivalent-question-groups/:id/questions/:questionId -> Question (the detached question)
//
// Gotcha: Question.equivalentGroupId has `onDelete: SetNull` (schema.prisma), so
// deleting a group does NOT fail when it still has member questions — they're
// just detached (equivalentGroupId -> null), unlike topics/trainings/learning
// objectives which 500 on FK-in-use.
//
// `qk` (src/lib/query-keys.ts) has no `equivalentGroups` entry and that file is
// frozen, so we build our own key set from the same exported `entityKeys` factory
// instead of editing it.

export const equivalentGroupsKeys = entityKeys("equivalent-groups");

export interface CreateEquivalentGroupInput {
  name: string;
  description?: string | null;
}

export interface UpdateEquivalentGroupInput {
  name?: string;
  description?: string | null;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const equivalentGroupsService = {
  list: () => apiJsonFetch<EquivalentQuestionGroup[]>("/equivalent-question-groups"),

  get: (id: number | string) =>
    apiJsonFetch<EquivalentQuestionGroup>(`/equivalent-question-groups/${id}`),

  create: (input: CreateEquivalentGroupInput) =>
    apiJsonFetch<EquivalentQuestionGroup>("/equivalent-question-groups", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  update: (id: number | string, input: UpdateEquivalentGroupInput) =>
    apiJsonFetch<EquivalentQuestionGroup>(`/equivalent-question-groups/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  // Returns { message } JSON with 200 — NOT 204. apiJsonFetch (not apiEnsureOk).
  remove: (id: number | string) =>
    apiJsonFetch<{ message: string }>(`/equivalent-question-groups/${id}`, { method: "DELETE" }),

  addQuestion: (groupId: number | string, questionId: number | string) =>
    apiJsonFetch<Question>(`/equivalent-question-groups/${groupId}/questions`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ questionId }),
    }),

  removeQuestion: (groupId: number | string, questionId: number | string) =>
    apiJsonFetch<Question>(`/equivalent-question-groups/${groupId}/questions/${questionId}`, {
      method: "DELETE",
    }),
};
