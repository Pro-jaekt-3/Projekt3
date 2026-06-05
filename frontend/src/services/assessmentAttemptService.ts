import { apiJsonFetch } from "./apiClient";

export const startAttempt = async (
  assessmentId: number
) => {
  return apiJsonFetch(
    "/assessment-attempts/start",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assessmentId,
      }),
    }
  );
};

export const submitAttempt = async (
  attemptId: number,
  answers: any[]
) => {
  return apiJsonFetch(
    `/assessment-attempts/${attemptId}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answers,
      }),
    }
  );
};

export const getAttemptById = async (
  attemptId: number
) => {
  return apiJsonFetch(
    `/assessment-attempts/${attemptId}`
  );
};
