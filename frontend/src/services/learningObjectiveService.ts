const API_BASE_URL = import.meta.env.VITE_API_URL;

const API_URL = `${API_BASE_URL}/learning-objectives`;

export const getLearningObjectives = async () => {
  const response = await fetch(API_URL);

  return response.json();
};

export const createLearningObjective = async (
  learningObjectiveData: {
    title: string;
    description: string;
    topicId: number;
  }
) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(learningObjectiveData),
  });

  return response.json();
};

export const deleteLearningObjective = async (
  id: number
) => {
  await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });
};