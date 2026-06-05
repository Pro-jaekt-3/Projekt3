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

export const getPrePostSeries =
  async () => {
    return apiJsonFetch(
      "/analytics/pre-post-series"
    );
  };

export const getPrePostSeriesDetail =
  async (seriesId: number) => {
    return apiJsonFetch(
      `/analytics/pre-post-series/${seriesId}`
    );
  };
