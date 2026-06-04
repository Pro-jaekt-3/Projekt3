import {
  apiEnsureOk,
  apiJsonFetch,
} from "./apiClient";

export const getTopics = async () => {
  return apiJsonFetch("/topics");
};

export const createTopic = async (
  name: string,
  trainingId: number
) => {
  return apiJsonFetch("/topics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      trainingId,
    }),
  });
};

export const deleteTopic = async (id: number) => {
  await apiEnsureOk(`/topics/${id}`, {
    method: "DELETE",
  });
};
