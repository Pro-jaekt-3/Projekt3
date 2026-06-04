import {
  apiEnsureOk,
  apiJsonFetch,
} from "./apiClient";

export const getAssessments = async () => {
  return apiJsonFetch("/assessments");
};

export const createAssessment = async (
  assessmentData: {
    title: string;
    description?: string;
    trainingId: number;
    type: string;
    questions: number[];
  }
) => {
  return apiJsonFetch("/assessments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(assessmentData),
  });
};

export const generateAssessment = async (
  generateData: {
    title: string;
    description?: string;
    trainingId: number;
    count: number;
    topicId?: number;
    learningObjectiveId?: number;
    difficulty?: number;
  }
) => {
  return apiJsonFetch("/assessments/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(generateData),
  });
};

export const deleteAssessment = async (
  id: number
) => {
  await apiEnsureOk(`/assessments/${id}`, {
    method: "DELETE",
  });
};

export const getAssessment = async (
  id: number
) => {
  return apiJsonFetch(`/assessments/${id}`);
};
