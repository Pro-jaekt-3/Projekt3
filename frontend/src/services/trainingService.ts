import {
  apiEnsureOk,
  apiJsonFetch,
} from "./apiClient";

export const getTrainings = async () => {
  return apiJsonFetch("/trainings");
};

export const createTraining = async (
  title: string,
  description = ""
) => {
  return apiJsonFetch("/trainings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      description,
    }),
  });
};

export const deleteTraining = async (
  id: number
) => {
  await apiEnsureOk(`/trainings/${id}`, {
    method: "DELETE",
  });
};
