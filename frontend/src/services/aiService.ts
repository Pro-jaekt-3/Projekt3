import { apiJsonFetch } from "./apiClient";

type QuestionDraftPayload = {
  topic: string;
  learningObjective: string;
  questionType: string;
  difficulty: number;
  instructions?: string;
  aiModelId?: number;
  modelName?: string;
};

type EquivalenceSuggestionPayload = {
  questionAId: number;
  questionBId: number;
  instructions?: string;
  aiModelId?: number;
  modelName?: string;
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

export const getOllamaStatus = async () => {
  return apiJsonFetch("/ai/ollama/status");
};

export const testAiModel = async (id: number) => {
  return apiJsonFetch(`/ai/models/${id}/test`, {
    method: "POST",
  });
};
