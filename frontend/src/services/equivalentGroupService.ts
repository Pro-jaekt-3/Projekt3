const API_BASE_URL = import.meta.env.VITE_API_URL;

const API_URL =
  `${API_BASE_URL}/equivalent-question-groups`;

export const getEquivalentGroups = async () => {
  const response = await fetch(API_URL);

  return response.json();
};

export const createEquivalentGroup = async (
  name: string,
  description: string
) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
    }),
  });

  return response.json();
};

export const addQuestionToGroup = async (
  groupId: number,
  questionId: number
) => {
  const response = await fetch(
    `${API_URL}/${groupId}/questions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questionId,
      }),
    }
  );

  return response.json();
};