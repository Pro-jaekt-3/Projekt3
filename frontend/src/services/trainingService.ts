const API_URL = "http://localhost:3000/trainings";

export const getTrainings = async () => {
  const response = await fetch(API_URL);
  return response.json();
};

export const createTraining = async (name: string) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  return response.json();
};