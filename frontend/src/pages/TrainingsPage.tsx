import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
      <div className="mb-10">
        <h1 className="text-5xl font-bold mb-4">
          Trainings
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600">
          Trainings are the top-level structure for instructor content.
          Create a training first, then add topics, learning objectives,
          questions and assessments.
        </p>

        <Link
          to="/topics"
          className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
        >
          Next: Add topics
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 max-w-xl mb-10"
      >
        <input
          type="text"
          placeholder="Training title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        />

        <textarea
          placeholder="Training description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3 min-h-[120px]"
        />

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition"
        >
          Add Training
        </button>
      </form>

      <div className="grid gap-6">
        {trainings.map((training) => (
          <div
            key={training.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
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
                  to={`/topics?trainingId=${training.id}`}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
                >
                  Manage Topics
                </Link>

                <button
                  onClick={() =>
                    handleDelete(training.id)
                  }
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
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
