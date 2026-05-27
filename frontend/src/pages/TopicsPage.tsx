import { useEffect, useState } from "react";

import {
  getTopics,
  createTopic,
  deleteTopic,
} from "../services/topicService";

type Topic = {
  id: number;
  name: string;
};

type Training = {
  id: number;
  name: string;
};

function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");

  const [trainings] = useState<Training[]>([
    { id: 1, name: "Programiranje" },
    { id: 2, name: "Podatkovne baze" },
  ]);

  const [trainingId, setTrainingId] =
    useState("");

  const loadTopics = async () => {
    try {
      const data = await getTopics();

      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadTopics();
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
      // Zaenkrat backend še ne podpira trainingId
      await createTopic(name);

      setName("");
      setTrainingId("");

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
      <h1 className="text-6xl font-bold text-center mb-12">
        Topics
      </h1>

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
              {training.name}
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
                Training support ready
              </p>
            </div>

            <button
              onClick={() =>
                handleDelete(topic.id)
              }
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopicsPage;