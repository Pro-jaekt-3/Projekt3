import { apiJsonFetch } from "./apiClient";
import { entityKeys } from "@/lib/query-keys";
import type { EquivalenceGroup, Question } from "@/types";

export const equivalenceGroupsKeys = entityKeys("equivalence-groups");

export interface CreateEquivalenceGroupInput {
  title?: string | null;
  description?: string | null;
  trainingId: number;
}

export interface UpdateEquivalenceGroupInput {
  title?: string | null;
  description?: string | null;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const equivalenceGroupsService = {
  list: () => apiJsonFetch<EquivalenceGroup[]>("/equivalence-groups"),

  get: (id: number | string) =>
    apiJsonFetch<EquivalenceGroup>(`/equivalence-groups/${id}`),

  create: (input: CreateEquivalenceGroupInput) =>
    apiJsonFetch<EquivalenceGroup>("/equivalence-groups", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  update: (id: number | string, input: UpdateEquivalenceGroupInput) =>
    apiJsonFetch<EquivalenceGroup>(`/equivalence-groups/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  remove: (id: number | string) =>
    apiJsonFetch<{ message: string }>(`/equivalence-groups/${id}`, {
      method: "DELETE",
    }),

  addQuestion: (groupId: number | string, questionId: number | string) =>
    apiJsonFetch<Question>(`/equivalence-groups/${groupId}/questions`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ questionId }),
    }),

  removeQuestion: (groupId: number | string, questionId: number | string) =>
    apiJsonFetch<Question>(
      `/equivalence-groups/${groupId}/questions/${questionId}`,
      { method: "DELETE" },
    ),
};
