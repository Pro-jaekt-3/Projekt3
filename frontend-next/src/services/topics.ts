import { apiEnsureOk, apiJsonFetch } from "./apiClient";
import type { Topic } from "@/types";

// Topics domain service. Thin wrapper over apiClient — every call goes through
// the Bearer-token fetch. Endpoints (backend/routes/topicRoutes.js, ADMIN/INSTRUCTOR):
//   GET    /topics        -> Topic[]
//   GET    /topics/:id    -> Topic (404 if missing)
//   POST   /topics        -> Topic (201)         body: { name, trainingId }
//   PUT    /topics/:id    -> Topic               body: { name?, trainingId? }
//   DELETE /topics/:id    -> 204 No Content (FK 500 if the topic is in use)

export interface CreateTopicInput {
  name: string;
  trainingId: number;
}

export interface UpdateTopicInput {
  name?: string;
  trainingId?: number;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const topicsService = {
  list: () => apiJsonFetch<Topic[]>("/topics"),

  get: (id: number | string) => apiJsonFetch<Topic>(`/topics/${id}`),

  create: (input: CreateTopicInput) =>
    apiJsonFetch<Topic>("/topics", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  update: (id: number | string, input: UpdateTopicInput) =>
    apiJsonFetch<Topic>(`/topics/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  // DELETE returns 204 with no body — use apiEnsureOk (no JSON parse). A 500 here
  // usually means the topic is still referenced (learning objectives/questions,
  // FK, no cascade); the thrown Error carries the backend `{ error }` message.
  remove: (id: number | string) => apiEnsureOk(`/topics/${id}`, { method: "DELETE" }),
};
