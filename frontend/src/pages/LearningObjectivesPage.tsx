import { useEffect, useState } from "react";

import {
  getLearningObjectives,
  createLearningObjective,
  deleteLearningObjective,
} from "../services/learningObjectiveService";

type LearningObjective = {
  id: number;
  title: string;
  description: string;
};

function LearningObjectivesPage() {
  const [learningObjectives, setLearningObjectives] =
    useState<LearningObjective[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const loadLearningObjectives = async () => {
    try {
      const data = await getLearningObjectives();

      setLearningObjectives(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadLearningObjectives();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) {
      alert("Please enter title");
      return;
    }

    try {
      await createLearningObjective({
        title,
        description,
      });

      setTitle("");
      setDescription("");

      loadLearningObjectives();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLearningObjective(id);

      loadLearningObjectives();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Learning Objectives</h1>

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
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
        />

        <button type="submit">
          Add Learning Objective
        </button>
      </form>

      {learningObjectives.map((objective) => (
        <div
          key={objective.id}
          style={{
            border: "1px solid gray",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h3>{objective.title}</h3>

          <p>{objective.description}</p>

          <button
            onClick={() =>
              handleDelete(objective.id)
            }
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default LearningObjectivesPage;