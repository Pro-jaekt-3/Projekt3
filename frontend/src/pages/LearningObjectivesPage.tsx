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
      const data =
        await getLearningObjectives();

      setLearningObjectives(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadLearningObjectives();
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
    <div className="max-w-7xl mx-auto px-8 py-10">
      <h1 className="text-6xl font-bold text-center mb-12">
        Learning Objectives
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 max-w-xl mb-10"
      >
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        />

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition"
        >
          Add Learning Objective
        </button>
      </form>

      <div className="grid gap-6">
        {learningObjectives.map(
          (objective) => (
            <div
              key={objective.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">
                    {objective.title}
                  </h3>

                  <p className="text-gray-600">
                    {objective.description}
                  </p>
                </div>

                <button
                  onClick={() =>
                    handleDelete(
                      objective.id
                    )
                  }
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default LearningObjectivesPage;