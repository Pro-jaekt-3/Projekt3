import { useEffect, useState } from "react";

import {
  getTrainings,
  createTraining,
  deleteTraining,
} from "../services/trainingService";

type Training = {
  id: number;
  title: string;
  description?: string | null;
};

function TrainingsPage() {
  const [trainings, setTrainings] = useState<
    Training[]
  >([]);

  const [title, setTitle] = useState("");

  const [description, setDescription] =
  useState("");

  const loadTrainings = async () => {
    try {
      const data = await getTrainings();

      setTrainings(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadTrainings();
  }, []);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!title) return;

    try {
      await createTraining(
      title,
      description
      );

      setTitle("");
      setDescription("");

      loadTrainings();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (
    id: number
  ) => {
    try {
      await deleteTraining(id);

      loadTrainings();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Trainings</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: "30px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "400px",
        }}
      >
        <input
          type="text"
          placeholder="Training title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
        />

        <textarea
          placeholder="Training description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          style={{
            minHeight: "100px",
          }}
        />

        <button type="submit">
          Add Training
        </button>
      </form>

      {trainings.map((training) => (
        <div
          key={training.id}
          style={{
            border: "1px solid gray",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h3>{training.title}</h3>

          {training.description && (
            <p>{training.description}</p>
          )}

          <button
            onClick={() =>
              handleDelete(training.id)
            }
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default TrainingsPage;