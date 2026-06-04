import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getLearningObjectives,
  createLearningObjective,
  deleteLearningObjective,
} from "../services/learningObjectiveService";

import { getTopics } from "../services/topicService";

type LearningObjective = {
  id: number;
  title: string;
  description: string;
  topicId: number;
  topic?: {
    id: number;
    name: string;
  };
};

type Topic = {
  id: number;
  name: string;
};

function LearningObjectivesPage() {
  const [searchParams] = useSearchParams();
  const initialTopicId =
    searchParams.get("topicId") || "";

  const [learningObjectives, setLearningObjectives] =
    useState<LearningObjective[]>([]);

  const [topics, setTopics] = useState<Topic[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topicId, setTopicId] = useState(initialTopicId);

  const loadLearningObjectives = async () => {
    try {
      const data =
        await getLearningObjectives();

      setLearningObjectives(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTopics = async () => {
    try {
      const data = await getTopics();

      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadLearningObjectives();
    loadTopics();
  }, []);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!title || !topicId) {
      alert(
        "Please enter title and select topic"
      );
      return;
    }

    try {
      await createLearningObjective({
        title,
        description,
        topicId: Number(topicId),
      });

      setTitle("");
      setDescription("");
      setTopicId(initialTopicId);

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
      <div className="mb-10">
        <h1 className="text-5xl font-bold mb-4">
          Learning Objectives
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600">
          Learning objectives belong to topics. They describe what the
          participant should know before you create targeted questions.
        </p>

        <Link
          to="/questions"
          className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
        >
          Next: Add questions
        </Link>
      </div>

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

        <select
          value={topicId}
          onChange={(e) =>
            setTopicId(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        >
          <option value="">
            Select Topic
          </option>

          {topics.map((topic) => (
            <option
              key={topic.id}
              value={topic.id}
            >
              {topic.name}
            </option>
          ))}
        </select>

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
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">
                    {objective.title}
                  </h3>

                  <p className="text-gray-600">
                    {objective.description}
                  </p>

                  <p className="text-gray-500 text-sm mt-2">
                    Topic:{" "}
                    {objective.topic?.name}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/questions?topicId=${objective.topicId}&learningObjectiveId=${objective.id}`}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
                  >
                    Create Questions
                  </Link>

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
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default LearningObjectivesPage;
