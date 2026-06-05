import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getTrainings,
  createTraining,
  deleteTraining,
} from "../services/trainingService";
import { EmptyState, PageHeader } from "../components/ui";

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

    if (!title) {
      alert("Please enter title");
      return;
    }

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
    <div className="max-w-7xl mx-auto px-8 py-10">
      <PageHeader
        eyebrow="Instructor workspace"
        title="My Trainings"
        description={
          <>
            Trainings are the central workspace for curriculum, question
            bank, assessments and results. Open a workspace to build and
            monitor the full product flow for that training.
          </>
        }
        actions={
          <Link to="/questions" className="app-button-secondary">
            Open Question Bank
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="app-card mb-10 grid gap-4 p-6 lg:grid-cols-[1fr_1.4fr_auto]"
      >
        <input
          type="text"
          placeholder="Training title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          className="app-input"
        />

        <textarea
          placeholder="Training description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          className="app-input min-h-[48px]"
        />

        <button
          type="submit"
          className="app-button-primary"
        >
          Create Training
        </button>
      </form>

      <div className="grid gap-6">
        {trainings.length === 0 ? (
          <EmptyState
            title="No trainings yet"
            description="Create a training to start building curriculum, questions and assessments in one workspace."
          />
        ) : trainings.map((training) => (
          <div
            key={training.id}
            className="app-card p-6"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-2xl font-semibold mb-2">
                  {training.title}
                </h3>

                {training.description && (
                  <p className="text-gray-600">
                    {training.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/trainings/${training.id}`}
                  className="app-button-primary"
                >
                  Open Workspace
                </Link>

                <Link
                  to={`/topics?trainingId=${training.id}`}
                  className="app-button-secondary"
                >
                  Manage Topics
                </Link>

                <button
                  onClick={() =>
                    handleDelete(training.id)
                  }
                  className="app-button-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrainingsPage;
