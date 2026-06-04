import {
  apiEnsureOk,
  apiJsonFetch,
} from "./apiClient";

export const getLearningObjectives = async () => {
  return apiJsonFetch(
    "/learning-objectives"
  );
};

export const createLearningObjective = async (
  learningObjectiveData: {
    title: string;
    description: string;
    topicId: number;
  }
) => {
  return apiJsonFetch(
    "/learning-objectives",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(
        learningObjectiveData
      ),
    }
  );
};

export const deleteLearningObjective = async (
  id: number
) => {
  await apiEnsureOk(
    `/learning-objectives/${id}`,
    {
      method: "DELETE",
    }
  );
};
