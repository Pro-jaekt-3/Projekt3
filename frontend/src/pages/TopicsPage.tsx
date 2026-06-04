import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getTopics,
  createTopic,
  deleteTopic,
} from "../services/topicService";

import { getTrainings } from "../services/trainingService";

type Topic = {
  id: number;
  name: string;
  trainingId: number;
  training?: {
    id: number;
    title: string;
  };
};

type Training = {
  id: number;
  title: string;
  description?: string | null;
};

function TopicsPage() {
  const [searchParams] = useSearchParams();
  const initialTrainingId =
    searchParams.get("trainingId") || "";

  const [topics, setTopics] = useState<Topic[]>([]);
  const [trainings, setTrainings] = useState<
    Training[]
  >([]);

  const [name, setName] = useState("");
  const [trainingId, setTrainingId] =
    useState(initialTrainingId);

  const loadTopics = async () => {
    try {
      const data = await getTopics();

      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTrainings = async () => {
    try {
      const data = await getTrainings();

      setTrainings(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadTopics();
    loadTrainings();
  }, []);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!name || !trainingId) {
      alert(
        "Please enter topic name and select training"
      );
      return;
    }

    try {
      await createTopic(
        name,
        Number(trainingId)
      );

      setName("");
      setTrainingId(initialTrainingId);

      loadTopics();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTopic(id);

      loadTopics();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-10">
        <h1 className="text-5xl font-bold mb-4">
          Topics
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600">
          Topics belong to trainings and organize the subject areas that
          later connect learning objectives, questions and assessments.
        </p>

        <Link
          to="/learning-objectives"
          className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
        >
          Next: Add learning objectives
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 max-w-xl mb-10"
      >
        <input
          type="text"
          placeholder="Topic name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        />

        <select
          value={trainingId}
          onChange={(e) =>
            setTrainingId(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        >
          <option value="">
            Select Training
          </option>

          {trainings.map((training) => (
            <option
              key={training.id}
              value={training.id}
            >
              {training.title}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition"
        >
          Add Topic
        </button>
      </form>

      <div className="grid gap-6">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between"
          >
            <div>
              <h3 className="text-2xl font-semibold">
                {topic.name}
              </h3>

              <p className="text-gray-500 text-sm mt-1">
                Training: {topic.training?.title}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={`/learning-objectives?topicId=${topic.id}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
              >
                Manage Objectives
              </Link>

              <button
                onClick={() =>
                  handleDelete(topic.id)
                }
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopicsPage;
