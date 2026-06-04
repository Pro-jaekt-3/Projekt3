import {
  apiEnsureOk,
  apiJsonFetch,
} from "./apiClient";

export const getQuestions = async () => {
  return apiJsonFetch("/questions");
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
  return apiJsonFetch("/questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(questionData),
  });
};

export const deleteQuestion = async (id: number) => {
  await apiEnsureOk(`/questions/${id}`, {
    method: "DELETE",
  });
};

export const updateQuestionStatus = async (
  id: number,
  status: string
) => {
  return apiJsonFetch(
    `/questions/${id}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    }
  );
};
