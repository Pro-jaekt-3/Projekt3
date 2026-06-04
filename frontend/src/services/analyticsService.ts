import { apiJsonFetch } from "./apiClient";

export const getAnalyticsByTopic =
  async () => {
    return apiJsonFetch(
      "/analytics/by-topic"
    );
  };

export const getAnalyticsByLearningObjective =
  async () => {
    return apiJsonFetch(
      "/analytics/by-learning-objective"
    );
  };

export const getAnalyticsByDifficulty =
  async () => {
    return apiJsonFetch(
      "/analytics/by-difficulty"
    );
  };
