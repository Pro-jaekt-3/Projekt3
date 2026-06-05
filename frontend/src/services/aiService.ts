import { apiJsonFetch } from "./apiClient";

type QuestionDraftPayload = {
  topic: string;
  learningObjective: string;
  questionType: string;
  difficulty: number;
  instructions?: string;
};

type EquivalenceSuggestionPayload = {
  questionAId: number;
  questionBId: number;
  instructions?: string;
};

export const generateQuestionDraft = async (
  payload: QuestionDraftPayload
) => {
  return apiJsonFetch("/ai/question-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const suggestQuestionEquivalence = async (
  payload: EquivalenceSuggestionPayload
) => {
  return apiJsonFetch("/ai/equivalence-suggestion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getAiModels = async () => {
  return apiJsonFetch("/ai/models");
};
