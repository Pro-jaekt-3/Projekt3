const API_BASE_URL = import.meta.env.VITE_API_URL;

const API_URL = `${API_BASE_URL}/questions`;

export const getQuestions = async () => {
  const response = await fetch(API_URL);

  return response.json();
};

export const createQuestion = async (questionData: {
  title: string;
  description: string;
  difficulty: number;
  topicId: number;

  learningObjectiveId?: number;
  equivalentGroupId?: number;

  type: string;

  options?: {
    text: string;
    isCorrect: boolean;
  }[];
}) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(questionData),
  });

  return response.json();
};

export const deleteQuestion = async (id: number) => {
  await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });
};

export const updateQuestionStatus = async (
  id: number,
  status: string
) => {
  const response = await fetch(
    `${API_URL}/${id}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "1",
        "x-user-role": "INSTRUCTOR",
      },
      body: JSON.stringify({
        status,
      }),
    }
  );

  return response.json();
};