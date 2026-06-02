const API_BASE_URL = import.meta.env.VITE_API_URL;

export const startAttempt = async (
  assessmentId: number
) => {
  const response = await fetch(
    `${API_BASE_URL}/assessment-attempts/start`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assessmentId,
        participantId: 1,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error(
      data.error || "Failed to start attempt"
    );
  }

  return data;
};

export const submitAttempt = async (
  attemptId: number,
  answers: any[]
) => {
  const response = await fetch(
    `${API_BASE_URL}/assessment-attempts/${attemptId}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answers,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error(
      data.error || "Failed to submit attempt"
    );
  }

  return data;
};