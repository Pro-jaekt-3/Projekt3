import { apiEnsureOk, apiJsonFetch } from "./apiClient";
import type { Training } from "@/types";

// Trainings domain service. Thin wrapper over apiClient — every call goes through
// the Bearer-token fetch. Endpoints (backend/routes/trainingRoutes.js, ADMIN/INSTRUCTOR):
//   GET    /trainings        -> Training[]
//   GET    /trainings/:id    -> Training (404 if missing)
//   POST   /trainings        -> Training (201)         body: { title, description? }
//   PUT    /trainings/:id    -> Training               body: { title?, description? }
//   DELETE /trainings/:id    -> 204 No Content (FK 500 if the training is in use)

export interface CreateTrainingInput {
  title: string;
  description?: string | null;
}

export interface UpdateTrainingInput {
  title?: string;
  description?: string | null;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const trainingsService = {
  list: () => apiJsonFetch<Training[]>("/trainings"),

  get: (id: number | string) => apiJsonFetch<Training>(`/trainings/${id}`),

  create: (input: CreateTrainingInput) =>
    apiJsonFetch<Training>("/trainings", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  update: (id: number | string, input: UpdateTrainingInput) =>
    apiJsonFetch<Training>(`/trainings/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  // DELETE returns 204 with no body — use apiEnsureOk (no JSON parse). A 500 here
  // usually means the training is still referenced (FK, no cascade); the thrown
  // Error carries the backend `{ error }` message for the UI to surface.
  remove: (id: number | string) => apiEnsureOk(`/trainings/${id}`, { method: "DELETE" }),
};
