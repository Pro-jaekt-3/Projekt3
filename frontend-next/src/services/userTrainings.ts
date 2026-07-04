import { apiEnsureOk, apiJsonFetch } from "./apiClient";
import type { Training, TrainingRole, UserTraining } from "@/types";

// UserTraining (membership + enrollment) domain service. Thin wrapper over
// apiClient — every call goes through the Bearer-token fetch.
// Endpoints (backend/routes/trainingRoutes.js):
//   GET    /trainings/mine                    -> MyTrainingMembership[] (any role)
//   GET    /trainings/:id/members             -> UserTraining[]   (ADMIN or owner; 404 for foreign)
//   POST   /trainings/:id/members             -> UserTraining 201 body: { userId? | email?, role }
//                                                409 if the user already has a role on the training
//   DELETE /trainings/:id/members/:userId     -> 204              (INSTRUCTOR rows: ADMIN only)
//   POST   /trainings/:id/enroll              -> { membership, training, alreadyEnrolled }
//                                                body: { enrollmentToken }; 404 on invalid link
//   POST   /trainings/:id/regenerate-token    -> { id, enrollmentToken } (ADMIN or owner)

export interface MyTrainingMembership {
  id: number;
  trainingId: number;
  role: TrainingRole;
  enrolledAt: string;
  training: Training;
}

export interface AddMemberInput {
  userId?: number;
  email?: string;
  role: TrainingRole;
}

export interface EnrollResult {
  membership: UserTraining;
  training: Training;
  alreadyEnrolled: boolean;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const userTrainingsService = {
  myTrainings: () => apiJsonFetch<MyTrainingMembership[]>("/trainings/mine"),

  listMembers: (trainingId: number | string) =>
    apiJsonFetch<UserTraining[]>(`/trainings/${trainingId}/members`),

  addMember: (trainingId: number | string, input: AddMemberInput) =>
    apiJsonFetch<UserTraining>(`/trainings/${trainingId}/members`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  removeMember: (trainingId: number | string, userId: number | string) =>
    apiEnsureOk(`/trainings/${trainingId}/members/${userId}`, { method: "DELETE" }),

  enroll: (trainingId: number | string, enrollmentToken: string) =>
    apiJsonFetch<EnrollResult>(`/trainings/${trainingId}/enroll`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ enrollmentToken }),
    }),

  regenerateToken: (trainingId: number | string) =>
    apiJsonFetch<{ id: number; enrollmentToken: string }>(
      `/trainings/${trainingId}/regenerate-token`,
      { method: "POST" },
    ),
};
