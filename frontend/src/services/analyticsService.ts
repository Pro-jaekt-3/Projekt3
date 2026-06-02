const API_BASE_URL = import.meta.env.VITE_API_URL;

export const getAnalyticsByTopic =
  async () => {
    const response = await fetch(
      `${API_BASE_URL}/analytics/by-topic`
    );

    return response.json();
  };

export const getAnalyticsByLearningObjective =
  async () => {
    const response = await fetch(
      `${API_BASE_URL}/analytics/by-learning-objective`
    );

    return response.json();
  };

export const getAnalyticsByDifficulty =
  async () => {
    const response = await fetch(
      `${API_BASE_URL}/analytics/by-difficulty`
    );

    return response.json();
  };