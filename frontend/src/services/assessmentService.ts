import {
  apiEnsureOk,
  apiJsonFetch,
} from "./apiClient";

export const getAssessments = async () => {
  return apiJsonFetch("/assessments");
};

export const getAvailableAssessments = async () => {
  return apiJsonFetch("/assessments/available");
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

export const updateAssessmentStatus = async (
  id: number,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
) => {
  return apiJsonFetch(`/assessments/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
    }),
  });
};

export const getAssessment = async (
  id: number
) => {
  return apiJsonFetch(`/assessments/${id}`);
};
