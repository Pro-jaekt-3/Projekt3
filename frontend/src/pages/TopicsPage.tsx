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

function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");

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

    if (!name) {
      alert("Please enter topic name");
      return;
    }

    try {
      await createTopic(name);

      setName("");

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
            <h3 className="text-2xl font-semibold">
              {topic.name}
            </h3>

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