const API_BASE_URL = import.meta.env.VITE_API_URL;

const API_URL = `${API_BASE_URL}/assessments`;

export const getAssessments = async () => {
  const response = await fetch(API_URL, {
    headers: {
      "x-user-id": "1",
      "x-user-role": "INSTRUCTOR",
    },
  });

  return response.json();
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
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "1",
      "x-user-role": "INSTRUCTOR",
    },
    body: JSON.stringify(assessmentData),
  });

  return response.json();
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
  const response = await fetch(
    `${API_URL}/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "1",
        "x-user-role": "INSTRUCTOR",
      },
      body: JSON.stringify(generateData),
    }
  );

  return response.json();
};

export const deleteAssessment = async (
  id: number
) => {
  await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    headers: {
      "x-user-id": "1",
      "x-user-role": "INSTRUCTOR",
    },
  });
};

export const getAssessment = async (
  id: number
) => {
  const response = await fetch(
    `${API_URL}/${id}`,
    {
      headers: {
        "x-user-id": "1",
        "x-user-role": "INSTRUCTOR",
      },
    }
  );

  return response.json();
};