const API_BASE_URL = import.meta.env.VITE_API_URL;

const API_URL = `${API_BASE_URL}/topics`;

export const getTopics = async () => {
  const response = await fetch(API_URL);

  return response.json();
};

export const createTopic = async (
  name: string,
  trainingId: number
) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      trainingId,
    }),
  });

  return response.json();
};

export const deleteTopic = async (id: number) => {
  await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });
};