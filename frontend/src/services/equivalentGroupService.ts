import {
  apiJsonFetch,
} from "./apiClient";

export const getEquivalentGroups = async () => {
  return apiJsonFetch(
    "/equivalent-question-groups"
  );
};

export const createEquivalentGroup = async (
  name: string,
  description: string
) => {
  return apiJsonFetch(
    "/equivalent-question-groups",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        name,
        description,
      }),
    }
  );
};

export const addQuestionToGroup = async (
  groupId: number,
  questionId: number
) => {
  return apiJsonFetch(
    `/equivalent-question-groups/${groupId}/questions`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        questionId,
      }),
    }
  );
};
