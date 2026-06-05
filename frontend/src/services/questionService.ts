import {
  apiEnsureOk,
  apiJsonFetch,
} from "./apiClient";

export const getQuestions = async () => {
  return apiJsonFetch("/questions");
};

type QuestionPayload = {
  title: string;
  description: string;
  difficulty: number;
  topicId: number;

  learningObjectiveId?: number | null;
  equivalentGroupId?: number | null;

  type: string;

  options?: {
    text: string;
    isCorrect: boolean;
  }[];
};

export const createQuestion = async (
  questionData: QuestionPayload
) => {
  return apiJsonFetch("/questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(questionData),
  });
};

export const updateQuestion = async (
  id: number,
  questionData: Partial<QuestionPayload>
) => {
  return apiJsonFetch(`/questions/${id}`, {
    method: "PUT",
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
